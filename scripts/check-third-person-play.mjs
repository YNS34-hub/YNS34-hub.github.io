import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base=process.env.PALACE_URL||"http://127.0.0.1:5190",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/third-person/play");await mkdir(out,{recursive:true});
const report={baseline:"e9a3b43e17e659b5021d00eade3c9370673e7558",sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:!!execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim(),checkedAt:new Date().toISOString(),base,quality:"medium",dpr:1,scope:"Native keyboard / buttons; declared camera staging positions only. Physics, speed, cadence and scores are never injected.",checks:[],frames:[],errors:[],uploads:[]};
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:process.env.PALACE_HEADED!=="1",args:["--use-angle=d3d11"]});report.browser=browser.version();
let page;
try{
 for(const width of[1920,2560].filter(w=>!process.env.PALACE_CAPTURE_WIDTH||w===Number(process.env.PALACE_CAPTURE_WIDTH))){
  const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1,...(process.env.PALACE_VIDEO==="1"?{recordVideo:{dir:out,size:{width:1920,height:1080}}}:{})});
  await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
  await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
  page=await context.newPage();page.setDefaultTimeout(90000);page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});page.on("request",r=>{if(r.method()==="POST")report.uploads.push(r.url());});
  const ready=async room=>{await page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&window.__PALACE_DEV__?.state.getState().roomId===room&&document.querySelector(".world-ready")&&window.__PALACE_DEV__?.library.getState().ready,room);await page.waitForTimeout(600);};
  const goto=async room=>{await page.goto(base+"/"+room+"?view=third");await ready(room);};
  const pose=async(position,target)=>{await page.evaluate(({position,target})=>{const {presence}=window.__PRESENCE_DEBUG__,s=window.__PALACE_DEV__.state.getState(),c=presence.camera;c.position.set(...position);c.lookAt(...target);s.update({returnView:{roomId:s.roomId,position:c.position.toArray(),quaternion:c.quaternion.toArray()},travelSequence:s.travelSequence+1});},{position,target});await page.waitForFunction(()=>!window.__PRESENCE_DEBUG__.activity.getState().warming);await page.waitForTimeout(150);};
  const read=()=>page.evaluate(()=>{const {presence,perspective,activity,ride}=window.__PRESENCE_DEBUG__;return{body:presence.camera.position.toArray(),view:perspective.getState().views[window.__PALACE_DEV__.state.getState().roomId],speed:presence.speed,jump:presence.jump,finish:presence.finish,activity:activity.getState(),ride:ride.getState(),road:window.__ROAD_DEBUG__?.view,avatar:window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete")?.visible};});
  const frame=async name=>{const file=`${width}-${name}.png`;await page.screenshot({path:path.join(out,file)});report.frames.push({file,width,state:await read()});};
  const pickup=async()=>{await page.getByRole("button",{name:"R · Recall ball",exact:true}).click();await page.getByRole("button",{name:"E · Pick up nearby ball",exact:true}).click();await page.getByRole("button",{name:"E · Dribble",exact:true}).waitFor();};

  await goto("basketball");await frame("court-third-entry");assert.equal((await read()).avatar,true);
  const initial=(await read()).body;await page.getByRole("button",{name:"First person",exact:true}).click();await page.waitForTimeout(600);assert.deepEqual((await read()).body,initial);assert.equal((await read()).avatar,false);await frame("court-first-preserved");
  await page.keyboard.press("v");assert.equal((await read()).view,"third");
  await pose([0,1.65,8],[0,2,-12.1]);await pickup();await page.keyboard.down("Shift");await page.keyboard.down("w");const runSample=await page.waitForFunction(()=>{const{presence,activity}=window.__PRESENCE_DEBUG__;return presence.speed>4.5&&activity.getState().dribbling?{speed:presence.speed,dribbling:activity.getState().dribbling}:false;});
  const running=await runSample.jsonValue();assert.ok(running.speed>4.5);assert.equal(running.dribbling,true);await frame("court-sprint-dribble");await page.keyboard.up("w");await page.keyboard.up("Shift");
  await pose([-.35,1.65,-9.5],[0,3.05,-12.1]);await page.waitForTimeout(150);const beforeLayup=(await read()).activity;
  await page.keyboard.press("f");await page.waitForTimeout(360);await frame("court-layup");
  await page.waitForFunction(n=>window.__PRESENCE_DEBUG__.activity.getState().made===n,beforeLayup.made+1);assert.equal((await read()).activity.shots,beforeLayup.shots+1);await page.waitForTimeout(600);
  await pickup();await pose([-.35,1.65,-8.3],[0,3.05,-12.1]);await page.keyboard.down("Shift");await page.keyboard.down("w");await page.waitForFunction(()=>{const{presence}=window.__PRESENCE_DEBUG__;return presence.speed>3&&presence.camera.position.z<-9.5;});
  const beforeDunk=(await read()).activity;await page.keyboard.press("g");await page.keyboard.up("w");await page.keyboard.up("Shift");await page.waitForTimeout(480);await frame("court-dunk");
  await page.waitForFunction(n=>window.__PRESENCE_DEBUG__.activity.getState().made===n,beforeDunk.made+1);assert.equal((await read()).activity.shots,beforeDunk.shots+1);await page.waitForTimeout(600);
  await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.finish==="idle"&&window.__PRESENCE_DEBUG__.presence.shot===0);
  assert.ok(await page.evaluate(()=>{const root=window.__PALACE_DEBUG__.scene.getObjectByName("visitor-athlete"),hand=root.getObjectByName("Bip01_R_Hand"),point=hand.position.clone();hand.getWorldPosition(point);return point.y-root.position.y<1.65;}),"Finishing IK must settle back to the underlying idle arm pose");
  await pickup();await page.waitForTimeout(400);await page.keyboard.press("g");assert.match((await read()).activity.result,/run-up/);
  await page.keyboard.press("f");await page.waitForTimeout(150);await page.locator(".guide-button").click();const paused=await read();await page.waitForTimeout(500);assert.equal((await read()).jump,paused.jump);assert.equal((await read()).activity.shots,paused.activity.shots);await page.keyboard.press("Escape");await page.waitForTimeout(1600);
  await page.goto(base+"/basketball");await ready("basketball");assert.equal((await read()).view,"third");
  await pose([0,1.65,13.8],[0,2.4,17.2]);await page.locator(".interaction-hint").filter({hasText:"Back to the palace"}).waitFor();await page.keyboard.press("e");await ready("worlds");
  report.checks.push({width,name:"Court: first/third, real sprint dribble, layup, running dunk, invalid dunk feedback, action pause/resume, refresh preference, physical return"});

  for(const room of["cycling","alpine-ride"]){
   await goto(room);
   const view=(await read()).road;await pose([view.walkX+3.2,view.walkY+1.77,view.walkZ-1.2],[view.walkX,view.walkY+1.5,view.walkZ-12]);
   await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled);await page.getByRole("button",{name:"Mount / ride · E"}).click();
   await page.waitForFunction(()=>{const p=window.__ROAD_DEBUG__?.view.mountProgress;return p>.1&&p<.95;});
   assert.ok(await page.evaluate(()=>{const s=window.__PALACE_DEBUG__.scene;return s.getObjectByName("visitor-athlete").position.distanceTo(s.getObjectByName("original-performance-road-bike").position)<.03;}),"Mount choreography keeps the rider and bicycle together");
   await page.waitForFunction(()=>window.__ROAD_DEBUG__?.view.mountProgress===1);await frame(room+"-third-still");
   await page.keyboard.down("w");await page.waitForTimeout(1800);const pedaling=await read();assert.ok(pedaling.ride.speed>.5);assert.ok(pedaling.road.cadence>0);assert.equal(pedaling.avatar,true);await frame(room+"-third-pedal");
   await page.keyboard.press("v");await page.waitForTimeout(600);const first=await read();assert.equal(first.view,"first");assert.equal(first.ride.mounted,true);assert.ok(first.ride.distance>=pedaling.ride.distance);assert.equal(first.avatar,false);await frame(room+"-first-preserved");
   await page.keyboard.press("v");await page.waitForTimeout(600);const phase=(await read()).road.pedalAngle;await page.waitForTimeout(500);assert.notEqual((await read()).road.pedalAngle,phase);
   await page.keyboard.press("q");await page.keyboard.press("e");await page.keyboard.up("w");await page.keyboard.down("s");await page.waitForFunction(()=>window.__ROAD_DEBUG__?.model.speed<.01);await page.keyboard.up("s");await frame(room+"-third-braked");
   await page.keyboard.press("p");await page.waitForFunction(()=>document.querySelector(".road-photo-tools"));await page.waitForTimeout(600);assert.equal((await read()).avatar,false);await frame(room+"-photo");await page.keyboard.press("Escape");await page.waitForTimeout(600);assert.equal((await read()).avatar,true);
   const lookBefore=await page.evaluate(()=>window.__PALACE_DEBUG__.camera.position.toArray());await page.mouse.move(width*.50,width===1920?590:780);await page.mouse.down();await page.mouse.move(width*.50+390,width===1920?420:610,{steps:12});await page.mouse.up();await page.waitForTimeout(700);const lookAfter=await page.evaluate(()=>window.__PALACE_DEBUG__.camera.position.toArray());assert.ok(Math.hypot(...lookAfter.map((v,i)=>v-lookBefore[i]))>.5);await frame(room+"-third-detail-angle");
   const beforeCinema=await read();await page.evaluate(()=>{const l=window.__PALACE_DEV__.library.getState();window.__PALACE_DEV__.state.getState().openCinema(l.wallpapers[0]||l.personal.visuals[0]);});await ready("cinema");await page.keyboard.press("Escape");await ready(room);
   const returned=await read();assert.equal(returned.ride.mounted,true);assert.equal(returned.view,"third");assert.ok(Math.abs(returned.road.distance-beforeCinema.road.distance)<.05);assert.ok(Math.hypot(...returned.body.map((v,i)=>v-beforeCinema.body[i]))<.06);
   await page.getByRole("button",{name:"Ride options",exact:true}).click();await page.getByRole("button",{name:"Dismount",exact:true}).click();assert.equal((await read()).ride.mounted,false);await frame(room+"-dismounted");await page.getByRole("button",{name:"Return to the Palace",exact:true}).click();await ready("worlds");
   report.checks.push({width,name:room+": third-person mount, cadence/feet, first-person toggle during movement, gears, brake, photo/ESC, Cinema exact pose/progress return, dismount, Palace return"});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(e){report.failure=e.stack;try{await page.screenshot({path:path.join(out,"failure.png")});report.diagnostic=await page.evaluate(()=>{const d=window.__PRESENCE_DEBUG__;return{text:document.body.innerText.slice(-2500),road:window.__ROAD_DEBUG__?.view,room:window.__PALACE_DEBUG__?.roomId,body:d?.presence.camera.position.toArray(),speed:d?.presence.speed,activity:d?.activity.getState()};});}catch{}console.error(e);process.exitCode=1;}
finally{await writeFile(path.join(out,"validation.json"),JSON.stringify(report,null,2));await browser.close();}
console.log(`Third-person play: ${report.checks.length} journeys · ${report.passed?"PASS":"FAIL"}`);
