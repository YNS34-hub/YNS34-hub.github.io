import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const base=process.env.PALACE_URL||'http://127.0.0.1:5194',out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/private-gym/native');
const sourceRoot=path.resolve(process.env.PALACE_SOURCE_ROOT||'.');
const fitnessSources=async dir=>(await Promise.all((await readdir(path.join(sourceRoot,dir),{withFileTypes:true})).map(item=>item.isDirectory()?fitnessSources(dir+'/'+item.name):dir+'/'+item.name))).flat();
const sourceFiles=["src/worlds/presence/ik.ts","src/worlds/presence/courtHandRotation.ts",...await fitnessSources('src/fitness'),'src/rooms/PrivateGym.tsx','src/rooms/atrium/environment.tsx','src/world/Player.tsx','src/world/World.tsx','src/App.tsx','src/world/artDirection.ts','src/world/collision.ts','src/systems/store.ts','content/rooms.json','src/ui/Hud.tsx','src/worlds/presence/clarity.ts','src/worlds/presence/assets.ts','src/worlds/presence/appearance.ts','src/worlds/presence/appearanceRig.ts','src/worlds/presence/basketballAppearance.ts','public/media/presence/athlete.gltf','public/media/presence/athlete.bin','public/media/presence/athlete-detail.gltf','public/media/presence/athlete-detail.bin','public/media/presence/body-color.webp','public/media/presence/body-normal.webp','public/media/presence/head-color.webp','public/media/presence/head-normal.webp'];
sourceFiles.push('src/worlds/presence/courtFingerGrip.ts');
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(sourceRoot,file))).digest('hex')])));
const sourceHashes=await hashes();
await mkdir(out,{recursive:true});
const videoFixture=path.join(out,'qa-generated-vp8.webm');
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=192x108:rate=12','-t','1.2','-c:v','libvpx','-b:v','150k','-an',videoFixture]);
const browser=await chromium.launch({channel:'msedge',headless:process.env.PALACE_HEADLESS!=='0',args:['--use-angle=d3d11','--disable-features=CalculateNativeWinOcclusion']});
const report={startedAt:new Date().toISOString(),base,sourceHashes,checks:[],errors:[],uploads:[],exercises:[],scope:'Isolated browser profile; actual native door/control/file chooser/IndexedDB/video journeys. Synthetic QA media only. Camera starting poses use the existing return-view adapter. No pose, phase, rep or score injection.'};
const check=name=>{report.checks.push(name);console.log(name);},ids=['俯卧撑','徒手深蹲','平板支撑','哑铃弯举','哑铃肩推','卧推','负重深蹲'];
let latestPage;
const attachErrors=page=>{latestPage=page;page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))report.uploads.push({method:r.method(),url:r.url()});});};
async function contextFor(viewport={width:1920,height:1080},denied=false){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 if(process.env.PALACE_LOCAL_AVATAR!=='1')await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
 await context.addInitScript(({denied})=>{
  localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,roomSoundtracks:false},version:0}));
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),active=new Map();let made=0,removed=0;
  URL.createObjectURL=blob=>{const url=create(blob);active.set(url,{type:blob.type,size:blob.size});made++;return url;};
  URL.revokeObjectURL=url=>{if(active.delete(url))removed++;return revoke(url);};
  window.__GYM_QA_URLS__={read:()=>({made,removed,active:[...active.values()]})};
  window.addEventListener('palace:before-travel',()=>{const d=window.__PALACE_DEBUG__;if(d?.roomId==='atrium')window.__GYM_QA_ATRIUM_EXIT__={position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray()};});
  if(denied){const open=indexedDB.open.bind(indexedDB);indexedDB.open=(name,version)=>{if(name==='memory-palace-private-gym')throw new DOMException('QA denied','QuotaExceededError');return version===undefined?open(name):open(name,version);};}
 },{denied});return context;
}
const ready=page=>page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==='private-gym'&&document.querySelector('.world-ready')&&window.__PALACE_DEBUG__.scene.getObjectByName('private-gym-trainer')?.userData.fitness);
const read=page=>page.evaluate(()=>structuredClone(window.__PALACE_DEBUG__.scene.getObjectByName('private-gym-trainer').userData.fitness));
const readView=page=>page.evaluate(()=>{const d=window.__PALACE_DEBUG__,root=d.scene.getObjectByName('private-gym-trainer'),points=['Bip01_Head','Bip01_L_Hand','Bip01_R_Hand','Bip01_L_Foot','Bip01_R_Foot','Bip01_Spine2'].map(name=>root.getObjectByName(name)).filter(Boolean).map(bone=>bone.getWorldPosition(d.camera.position.clone()).project(d.camera).toArray());return{position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray(),points,span:Math.max(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])))};});
async function camera(page,roomId,position,target){
 await page.evaluate(({roomId,position,target})=>{const d=window.__PALACE_DEBUG__,c=d.camera;c.position.set(...position);c.lookAt(...target);window.__PALACE_DEV__.state.getState().update({returnView:{roomId,position:c.position.toArray(),quaternion:c.quaternion.toArray()},travelSequence:window.__PALACE_DEV__.state.getState().travelSequence+1});},{roomId,position,target});
 await page.bringToFront();await page.waitForTimeout(150);
}
async function fixture(page,video=false){if(video)return(await readFile(videoFixture)).toString('base64');return page.evaluate(()=>{
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=108;const ctx=canvas.getContext('2d');ctx.fillStyle='#d7c69b';ctx.fillRect(0,0,192,108);ctx.fillStyle='#46543e';ctx.fillRect(20,20,152,68);
 return canvas.toDataURL('image/png').split(',')[1];
 });}
const mediaDialog=page=>page.getByRole('dialog',{name:'我的训练记录',exact:true});
async function enterIfNeeded(page){const enter=page.getByRole('button',{name:'ENTER THE PALACE',exact:true});if(await enter.isVisible())await enter.click();}
async function openMedia(page){await page.getByRole('button',{name:'我的训练照片 / 视频',exact:true}).click();await mediaDialog(page).waitFor();}
async function importMedia(page,name,type,data){await mediaDialog(page).locator('input[type=file]').setInputFiles({name,mimeType:type,buffer:Buffer.from(data,'base64')});await page.waitForFunction(()=>!document.querySelector('.gym-import')?.disabled);}
try{
 const context=await contextFor(),page=await context.newPage();attachErrors(page);page.setDefaultTimeout(90000);
 await page.goto(base+'/');await page.locator('.world-ready canvas').waitFor();await page.getByRole('button',{name:'ENTER THE PALACE',exact:true}).click();
 await camera(page,'atrium',[-16,1.65,-4.5],[-20,2.25,-4.5]);
 const door=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,p=d.camera.position.clone().set(-19.88,2.25,-4.5).project(d.camera);return[(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];});
 await page.mouse.click(...door);await ready(page);check('Actual atrium wall door enters the independent private gym');
 const originView=await page.evaluate(()=>window.__GYM_QA_ATRIUM_EXIT__);assert.ok(originView);report.actualAtriumExit=originView;
 await camera(page,'private-gym',[0,1.65,11],[0,2.25,15]);
 const returnPoint=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,p=d.camera.position.clone().set(0,2.25,14.82).project(d.camera);return[(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];});await page.mouse.click(...returnPoint);
 await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==='atrium');
 const returned=await page.evaluate(()=>({position:window.__PALACE_DEBUG__.camera.position.toArray(),quaternion:window.__PALACE_DEBUG__.camera.quaternion.toArray()}));
 assert.ok(returned.position.every((n,i)=>Math.abs(n-originView.position[i])<.05));assert.ok(returned.quaternion.every((n,i)=>Math.abs(n-originView.quaternion[i])<.005));check('Native return before reload restores the actual atrium position and view');
 await page.mouse.click(...door);await ready(page);
 await page.getByRole('button',{name:'房间全景',exact:true}).click();await page.waitForTimeout(200);const wide=await readView(page),frozenView=await read(page);await page.screenshot({path:path.join(out,'native-room-view.jpg'),type:'jpeg',quality:90});
 await page.getByRole('button',{name:'看清动作',exact:true}).click();await page.waitForTimeout(200);const detail=await readView(page),afterView=await read(page);assert.ok(detail.span>wide.span*1.45);for(const key of['phase','elapsed','reps'])assert.equal(afterView[key],frozenView[key]);await page.screenshot({path:path.join(out,'native-detail-view.jpg'),type:'jpeg',quality:90});report.observationViews={wide,detail};check('Native detail button enlarges the real trainer without changing the paused exercise');
 await page.getByRole('button',{name:'房间全景',exact:true}).click();await page.waitForTimeout(150);const overview=await readView(page);assert.ok(overview.position.every((n,i)=>Math.abs(n-wide.position[i])<1e-6));assert.ok(overview.quaternion.every((n,i)=>Math.abs(n-wide.quaternion[i])<1e-6));await page.getByRole('button',{name:'看清动作',exact:true}).click();await page.waitForTimeout(150);const beforeWalk=await readView(page);await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');const afterWalk=await readView(page);assert.ok(Math.hypot(afterWalk.position[0]-beforeWalk.position[0],afterWalk.position[2]-beforeWalk.position[2])>.1);await page.getByRole('button',{name:'看清动作',exact:true}).click();await page.waitForTimeout(150);check('Native overview round trip is exact and free walking still works after observing');
 const initial=await page.evaluate(()=>{const key='memory-palace:athlete-appearance:v1',raw=localStorage.getItem(key);return{appearance:raw,urls:window.__GYM_QA_URLS__.read()};});
 if(process.env.PALACE_LOCAL_AVATAR==='1'){report.localPhotoReference=await page.evaluate(()=>{let loaded=false;window.__PALACE_DEBUG__.scene.getObjectByName('private-gym-trainer').traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.map?.image?.src?.includes('/personal-media/avatar-head.png'))loaded=true;});return loaded;});assert.equal(report.localPhotoReference,true);}
 for(const title of ids){
  await page.getByRole('group',{name:'训练动作',exact:true}).getByRole('button',{name:title,exact:true}).click();
  if(await page.getByRole('button',{name:'开始训练',exact:true}).isVisible())await page.getByRole('button',{name:'开始训练',exact:true}).click();
  await page.waitForFunction(()=>{const p=window.__PALACE_DEBUG__.scene.getObjectByName('private-gym-trainer').userData.fitness;return p.transition===1&&p.phase>.15&&p.phase<.34;});
  if(title===ids[0]){const active=await read(page);await page.getByRole('button',{name:'房间全景',exact:true}).click();await page.getByRole('button',{name:'看清动作',exact:true}).click();await page.waitForTimeout(150);const continued=await read(page);assert.equal(continued.exercise,active.exercise);assert.ok(continued.elapsed>=active.elapsed&&continued.reps>=active.reps);assert.equal(continued.running,true);check('Native camera buttons preserve the running exercise and accumulated progress');}
  await page.screenshot({path:path.join(out,'exercise-'+ids.indexOf(title)+'.jpg'),type:'jpeg',quality:90});
  const sample=await page.evaluate(async()=>{const root=window.__PALACE_DEBUG__.scene.getObjectByName('private-gym-trainer'),start=performance.now(),rows=[];await new Promise(resolve=>{const tick=()=>{rows.push(structuredClone(root.userData.fitness));if(performance.now()-start>4700)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});return rows;});
  assert.ok(sample.length>20&&sample.every(s=>Object.values(s.metrics).every(n=>Number.isFinite(n)&&n<.035)),title+': actual production rig contacts remain within 3.5cm');
  if(title==='平板支撑')assert.ok(sample.at(-1).elapsed>sample[0].elapsed+2&&sample.at(-1).reps===0);else assert.ok(sample.at(-1).reps>=sample[0].reps+1,title+': native full-cycle repetition observed');
  await page.getByRole('button',{name:'暂停训练',exact:true}).click();const paused=await read(page);await page.waitForTimeout(350);const after=await read(page);assert.equal(after.phase,paused.phase);assert.equal(after.elapsed,paused.elapsed);assert.equal(after.reps,paused.reps);
  report.exercises.push({title,samples:sample.length,reps:after.reps,maximumContactError:Math.max(...sample.flatMap(s=>Object.values(s.metrics))),paused:true});
 }
 check('All seven native exercise choices, actual full cycles, repetition/plank timing and exact pause');
 await page.getByRole('combobox',{name:'训练节奏',exact:true}).selectOption('1.5');const speed=await read(page);await page.getByRole('button',{name:'开始训练',exact:true}).click();await page.waitForTimeout(300);assert.equal((await read(page)).speed,1.5);assert.ok((await read(page)).elapsed>=speed.elapsed);check('Native speed control keeps the existing elapsed phase');
 await openMedia(page);const frozen=await read(page);await page.waitForTimeout(300);assert.equal((await read(page)).elapsed,frozen.elapsed);check('Opening the local archive freezes training');
 const photo=await fixture(page),video=await fixture(page,true);
 await importMedia(page,'QA-训练照片.png','image/png',photo);await importMedia(page,'QA-训练视频.webm','video/webm',video);assert.equal(await page.locator('.gym-media-list li').count(),2);
 await mediaDialog(page).getByRole('button',{name:'选到屏幕',exact:true}).click();await mediaDialog(page).getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'播放视频',exact:true}).waitFor();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='播放视频')?.disabled);await page.getByRole('button',{name:'播放视频',exact:true}).click();
 await page.waitForFunction(()=>{let playing=false;window.__PALACE_DEBUG__.scene.getObjectByName('private-gym-local-media').traverse(o=>{if(o.material?.map?.isVideoTexture&&o.material.map.image.currentTime>.2&&!o.material.map.image.paused)playing=true;});return playing;});
 await page.screenshot({path:path.join(out,'local-photo-video.jpg'),type:'jpeg',quality:90});check('Native local PNG/WebM import and actual video-texture playback');
 await page.reload();await ready(page);await enterIfNeeded(page);await openMedia(page);assert.equal(await page.locator('.gym-media-list li').count(),2);check('Both original media records persist through a real reload');
 for(const title of ['QA-训练照片','QA-训练视频'])await mediaDialog(page).getByRole('button',{name:'删除 '+title,exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.gym-media-list li').length===0);
 const counts=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('memory-palace-private-gym',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,names=['media','originals','thumbnails'],tx=db.transaction(names,'readonly'),counts={};for(const name of names){const q=tx.objectStore(name).count();q.onsuccess=()=>counts[name]=q.result;}tx.oncomplete=()=>{db.close();resolve(counts);};};}));
 assert.deepEqual(counts,{media:0,originals:0,thumbnails:0});check('Precise delete removes only the chosen metadata, original and thumbnail');
 await mediaDialog(page).getByRole('button',{name:'Close',exact:true}).click();await camera(page,'private-gym',[0,1.65,11],[0,2.25,15]);
 const exit=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,p=d.camera.position.clone().set(0,2.25,14.82).project(d.camera);return[(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];});await page.mouse.click(...exit);
 await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==='atrium');await page.waitForTimeout(350);
 const afterLeave=await page.evaluate(()=>({appearance:localStorage.getItem('memory-palace:athlete-appearance:v1'),urls:window.__GYM_QA_URLS__.read(),position:window.__PALACE_DEBUG__.camera.position.toArray()}));
 assert.equal(afterLeave.appearance,initial.appearance);assert.equal(afterLeave.urls.active.length,0);assert.ok(afterLeave.position.every((n,i)=>Math.abs(n-[0,1.65,23][i])<.05));check('After reload the native exit reaches the default atrium; appearance stays unchanged and owned blob URLs are released');
 await context.close();
 const denied=await contextFor({width:1920,height:1080},true),dp=await denied.newPage();attachErrors(dp);dp.setDefaultTimeout(90000);await dp.goto(base+'/private-gym');await ready(dp);await enterIfNeeded(dp);await openMedia(dp);await importMedia(dp,'QA-未保存.png','image/png',photo);
 assert.ok((await mediaDialog(dp).innerText()).includes('本次会话'));assert.equal(await dp.locator('.gym-media-list li').count(),1);await dp.reload();await ready(dp);await enterIfNeeded(dp);await openMedia(dp);assert.equal(await dp.locator('.gym-media-list li').count(),0);check('Denied IndexedDB retains the current-session file with an honest unsaved notice and no false refresh persistence');await denied.close();
 const mobile=await contextFor({width:390,height:844}),mp=await mobile.newPage();attachErrors(mp);mp.setDefaultTimeout(90000);await mp.goto(base+'/private-gym');await ready(mp);assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mp.screenshot({path:path.join(out,'mobile-390-room.png')});await mp.getByRole('button',{name:'看清动作',exact:true}).click();await mp.waitForTimeout(250);const portrait=await readView(mp);assert.ok(portrait.points.every(p=>Math.abs(p[0])<.98&&Math.abs(p[1])<.98));assert.equal(await mp.getByRole('button',{name:'房间全景',exact:true}).isVisible(),true);await mp.screenshot({path:path.join(out,'mobile-390-near-room.png')});check('Portrait native detail framing fits actual trainer points and remains available with collapsed controls');await mp.getByRole('button',{name:'展开训练控制',exact:true}).click();assert.equal(await mp.getByRole('group',{name:'训练动作',exact:true}).getByRole('button').count(),7);await mp.screenshot({path:path.join(out,'mobile-390.png')});check('390×844 room, collapsible controls and seven choices have no horizontal overflow');await mobile.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);assert.deepEqual(await hashes(),sourceHashes,'Gym source changed during native verification');report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);if(latestPage&&!latestPage.isClosed()){await latestPage.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});report.lastState=await latestPage.evaluate(()=>({room:window.__PALACE_DEBUG__?.roomId,position:window.__PALACE_DEBUG__?.camera.position.toArray(),pendingDoor:window.__PALACE_DEV__?.state.getState().pendingDoor,hidden:document.hidden,focused:document.hasFocus(),text:document.body.innerText})).catch(()=>null);}}
finally{report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,exercises:report.exercises.length,out}));
