import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=process.env.PALACE_ARTIFACTS||'qa-artifacts/museum-entry';
const phase=process.env.PALACE_PHASE||'after';
const out=path.resolve(root,phase);await mkdir(out,{recursive:true});
const quality=process.env.PALACE_QUALITY||'medium';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:process.env.PALACE_HEADLESS==='1',args:['--use-angle=d3d11','--disable-features=msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion,CalculateNativeWinOcclusion']});
const report={sha:execFileSync('git',['rev-parse','HEAD']).toString().trim(),dirty:!!execFileSync('git',['status','--porcelain']).toString().trim(),browser:browser.version(),quality,headless:process.env.PALACE_HEADLESS==='1',base:process.env.PALACE_URL||'http://127.0.0.1:5190',errors:[],uploads:[],views:[]};
const views=[['atrium','welcome',null,null],['atrium','entry',[0,1.65,23],[0,3.5,-1]],['atrium','glass',[4.9,2,4.2],[0,3.2,0]],['atrium','glass-side',[-6.3,2,-1.6],[0,3.2,0]],['projects','entry',[0,1.65,13.8],[0,3.15,-8]],['research','entry',[0,1.65,13.8],[0,3.15,-8]],['music','entry',[1.5,1.65,10.8],[0,2.75,-5]],['wallpapers','entry',[0,1.65,13.8],[0,3.15,-8]],['imagined-worlds','entry',[0,1.65,13.8],[0,3.15,-8]],['archive','entry',[0,1.65,13.8],[0,3.15,-8]],['unfinished','entry',[0,1.65,10.8],[0,3.15,-8]]];
const selected=process.env.PALACE_VIEWS?views.filter(v=>process.env.PALACE_VIEWS.split(',').includes(v[0]+':'+v[1])):views;
const widths=process.env.PALACE_WIDTHS?process.env.PALACE_WIDTHS.split(',').map(Number):[1920];
try{for(const width of widths){
 const height=width===390?844:width===1158?860:Math.round(width*9/16);
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 await context.addInitScript(({quality})=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality,effectiveQuality:quality,mute:true,reducedMotion:true,tutorialDone:true,roomSoundtracks:false},version:0})),{quality});
 await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null,head:null,source:null}}));
 const page=await context.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('request',r=>{if(r.method()!=='GET')report.uploads.push({method:r.method(),url:r.url()});});
 for(const [room,name,position,target] of selected){
  console.log('opening '+room+':'+name);await page.goto(report.base+'/'+(room==='atrium'?'':room));
  await page.waitForFunction(()=>window.__PALACE_DEBUG__);console.log('scene attached');await page.waitForFunction(()=>document.querySelector('.world-ready'));console.log('works ready');
  await page.evaluate(()=>document.fonts.ready);
  if(position){await page.evaluate(({position,target})=>{window.__PALACE_DEV__.state.getState().update({started:true,overlay:'guide',mode:'explore'});window.__PALACE_DEBUG__.camera.position.set(...position);window.__PALACE_DEBUG__.camera.lookAt(...target);window.__PALACE_DEBUG__.camera.fov=60;window.__PALACE_DEBUG__.camera.updateProjectionMatrix();},{position,target});await page.addStyleTag({content:'.dialog-backdrop,.welcome-caption,.tutorial{display:none!important}'});}
  await page.waitForTimeout(2500);
  const metrics=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,r=d.renderer,g=r.getContext(),x=g.getExtension('WEBGL_debug_renderer_info');let lights=0;d.scene.traverse(o=>{if(o.isLight)lights++});return{position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray(),fov:d.camera.fov,dpr:r.getPixelRatio(),drawing:[g.drawingBufferWidth,g.drawingBufferHeight],renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,lights,environment:d.scene.environment?.name,mirrorCaptures:d.scene.getObjectByName("atrium-polished-stone")?.userData.reflectionCaptures,glass:(()=>{let material;d.scene.getObjectByName("memory-core-optical-finish")?.traverse(o=>{if(o.isMesh)material=o.material;});return material?{roughness:material.roughness,transmission:material.transmission,attenuationDistance:material.attenuationDistance,env:material.envMapIntensity}:null;})(),bodyFont:getComputedStyle(document.body).fontFamily,titleFont:document.querySelector('h1')?getComputedStyle(document.querySelector('h1')).fontFamily:null}});
  if(!/GTX 1650/.test(metrics.renderer))throw new Error('Expected actual NVIDIA renderer: '+metrics.renderer);
  const file=`${width}-${room}-${name}.png`;await page.screenshot({path:path.join(out,file),animations:'disabled'});report.views.push({room,name,width,height,file,...metrics});console.log(file);
 }
 await context.close();}
 report.passed=!report.errors.length&&!report.uploads.length;
}finally{await writeFile(path.join(out,'views.json'),JSON.stringify(report,null,2));await browser.close();}
if(!report.passed)process.exitCode=1;
