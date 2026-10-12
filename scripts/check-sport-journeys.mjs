import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const base=process.env.PALACE_URL||'http://127.0.0.1:5190',out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/sports-detail/journeys');
const requested=(process.env.PALACE_MAPS||'cycling,alpine-ride').split(',');assert.ok(requested.length&&requested.every(room=>['cycling','alpine-ride'].includes(room)));
await mkdir(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Complete native continuous rides on both maps, medium 1920×1080, neutral public avatar. Real route / gear / cadence / scenery; no distance, velocity, camera or simulation injection. Functional journey evidence, not a hardware benchmark.',maps:[],errors:[],uploads:[]};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
const flush=()=>writeFile(path.join(out,'journeys.json'),JSON.stringify(report,null,2));
try{
 for(const room of requested){
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
  await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
  await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,roomSoundtracks:false},version:0})));
  const page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')report.uploads.push(r.url());});
  await page.goto(base+'/'+room+'?view=third');await page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&window.__ROAD_DEBUG__&&document.querySelector('.world-ready'),room);
  await page.keyboard.down('w');await page.waitForFunction(()=>!document.querySelector('.road-mount')?.disabled);await page.keyboard.up('w');
  await page.keyboard.press('e');await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1);
  await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Pedal continuously',exact:true}).click();
  const length=await page.evaluate(()=>window.__ROAD_DEBUG__.model.geography.length);
  // 高山线为约 10 km，55 km/h 的物理上限也至少要 11 分钟；按实测路线长度设预算，并单独检测停滞。
  const budget=Math.max(600000,(length/(55/3.6)*1.5+180)*1000);
  const route={room,length,budgetMs:budget,samples:[],contactMax:{},sectors:[],seconds:0};report.maps.push(route);const started=Date.now();let lastPrint=0,lastSwitch=0,lastProgress=started,lastDistance=0;
  // 每秒只读取诊断；切换骑姿用真实 C 键，路线与动力全部由现有控制器推进。
  while(Date.now()-started<budget){
   await page.waitForTimeout(1000);const value=await page.evaluate(()=>{const d=window.__ROAD_DEBUG__,a=window.__PALACE_DEBUG__.scene.getObjectByName('visitor-athlete');return{distance:d.model.distance,speed:d.model.speed,cadence:d.model.cadence,ended:d.model.ended,recovered:d.model.recovered,standing:d.view.standing,phase:d.view.pedalAngle,sectors:document.querySelector('.road-status').dataset.sectors.split(','),contacts:{...a.userData}};});
   route.lastSample=value;assert.ok(Number.isFinite(value.distance)&&Number.isFinite(value.phase));assert.equal(value.recovered,false);assert.ok(value.sectors.length<=6);
   if(value.distance>lastDistance+.01){lastDistance=value.distance;lastProgress=Date.now();}assert.ok(value.ended||Date.now()-lastProgress<45000,room+' must not stall');
   for(const sector of value.sectors)if(!route.sectors.includes(sector))route.sectors.push(sector);
   for(const [key,error]of Object.entries(value.contacts)){route.contactMax[key]=Math.max(route.contactMax[key]||0,error);assert.ok(error<.025,room+' '+key+' must stay within 2.5 cm');}
   if(Date.now()-lastPrint>30000||value.ended){lastPrint=Date.now();route.seconds=(Date.now()-started)/1000;route.samples.push({seconds:route.seconds,...value});await page.screenshot({path:path.join(out,room+'-'+route.samples.length+'.png')});await flush();console.log(room+': '+value.distance.toFixed(0)+' m / '+(value.speed*3.6).toFixed(0)+' km/h / '+(value.standing>.5?'standing':'seated'));}
   if(value.ended){assert.ok(Math.abs(value.distance-length)<.01);assert.ok(route.sectors.length>=18);route.passed=true;break;}
   if(Date.now()-lastSwitch>45000){lastSwitch=Date.now();await page.keyboard.press('c');}
  }
  assert.equal(route.passed,true,room+' must complete the real route');assert.deepEqual(Object.keys(route.contactMax).sort(),['leftSoleError','leftWristError','rightSoleError','rightWristError']);
  await page.keyboard.press('p');await page.getByRole('button',{name:'Exit photo view · ESC',exact:true}).waitFor();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Return to the Palace',exact:true}).click();await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==='worlds'&&document.querySelector('.world-ready'));route.returned=true;
  await context.close();await flush();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}finally{await flush();await browser.close();}
