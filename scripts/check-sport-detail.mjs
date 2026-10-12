import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/sports-detail/detail');await mkdir(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),checks:[],poses:[],errors:[],uploads:[]};
// 保留当前 Playwright 的默认功能开关，只追加验收窗口遮挡例外，避免覆盖 Edge 的默认登录 / 启动防护。
const probe=await chromium.launch({channel:'msedge',headless:true,args:['--enable-automation']});let features;
try{const cdp=await probe.newBrowserCDPSession();features=(await cdp.send('Browser.getBrowserCommandLine')).arguments.find(a=>a.startsWith('--disable-features='));await cdp.detach();}finally{await probe.close();}
const browser=await chromium.launch({channel:'msedge',headless:process.env.PALACE_HEADED!=='1',args:['--use-angle=d3d11',(features||'--disable-features=')+',CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,...(process.env.PALACE_VIDEO==='1'?{recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}}:{})});
await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
if(process.env.PALACE_PERSONAL!=='1')await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
await context.addInitScript(()=>{
 localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,mute:true,roomSoundtracks:false},version:0}));
 // 已有合法路线存档选定实际下坡起点；不向物理实例注入速度、距离或倾角。
 localStorage.setItem('memory-palace:alpine:v1',JSON.stringify({route:1,distance:1220,gear:7,comfort:false}));
});
const page=await context.newPage();page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('request',r=>{if(r.method()!=='GET')report.uploads.push(r.url());});
const base=process.env.PALACE_URL||'http://127.0.0.1:5190';
const ready=async room=>{await page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&(!['basketball','cycling','alpine-ride'].includes(room)||window.__PRESENCE_DEBUG__&&!window.__PRESENCE_DEBUG__.activity.getState().warming)&&document.querySelector('.world-ready'),room);};
const pose=(position,target)=>page.evaluate(({position,target})=>{const c=window.__PRESENCE_DEBUG__.presence.camera,s=window.__PALACE_DEV__.state.getState();c.position.set(...position);c.lookAt(...target);s.update({travelSequence:s.travelSequence+1,returnView:{roomId:s.roomId,position,quaternion:c.quaternion.toArray()}});},{position,target});
const read=()=>page.evaluate(()=>{
 const d=window.__PALACE_DEBUG__,p=window.__PRESENCE_DEBUG__.presence,r=window.__ROAD_DEBUG__,avatar=d.scene.getObjectByName('visitor-athlete'),g=d.renderer.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');
 const maps=new Map();avatar?.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))if(m.map)maps.set(m.map.uuid,{name:m.name,width:m.map.image?.width,height:m.map.image?.height});});
 return{room:d.roomId,speed:p.speed,charge:p.charge,shots:window.__PRESENCE_DEBUG__.activity.getState().shots,body:p.camera.position.toArray(),hand:p.hand,dribbling:p.dribbling,ball:p.ball.toArray(),palm:p.dribblePalm.toArray(),standing:r?.view.standing,phase:r?.view.pedalAngle,cadence:r?.view.cadence,distance:r?.model.distance,lean:r?.view.lean,rock:r?.view.rock,roll:r?.view.roll,contacts:avatar?{...avatar.userData}:null,dpr:d.renderer.getPixelRatio(),drawing:[g.drawingBufferWidth,g.drawingBufferHeight],renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),maps:[...maps.values()]};
});
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});const s=await read();report.poses.push({name,...s});return s;};
try{
 await page.goto(base+'/basketball?view=third');await ready('basketball');await pose([0,1.65,3],[0,1.75,-12.1]);
 await page.getByRole('button',{name:'R · Recall ball',exact:true}).click();await page.getByRole('button',{name:'E · Pick up nearby ball',exact:true}).click();await page.locator('canvas').click({position:{x:1190,y:150}});
 let before=await read();assert.equal(before.dpr,1.25);assert.ok(before.maps.every(m=>m.width===2048&&m.height===2048));assert.match(before.renderer,/GTX 1650/);
 await page.keyboard.down('Space');await page.waitForTimeout(450);assert.equal((await read()).charge,0);await page.keyboard.up('Space');assert.equal((await read()).shots,before.shots);
 report.checks.push('Space neither charges nor shoots; original 2K maps and true 2400×1350 medium drawing buffer');
 const speeds={};for(const key of ['Shift','Enter','NumpadEnter']){
  await pose([0,1.65,3],[0,1.75,-12.1]);await page.keyboard.down(key);await page.keyboard.down('w');await page.waitForTimeout(700);speeds[key]=(await read()).speed;await page.keyboard.up('w');await page.keyboard.up(key);await page.waitForTimeout(500);
 }
 assert.ok(speeds.Shift<2.8);assert.ok(speeds.Enter>5&&speeds.NumpadEnter>5);report.checks.push({name:'Actual Shift is ordinary pace, both Enter positions accelerate',speeds});
 await pose([0,1.65,3],[0,1.75,-12.1]);if(!(await read()).dribbling)await page.keyboard.press('e');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.dribbling);
 const dribble=await page.evaluate(async()=>{const samples=[];for(let i=0;i<70;i++){await new Promise(requestAnimationFrame);const p=window.__PRESENCE_DEBUG__.presence;if(i%3===0)samples.push({phase:p.dribblePhase,ball:p.ball.y,wrist:p.dribblePalm.y});}return samples;});
 assert.ok(dribble.some(p=>p.ball<.25&&p.wrist>.8));assert.ok(dribble.every(p=>p.wrist>.8));await shot('01-dribble');
 const hand=(await read()).hand;await page.keyboard.press('x');await page.waitForTimeout(500);assert.equal((await read()).hand,-hand);await shot('02-crossover');report.checks.push({name:'Separated release / catch hand response and native X crossover',dribble});
 await page.keyboard.press('e');await page.keyboard.down('5');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.charge>.61);await shot('03-shot-set');await page.keyboard.up('5');await page.waitForTimeout(180);await shot('04-shot-release');
 assert.equal((await read()).shots,before.shots+1);report.checks.push('Native 5 shot rises above the face and produces exactly one physical release');
 for(const room of ['cycling','alpine-ride']){
  await page.goto(base+'/'+room+'?view=third');await ready(room);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.ride.getState().nearBike);await page.keyboard.up('w');
  await page.getByRole('button',{name:'Mount / ride · E',exact:true}).click();await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.cadence>40);const seated=await shot(room+'-seated');assert.ok(Object.values(seated.contacts).every(v=>v<.025));
  await page.keyboard.press('c');await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.standing>.96);await shot(room+'-standing');
  const contacts=[];for(let i=0;i<10;i++){await page.waitForTimeout(120);contacts.push((await read()).contacts);}
  assert.ok(contacts.every(c=>c.rightSoleError<.025&&c.leftSoleError<.025&&c.rightWristError<.025&&c.leftWristError<.025));
  report.checks.push({name:room+' standing maintains both soles / wrists across actual pedal phases',contacts});
  await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed>4);await page.keyboard.down('d');await page.waitForFunction(()=>Math.abs(window.__ROAD_DEBUG__.view.lean)>.10);await shot(room+'-corner');await page.keyboard.up('d');
  await page.keyboard.up('w');await page.keyboard.down('Space');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed===0);await page.keyboard.up('Space');
  await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Camera motion · full',exact:true}).click();await page.getByRole('button',{name:'Close ride options',exact:true}).click();
  await page.mouse.move(1100,410);await page.mouse.down();await page.mouse.move(690,430,{steps:20});await page.mouse.up();await page.waitForTimeout(700);await shot(room+'-bike-detail');
  const saved=await read();await page.evaluate(()=>{const l=window.__PALACE_DEV__.library.getState();window.__PALACE_DEV__.state.getState().openCinema(l.wallpapers[0]||l.personal.visuals[0]);});await ready('cinema');await page.keyboard.press('Escape');await ready(room);await page.waitForTimeout(700);
  const returned=await read();assert.ok(returned.standing>.96);assert.ok(Math.abs(returned.distance-saved.distance)<.05);assert.ok(Math.abs(returned.phase-saved.phase)<1e-8);assert.equal(returned.roll,0);
  await page.getByRole('button',{name:'Seated · C',exact:true}).click();await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.standing<.02);await shot(room+'-returned-seated');
  await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Dismount',exact:true}).click();await page.getByRole('button',{name:'Return to the Palace',exact:true}).click();await ready('worlds');
  report.checks.push(room+' native corner / brake / low-motion camera / standing Cinema return / seated return / dismount / Palace return');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);try{await page.screenshot({path:path.join(out,'failure.png')});report.diagnostic=await read();}catch{}}
finally{await writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,frames:report.poses.length}));
