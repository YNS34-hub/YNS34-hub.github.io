import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const base=process.env.PALACE_URL||'http://127.0.0.1:5190';
const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/cycling-art/before');
const views=[
  ['forest-entry','cycling',.045,0,0],
  ['lake-reveal','cycling',.185,0,0],
  ['overlook','cycling',.487,'lake',-.12],
  ['forest-surface','cycling',.10,0,-.30],
  ['lake-edge','cycling',.233,'lake',-.16],
  ['alpine-pass','alpine-ride',.12,0,0],
  ['alpine-valley','alpine-ride',.43,0,0],
  ['alpine-surface','alpine-ride',.61,0,-.30],
  ['alpine-forest','alpine-ride',.89,0,0],
].filter(v=>!process.env.PALACE_VIEWS||process.env.PALACE_VIEWS.split(',').includes(v[0]));
await mkdir(out,{recursive:true});
const probe=await chromium.launch({channel:'msedge',headless:false,args:['--enable-automation']});let defaults;
try{const cdp=await probe.newBrowserCDPSession();defaults=(await cdp.send('Browser.getBrowserCommandLine')).arguments.find(a=>a.startsWith('--disable-features='));await cdp.detach();}finally{await probe.close();}
const args=['--use-angle=d3d11',(defaults||'--disable-features=')+',CalculateNativeWinOcclusion'];
const browser=await chromium.launch({channel:'msedge',headless:false,args});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),browser:browser.version(),args,base,quality:'medium',dpr:1,scope:'Visible native Edge, same saved route distances and first-person camera. Native approach/mount; look direction staged only for reproducible scenic photography. Reduced motion freezes existing ambient clocks. Neutral public profile and empty private catalog. No speed / physics / scoring injection.',frames:[],errors:[],uploads:[]};
const flush=()=>writeFile(path.join(out,'captures.json'),JSON.stringify(report,null,2));
try{
for(const width of(process.env.PALACE_CAPTURE_WIDTH?[Number(process.env.PALACE_CAPTURE_WIDTH)]:[1920,2560])){
 const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1,reducedMotion:'reduce'});
 await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
 await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,roomSoundtracks:false,reducedMotion:true},version:0})));
 const page=await context.newPage();page.setDefaultTimeout(90000);const lengths={};
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(['POST','PUT'].includes(r.method()))report.uploads.push(r.url());});
 await page.route(base+'/__art_fixture__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Saved scenic view</title>'}));
 for(const[name,room,progress,yaw,pitch]of views){
  // 长度取原有地图，只更改测试浏览器的有效路线存档，不建立第二套路线。
  if(!lengths[room]){await page.goto(base+'/'+room+'?view=first');await page.waitForFunction(room=>window.__ROAD_DEBUG__&&window.__PALACE_DEBUG__?.roomId===room&&document.querySelector('.world-ready'),room);lengths[room]=await page.evaluate(()=>window.__ROAD_DEBUG__.model.geography.length);}
  const length=lengths[room];
  await page.goto(base+'/__art_fixture__');
  await page.evaluate(({room,progress,length})=>localStorage.setItem(room==='cycling'?'memory-palace:road:v2':'memory-palace:alpine:v1',JSON.stringify({route:room==='cycling'?2:1,distance:progress*length,gear:7,comfort:true})),{room,progress,length});
  await page.goto(base+'/'+room+'?view=first');
  await page.waitForFunction(room=>window.__ROAD_DEBUG__&&window.__PALACE_DEBUG__?.roomId===room&&document.querySelector('.world-ready'),room);
  await page.keyboard.down('w');await page.waitForFunction(()=>!document.querySelector('.road-mount')?.disabled);await page.keyboard.up('w');
  await page.getByRole('button',{name:'Mount / ride · E',exact:true}).click();
  await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1&&window.__ROAD_DEBUG__.model.speed===0);
  await page.evaluate(({yaw,pitch})=>{const v=window.__ROAD_DEBUG__.view,c=window.__PALACE_DEBUG__.camera;if(yaw==='lake'){const x=520-c.position.x,z=-452-c.position.z;v.headYaw=Math.atan2(Math.sin(Math.atan2(-x,-z)-v.yaw),Math.cos(Math.atan2(-x,-z)-v.yaw));}else v.headYaw=yaw;v.headPitch=pitch;}, {yaw,pitch});
  await page.waitForTimeout(900);await page.bringToFront();
  await page.waitForFunction(()=>!document.hidden&&document.hasFocus());
  const state=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,r=d.renderer,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info'),road=window.__ROAD_DEBUG__;const lake=d.scene.getObjectByName('long-way-home-lake');return{room:d.roomId,position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray(),fov:d.camera.fov,distance:road.model.distance,length:road.model.geography.length,mounted:road.view.mounted,speed:road.model.speed,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures};});
  assert.ok(state.mounted&&Math.abs(state.distance-progress*length)<.01);assert.equal(state.speed,0);assert.match(state.renderer,/GTX 1650/);
  let performanceSample;
  if(process.env.PALACE_MEASURE==='1')performanceSample=await page.evaluate(async()=>{const r=window.__PALACE_DEBUG__.renderer,start=performance.now(),times=[];let prev=start,last=r.info.render.frame,duplicates=0,hidden=0,unfocused=0;const peak={calls:0,triangles:0,textures:0};await new Promise(resolve=>{const tick=now=>{if(r.info.render.frame!==last){times.push(now-prev);prev=now;last=r.info.render.frame;}else duplicates++;hidden+=Number(document.hidden);unfocused+=Number(!document.hasFocus());for(const k of['calls','triangles'])peak[k]=Math.max(peak[k],r.info.render[k]);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=8000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});const elapsed=performance.now()-start,sorted=[...times].sort((a,b)=>a-b);return{fps:times.length*1000/elapsed,renderedFrames:times.length,duplicateTicks:duplicates,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),hidden,unfocused,peak,scope:'8-second rendered-frame wall intervals; duplicate RAF excluded; stationary scenic view; main-pass counts, not a whole-route / thermal benchmark'};});
  if(performanceSample){assert.equal(performanceSample.hidden,0);assert.equal(performanceSample.unfocused,0);}
  const file=`${width}-${name}.png`;await page.screenshot({path:path.join(out,file)});report.frames.push({name,width,progress,yaw,pitch,file,state,performance:performanceSample});await flush();console.log(file+(performanceSample?' / '+performanceSample.fps.toFixed(1)+' rendered FPS':''));
 }
 await context.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}finally{await flush();await browser.close();}
