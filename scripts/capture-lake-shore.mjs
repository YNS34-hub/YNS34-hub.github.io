import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const base=process.env.PALACE_URL||'http://127.0.0.1:5190',quality=process.env.PALACE_QUALITY||'medium';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local preview only');
const sourceRoot=path.resolve(process.env.PALACE_SOURCE_ROOT||'.');
const sourceFiles=['src/worlds/road/Lake.tsx','src/worlds/road/lakeMesh.ts','src/worlds/road/lakeShore.ts','src/worlds/road/lakeReflection.ts','src/worlds/road/shoreDirection.ts','src/worlds/road/terrainTransition.ts','src/worlds/road/Landscape.tsx','src/worlds/road/valleyFloor.ts','src/worlds/road/route.ts','src/worlds/road/textures.ts','src/worlds/alpine/assets.ts','src/worlds/scenery/terrainFinish.ts','src/worlds/scenery/pastureSampling.ts','src/worlds/scenery/earthSampling.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,await readFile(path.join(sourceRoot,file)).then(b=>createHash('sha256').update(b).digest('hex')).catch(e=>{if(e.code==='ENOENT')return null;throw e;})])));
const sourceHashes=await hashes();
assert.ok(['medium','high'].includes(quality));
const baseline=process.env.PALACE_BASELINE_SHA;
if(baseline){assert.match(baseline,/^[a-f0-9]{40}$/);assert.equal((await(await fetch(base+'/qa-baseline.json')).json()).sha,baseline);}
const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/lake-shore/after');
const views=[
  ['lake-reveal','cycling',.185,'lake',-.12],
  ['shore-road','cycling',.233,'lake',-.14],
  ['overlook','cycling',.487,'lake',-.22],
  ['waterline','cycling',.70,'lake',-.12],
  ['last-light','cycling',.83,'lake',-.12],
].filter(v=>!process.env.PALACE_VIEWS||process.env.PALACE_VIEWS.split(',').includes(v[0]));
await mkdir(out,{recursive:true});
const probe=await chromium.launch({channel:'msedge',headless:false,args:['--enable-automation']});let defaults;
try{const cdp=await probe.newBrowserCDPSession();defaults=(await cdp.send('Browser.getBrowserCommandLine')).arguments.find(a=>a.startsWith('--disable-features='));await cdp.detach();}finally{await probe.close();}
const args=['--use-angle=d3d11',(defaults||'--disable-features=')+',CalculateNativeWinOcclusion'];
const browser=await chromium.launch({channel:'msedge',headless:false,args});
const report={sha:baseline||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:baseline?false:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),browser:browser.version(),args,base,quality,deviceScaleFactor:1,scope:'Visible native Edge, same saved route distances and first-person camera. Actual drawing DPR is recorded per frame. Native approach/mount; look direction staged only for reproducible scenic photography. Reduced motion freezes existing ambient clocks. Neutral public profile and empty private catalog. No speed / physics / scoring injection.',frames:[],errors:[],uploads:[]};
report.sourceHashes=sourceHashes;report.stage=process.env.PALACE_STAGE||'after';report.blockedExternal=[];
const flush=()=>writeFile(path.join(out,'captures.json'),JSON.stringify(report,null,2));
try{
for(const width of(process.env.PALACE_CAPTURE_WIDTH?[Number(process.env.PALACE_CAPTURE_WIDTH)]:[1920,2560])){
 const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1,reducedMotion:'reduce'});
 await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){report.blockedExternal.push(u.origin);return r.abort();}if(u.pathname.startsWith('/personal-media/')&&!['/personal-media/manifest.json','/personal-media/avatar.json'].includes(u.pathname))return r.abort();return r.fallback();});
 await context.addInitScript(quality=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality,tutorialDone:true,roomSoundtracks:false,reducedMotion:true},version:0})),quality);
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
  await page.keyboard.press('p');
  await page.evaluate(({yaw,pitch})=>{const v=window.__ROAD_DEBUG__.view,c=window.__PALACE_DEBUG__.camera,x=520-c.position.x,z=-452-c.position.z,target=yaw==='lake'?Math.atan2(Math.sin(Math.atan2(-x,-z)-v.yaw),Math.cos(Math.atan2(-x,-z)-v.yaw)):yaw;v.baseYaw+=v.headYaw-target;v.basePitch+=v.headPitch-pitch;v.headYaw=target;v.headPitch=pitch;v.lookPending=false;}, {yaw,pitch});
  await page.waitForTimeout(900);await page.bringToFront();
  await page.waitForFunction(()=>!document.hidden&&document.hasFocus());
  const state=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,r=d.renderer,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info'),road=window.__ROAD_DEBUG__,maps=new Set();let lights=0,shadowLights=0,textureBytes=0;d.scene.traverse(o=>{if(o.isLight&&o.intensity>.01){lights++;shadowLights+=Number(o.castShadow);}for(const material of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))for(const name of['map','normalMap','alphaMap','roughnessMap','metalnessMap']){const t=material[name],key=t&&[t.source.uuid,t.colorSpace,t.wrapS,t.wrapT,t.anisotropy].join(':');if(t&&!maps.has(key)){maps.add(key);textureBytes+=(t.image?.width||0)*(t.image?.height||0)*4*4/3;}}});return{room:d.roomId,position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray(),fov:d.camera.fov,distance:road.model.distance,length:road.model.geography.length,mounted:road.view.mounted,speed:road.model.speed,dpr:r.getPixelRatio(),drawing:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,lights,shadowLights,materialTextureMiB:textureBytes/1024/1024,textureScope:'RGBA8 with mip estimate for unique material source/sampler sets, not total VRAM; HDR, framebuffers and bone textures excluded'};});
  assert.ok(state.mounted&&Math.abs(state.distance-progress*length)<.01);assert.equal(state.speed,0);assert.match(state.renderer,/GTX 1650/);
  let performanceSample;
  if(process.env.PALACE_MEASURE==='1'&&width===1920)performanceSample=await page.evaluate(async()=>{const r=window.__PALACE_DEBUG__.renderer,start=performance.now(),times=[];let prev=start,last=r.info.render.frame,duplicates=0,hidden=0,unfocused=0;const peak={calls:0,triangles:0,textures:0};await new Promise(resolve=>{const tick=now=>{if(r.info.render.frame!==last){times.push(now-prev);prev=now;last=r.info.render.frame;}else duplicates++;hidden+=Number(document.hidden);unfocused+=Number(!document.hasFocus());for(const k of['calls','triangles'])peak[k]=Math.max(peak[k],r.info.render[k]);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=8000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});const elapsed=performance.now()-start,sorted=[...times].sort((a,b)=>a-b);return{fps:times.length*1000/elapsed,renderedFrames:times.length,duplicateTicks:duplicates,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),hidden,unfocused,peak,scope:'8-second rendered-frame wall intervals; duplicate RAF excluded; stationary scenic view; main-pass counts, not a whole-route / thermal benchmark'};});
  if(performanceSample){assert.equal(performanceSample.hidden,0);assert.equal(performanceSample.unfocused,0);}
  const lake=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,mesh=d.scene.getObjectByName('long-way-home-lake'),mirror=d.scene.getObjectByName('lake-reflection-capture'),r=d.renderer;return{triangles:mesh.geometry.index.count/3,vertices:mesh.geometry.getAttribute('position').count,waterLevel:mesh.geometry.getAttribute('position').getY(0),opaque:!mesh.material.transparent,depthWrite:mesh.material.depthWrite,geometries:r.info.memory.geometries,shaderPrograms:r.info.programs.length,glError:r.getContext().getError(),reflection:mirror?{captures:mesh.userData.reflectionCaptures,ready:mesh.material.uniforms.mirrorReady.value,width:mirror.getRenderTarget().width,height:mirror.getRenderTarget().height,visible:mirror.visible,finiteProjection:mesh.material.uniforms.reflectionProjection.value.elements.every(Number.isFinite)}:null};});
  assert.equal(lake.glError,0);assert.equal(lake.opaque,true);assert.equal(lake.depthWrite,true);
  if(process.env.PALACE_REQUIRE_REFLECTION==='1'){assert.ok(lake.reflection?.captures>0);assert.equal(lake.reflection.ready,1);assert.equal(lake.reflection.width,quality==='high'?768:512);assert.equal(lake.reflection.height,lake.reflection.width);assert.equal(lake.reflection.visible,false);assert.equal(lake.reflection.finiteProjection,true);}
  const file=`${width}-${name}.png`;await page.screenshot({path:path.join(out,file)});const frame={name,width,progress,yaw,pitch,file,state,lake,performance:performanceSample};report.frames.push(frame);await flush();console.log(file+(performanceSample?' / '+performanceSample.fps.toFixed(1)+' rendered FPS':''));
  if(name==='overlook'&&process.env.PALACE_BANK_DETAIL==='1'){
    const detail=await page.evaluate(async()=>{
      const {createValleyFloor}=await import('/src/worlds/road/valleyFloor.ts'),{terrainSampler}=await import('/src/worlds/scenery/ecology.ts'),{lake,terrainHeight,closestRoad}=await import('/src/worlds/road/route.ts');
      const floor=createValleyFloor(),ground=terrainSampler(floor,terrainHeight);let best;
      for(let i=0;i<48;i++){
        const angle=i/48*Math.PI*2,dx=Math.cos(angle)*lake.rx,dz=Math.sin(angle)*lake.rz;let lo=.8,hi=1.43;
        if(ground(lake.x+dx*hi,lake.z+dz*hi)<=lake.y)continue;
        for(let n=0;n<25;n++){const mid=(lo+hi)/2;if(ground(lake.x+dx*mid,lake.z+dz*mid)>lake.y)hi=mid;else lo=mid;}
        const x=lake.x+dx*(lo+hi)/2,z=lake.z+dz*(lo+hi)/2,distance=closestRoad(x,z).distance;
        if(distance<100)continue;
        const nx=ground(x+.5,z)-ground(x-.5,z),nz=ground(x,z+.5)-ground(x,z-.5),length=Math.hypot(nx,nz);
        if(length<.015)continue;
        const score=Math.abs(x-lake.x)+Math.abs(z-(lake.z-lake.rz));
        if(!best||score<best.score)best={x,z,nx:nx/length,nz:nz/length,score};
      }
      if(!best)throw new Error('No dry bank detail viewpoint');
      const d=window.__PALACE_DEBUG__,camera=d.camera.clone(),x=best.x+best.nx*5,z=best.z+best.nz*5;
      camera.position.set(x,ground(x,z)+1.55,z);camera.lookAt(best.x-best.nx*9,lake.y,best.z-best.nz*9);camera.updateMatrixWorld();
      // 单次真实场景渲染的诊断相机；不移动玩家、不建立运行时相机或反射通道。
      d.renderer.render(d.scene,camera);const data=d.renderer.domElement.toDataURL('image/png');floor.dispose();
      return{data,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),target:[best.x-best.nx*9,lake.y,best.z-best.nz*9],fov:camera.fov,shore:[best.x,lake.y,best.z],scope:'Staged diagnostic bank camera, one actual GPU draw into the existing canvas; not a native walking claim.'};
    });
    const detailFile=`${width}-bank-detail.png`;await writeFile(path.join(out,detailFile),Buffer.from(detail.data.split(',')[1],'base64'));delete detail.data;frame.bankDetail={...detail,file:detailFile};await flush();
  }
  if(process.env.PALACE_PEDAL_MEASURE==='1'&&name==='forest-entry'){
   // 静态同机位图先保存，再用真实 W 骑行测量；测量窗口内不截图 / 录屏，不注入速度或路线进度。
   await page.keyboard.down('w');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.cadence>20);
   frame.nativePedaling=await page.evaluate(async()=>{const r=window.__PALACE_DEBUG__.renderer,start=performance.now(),distance=window.__ROAD_DEBUG__.model.distance,times=[];let prev=start,last=r.info.render.frame,duplicates=0,hidden=0,unfocused=0;const peak={calls:0,triangles:0,textures:0};await new Promise(resolve=>{const tick=now=>{if(r.info.render.frame!==last){times.push(now-prev);prev=now;last=r.info.render.frame;}else duplicates++;hidden+=Number(document.hidden);unfocused+=Number(!document.hasFocus());for(const k of['calls','triangles'])peak[k]=Math.max(peak[k],r.info.render[k]);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=20000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});const elapsed=performance.now()-start,sorted=[...times].sort((a,b)=>a-b),m=window.__ROAD_DEBUG__.model;return{fps:times.length*1000/elapsed,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),duplicateTicks:duplicates,hidden,unfocused,peak,startDistance:distance,endDistance:m.distance,endSpeed:m.speed,scope:'20-second native held-W, saved start distance, no speed / progress injection; no concurrent screenshots / recording / build; not whole-route or thermal benchmark'};});
   await page.keyboard.up('w');assert.equal(frame.nativePedaling.hidden,0);assert.equal(frame.nativePedaling.unfocused,0);assert.ok(frame.nativePedaling.endDistance>frame.nativePedaling.startDistance+10);await flush();console.log('Native pedaling: '+frame.nativePedaling.fps.toFixed(1)+' rendered FPS');
  }
 }
 await context.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);assert.deepEqual(report.blockedExternal,[]);assert.deepEqual(await hashes(),sourceHashes,'Source drifted during capture');report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}finally{await flush();await browser.close();}
