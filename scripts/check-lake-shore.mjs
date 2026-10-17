import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const base=process.env.PALACE_URL||'http://127.0.0.1:5196';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/lake-shore/native');
await mkdir(out,{recursive:true});
const files=['src/worlds/road/Lake.tsx','src/worlds/road/lakeMesh.ts','src/worlds/road/lakeShore.ts','src/worlds/road/lakeReflection.ts','src/worlds/road/shoreDirection.ts','src/worlds/road/terrainTransition.ts','src/worlds/road/Landscape.tsx','src/worlds/road/textures.ts','src/worlds/alpine/assets.ts','src/worlds/scenery/terrainFinish.ts','src/worlds/scenery/pastureSampling.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const sourceHashes=await hashes(),report={at:new Date().toISOString(),base,sourceHashes,checks:[],errors:[],uploads:[],external:[]};
const browser=await chromium.launch({channel:'msedge',headless:false,args:['--use-angle=d3d11','--disable-features=CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'no-preference'});
await context.route('**/*',r=>{
  const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){report.external.push(u.origin);return r.abort();}
  if(u.pathname==='/personal-media/manifest.json')return r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}});
  if(u.pathname==='/personal-media/avatar.json')return r.fulfill({json:{profile:null}});
  if(u.pathname.startsWith('/personal-media/'))return r.abort();return r.continue();
});
await context.addInitScript(()=>{
  localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,roomSoundtracks:false,reducedMotion:false},version:0}));
  if(!sessionStorage.getItem('lake-native-start')){
    localStorage.setItem('memory-palace:road:v2',JSON.stringify({route:2,distance:3529.720322699531*.69,gear:7,comfort:true}));sessionStorage.setItem('lake-native-start','1');
  }
});
const page=await context.newPage();page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))report.uploads.push(r.method()+' '+new URL(r.url()).pathname);});
const status=()=>page.locator('.road-status'),shot=name=>page.screenshot({path:path.join(out,name+'.png')});
const flush=()=>writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2));
try{
  await page.goto(base+'/cycling/?view=first');await page.locator('.world-ready canvas').waitFor();
  assert.equal(await status().getAttribute('data-mounted'),'false');
  await page.keyboard.down('w');await page.waitForFunction(()=>!document.querySelector('.road-mount')?.disabled);await page.keyboard.up('w');
  await page.getByRole('button',{name:'Mount / ride · E',exact:true}).click();
  await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1);await page.bringToFront();
  report.checks.push('Resume a valid saved shore distance on foot, approach and mount through native input.');
  await page.keyboard.down('w');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed>3);
  report.pedaling=await page.evaluate(async()=>{
    const d=window.__PALACE_DEBUG__,r=d.renderer,m=window.__ROAD_DEBUG__.model,start=performance.now(),startDistance=m.distance,times=[];let previous=start,last=r.info.render.frame,hidden=0,unfocused=0;
    const peak={calls:0,triangles:0,textures:0};
    await new Promise(resolve=>{const tick=now=>{if(r.info.render.frame!==last){times.push(now-previous);previous=now;last=r.info.render.frame;}hidden+=Number(document.hidden);unfocused+=Number(!document.hasFocus());peak.calls=Math.max(peak.calls,r.info.render.calls);peak.triangles=Math.max(peak.triangles,r.info.render.triangles);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=20000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    const sorted=[...times].sort((a,b)=>a-b),gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return{startDistance,endDistance:m.distance,endSpeed:m.speed,fps:times.length*1000/(performance.now()-start),p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),hidden,unfocused,peak,dpr:r.getPixelRatio(),drawing:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),scope:'20 seconds of held W from saved shore progress, actual physics, no progress or speed injection during travel; no concurrent captures or builds; wall intervals, not thermal or whole-route minimum.'};
  });
  await page.keyboard.up('w');assert.ok(report.pedaling.endDistance>report.pedaling.startDistance+10);assert.equal(report.pedaling.hidden,0);assert.equal(report.pedaling.unfocused,0);await shot('native-shore-ride');
  report.checks.push('Real 20-second pedaling and sector transitions beside the lake.');await flush();
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed===0);await page.keyboard.up('Space');
  await page.keyboard.press('p');await page.getByRole('button',{name:'Save this view',exact:true}).waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save this view',exact:true}).click();await(await download).saveAs(path.join(out,'actual-photo.png'));
  report.checks.push('Native braking, photo mode and an actual downloaded local PNG.');
  const clock=()=>page.evaluate(()=>window.__PALACE_DEBUG__.scene.getObjectByName('long-way-home-lake').material.uniforms.time.value);
  let before=await clock();await page.waitForTimeout(800);assert.ok(await clock()>before+.1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);before=await clock();await page.waitForTimeout(800);assert.ok(Math.abs(await clock()-before)<.00001);
  await page.emulateMedia({reducedMotion:'no-preference'});before=await clock();await page.waitForTimeout(800);assert.ok(await clock()>before+.1);
  report.checks.push('Water advances normally, freezes for reduced motion and resumes without rebuilding geometry.');
  await page.keyboard.press('Escape');assert.equal(await status().getAttribute('data-photo'),'false');
  await page.keyboard.press('v');await shot('third-person-shore');await page.keyboard.press('v');
  report.checks.push('Photo Escape and native first/third-person views still operate.');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('memory-palace:road:v2')).distance);
  await page.reload();await page.locator('.world-ready canvas').waitFor();await status().waitFor({state:'attached'});
  assert.equal(await status().getAttribute('data-mounted'),'false');assert.ok(Math.abs(Number(await status().getAttribute('data-distance'))-saved)<.2);
  report.checks.push('Reload retains actual route progress and returns safely on foot.');
  await page.getByRole('button',{name:'Return to the Palace',exact:true}).click();await page.locator('.world-ready canvas').waitFor();await shot('museum-return');
  report.checks.push('Return from the lake ride to the existing museum.');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);assert.deepEqual(report.external,[]);assert.deepEqual(await hashes(),sourceHashes);
  report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);await shot('failure').catch(()=>{});}
finally{await flush();await context.close();await browser.close();}
console.log(`Lake shore native journey: ${report.checks.length} checks, ${report.passed?'PASS':'FAIL'}`);
