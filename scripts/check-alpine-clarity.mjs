import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const base=process.env.PALACE_URL||'http://127.0.0.1:5190',out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/alpine-sun-rider/native');
await mkdir(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),base,checks:[],errors:[],uploads:[],poses:[]};
const browser=await chromium.launch({channel:'msedge',headless:false,args:['--use-angle=d3d11','--disable-features=CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,...(process.env.PALACE_VIDEO==='1'?{recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}}:{})});
await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'high',tutorialDone:true,roomSoundtracks:false},version:0})));
// 使用有效的既有路线存档起点观察真实下坡滑行，不在行进中注入位置 / 速度。
await context.addInitScript(()=>{if(!localStorage.getItem('memory-palace:alpine:v1'))localStorage.setItem('memory-palace:alpine:v1',JSON.stringify({route:1,distance:1220,gear:7,comfort:false}));});
const page=await context.newPage();page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(['POST','PUT'].includes(r.method()))report.uploads.push(r.url());});
const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
const status=()=>page.locator('.road-status');
const ready=async()=>{await page.locator('.world-ready canvas').waitFor();await status().waitFor();await page.bringToFront();};
const state=()=>page.evaluate(()=>{
  const d=window.__PALACE_DEBUG__,r=window.__ROAD_DEBUG__,gl=d.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info'),avatar=d.scene.getObjectByName('visitor-athlete');
  const bones={};if(avatar)for(const name of ['Bip01_R_Thigh','Bip01_R_Calf','Bip01_R_Foot','Bip01_L_Thigh','Bip01_L_Calf','Bip01_L_Foot','Bip01_R_Hand','Bip01_L_Hand']){const b=avatar.getObjectByName(name);bones[name]=avatar.worldToLocal(b.getWorldPosition(d.camera.position.clone())).toArray();}
  const ink=[];avatar?.traverse(o=>{if(o.name.startsWith('rider-outline:'))ink.push({visible:o.visible,shared:o.geometry===o.parent.geometry,skeleton:o.skeleton===o.parent.skeleton});});
  return {room:d.roomId,distance:r.model.distance,speed:r.model.speed,cadence:r.view.cadence,phase:r.view.pedalAngle,bones,ink,dpr:d.renderer.getPixelRatio(),width:d.renderer.domElement.width,height:d.renderer.domElement.height,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
});
try{
  await page.goto(base+'/alpine-ride?view=first');await ready();
  await page.keyboard.down('w');await page.waitForFunction(()=>!document.querySelector('.road-mount')?.disabled);await page.keyboard.up('w');
  await page.getByRole('button',{name:'Mount / ride · E',exact:true}).click();
  await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1);report.checks.push('Native walk / mount');
  await page.getByRole('button',{name:'Third person · V',exact:true}).click();
  await page.mouse.move(1050,410);await page.mouse.down();await page.mouse.move(720,430,{steps:24});await page.mouse.up();
  await page.waitForTimeout(600);let current=await state();assert.equal(current.dpr,1.5);assert.match(current.renderer,/GTX 1650/);assert.ok(current.ink.length&&current.ink.every(x=>x.visible&&x.shared&&x.skeleton));
  await shot('01-seated-outline');report.checks.push('High resolution and exact skinned outline');
  // 真实键盘推进；采样跨多个曲柄相位，没有给模型注入角度、距离或速度。
  await page.keyboard.down('w');await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.cadence>20);
  for(let i=0;i<6;i++){await page.waitForTimeout(270);current=await state();assert.ok(Object.values(current.bones).flat().every(Number.isFinite));report.poses.push(current);await shot('02-pedal-'+i);}
  await page.waitForTimeout(3000);await page.keyboard.up('w');await page.waitForTimeout(2000);
  await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.cadence<.15);await page.waitForTimeout(1500);
  current=await state();assert.ok(current.cadence<.15);assert.ok(Math.abs(Math.sin(current.phase))<.02);await shot('03-coasting-level');report.checks.push('Real cadence / connected limb poses / shared coasting settle');
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed===0);await page.keyboard.up('Space');
  await page.getByRole('button',{name:'Ride options',exact:true}).click();
  await page.getByRole('button',{name:'天气 · 晴朗',exact:true}).click();await page.waitForTimeout(1600);await shot('04-valley-haze');
  await page.getByRole('button',{name:'画面 · 高清',exact:true}).click();await page.waitForTimeout(500);assert.ok(Math.abs((await state()).dpr-1)<.0001);
  await page.getByRole('button',{name:'人物描边 · 开',exact:true}).click();await page.waitForTimeout(250);assert.ok((await state()).ink.every(x=>!x.visible));
  await page.reload();await ready();
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('memory-palace:alpine-visuals:v1')));assert.deepEqual(persisted,{weather:'cloudy',detailed:false,outline:false});
  report.checks.push('Weather / native resolution / outline choices persist without altering ride save');
  // 刷新保持原步行恢复，不自动上车；恢复本次验收使用的晴天高清设置。
  await page.keyboard.down('w');await page.waitForFunction(()=>!document.querySelector('.road-mount')?.disabled);await page.keyboard.up('w');
  await page.getByRole('button',{name:'Mount / ride · E',exact:true}).click();await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1);
  await page.getByRole('button',{name:'Ride options',exact:true}).click();
  for(const name of ['天气 · 山谷薄雾','画面 · 原生','人物描边 · 关'])await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'Return to the Palace',exact:true}).click();await page.locator('.world-ready canvas').waitFor();
  assert.ok(Math.abs(await page.evaluate(()=>window.__PALACE_DEBUG__.renderer.getPixelRatio())-1)<.0001);await shot('05-return-native-dpr');report.checks.push('Return retains original museum resolution and controls');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(error){report.failure=error.stack;await shot('failure').catch(()=>{});process.exitCode=1;console.error(error.stack);}
finally{await writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2));await context.close();await browser.close();}
