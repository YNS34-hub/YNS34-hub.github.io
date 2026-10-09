import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {roadLength,roadStops} from "../src/worlds/road/route.ts";
const base=process.env.PALACE_URL||"http://127.0.0.1:5190",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/road-journey");
await mkdir(out,{recursive:true});
const report={sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),scope:"Continuous native keyboard/button ride; no camera or distance injection. One explicitly labelled invalid-state recovery fault follows the journey. Video is functional evidence, not GPU performance measurement.",checks:[],moments:[],samples:[],errors:[]};
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--use-angle=d3d11"]});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:path.join(out,"video"),size:{width:960,height:540}}});
await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false,mute:false},version:0})));
const page=await context.newPage();page.setDefaultTimeout(90000);let origin=Date.now();
page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
const flush=()=>writeFile(path.join(out,"journey.json"),JSON.stringify(report,null,2));
const read=()=>page.evaluate(()=>{const s=document.querySelector(".road-status")?.dataset,d=window.__ROAD_DEBUG__;return{s:s?{...s}:null,model:d?{distance:d.model.distance,speed:d.model.speed,gear:d.model.gear,cadence:d.model.cadence,grade:d.model.grade,steering:d.model.steering,offset:d.model.offset,recovered:d.model.recovered,ended:d.model.ended}:null,audio:d?.audio.debug(),camera:window.__PALACE_DEBUG__?.camera.position.toArray()};});
const mark=async name=>{const value=await read();report.moments.push({name,seconds:(Date.now()-origin)/1000,...value});await page.screenshot({path:path.join(out,name+".png")});await flush();console.log(name);};
const check=(name,condition=true)=>{assert.ok(condition,name);report.checks.push(name);};
const options=()=>page.getByRole("button",{name:"Ride options",exact:true}).click();
const continuous=async()=>{await options();await page.getByRole("button",{name:"Pedal continuously",exact:true}).click();};
try{
 await page.goto(base+"/worlds/");await page.locator(".world-ready canvas").waitFor();origin=Date.now();await mark("01-museum-threshold");
 await page.evaluate(()=>window.__PALACE_DEV__.state.getState().enterRoom("cycling"));await page.locator(".road-mount").waitFor();await page.locator(".world-ready canvas").waitFor();await mark("02-nature-threshold");
 check("Enter from the museum on foot",(await read()).s.mounted==="false");
 await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled,{},{timeout:10000});await page.keyboard.up("w");await mark("03-approach-road-bike");
 await page.keyboard.press("e");await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.state!=="mounting"&&document.querySelector(".road-status")?.dataset.mounted==="true");check("Native approach and E mount");await mark("04-mounting-settled");
 await page.keyboard.down("w");await page.waitForTimeout(5500);await page.keyboard.down("d");await page.waitForTimeout(600);const low=(await read()).model.steering;await page.keyboard.up("d");check("Low-speed steering has real authority",low>.015);
 await page.waitForFunction(()=>window.__ROAD_DEBUG__?.model.speed>6&&window.__ROAD_DEBUG__?.model.cadence>70,{},{timeout:30000});const pedal=await read();check("Genuine acceleration and cadence",pedal.model.speed>6&&pedal.model.cadence>70);await mark("05-acceleration-and-gear");await page.keyboard.up("w");
 // 监听实际已解锁的原 AudioContext 旁路，不建立第二个引擎、不录入用户歌曲。
 await page.evaluate(()=>{const bus=window.__ROAD_DEBUG__.audio.monitor(),ctx=bus.context,dest=ctx.createMediaStreamDestination(),analyser=ctx.createAnalyser();bus.connect(dest);bus.connect(analyser);const recorder=new MediaRecorder(dest.stream),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();window.__ROAD_QA__={bus,dest,analyser,recorder,chunks};});
 await page.waitForTimeout(2500);const coast=await read();check("Coasting preserves momentum and starts wheel-speed freehub",coast.model.speed>pedal.model.speed*.75&&coast.audio.freehub&&coast.audio.chain===0);await mark("06-coasting-freehub");
 const rms=await page.evaluate(()=>{const a=window.__ROAD_QA__.analyser,p=new Float32Array(a.fftSize);a.getFloatTimeDomainData(p);return Math.sqrt(p.reduce((s,v)=>s+v*v,0)/p.length);});check("Real native Web Audio produces nonzero samples",rms>.0005);
 await page.keyboard.down("w");await page.waitForTimeout(700);check("Pedaling removes freehub",!(await read()).audio.freehub);await page.keyboard.up("w");
 const audio=await page.evaluate(async()=>{const q=window.__ROAD_QA__;await new Promise(r=>{q.recorder.onstop=r;q.recorder.stop();});const b=new Blob(q.chunks,{type:"audio/webm"});const data=await b.arrayBuffer();q.bus.disconnect(q.dest);q.bus.disconnect(q.analyser);return Array.from(new Uint8Array(data));});await writeFile(path.join(out,"actual-coast-pedal.webm"),Buffer.from(audio));report.realAudioRms=rms;
 await page.keyboard.press("q");check("Shift easier",(await read()).model.gear===6);await page.keyboard.press("e");check("Shift harder",(await read()).model.gear===7);
 await page.keyboard.down("s");await page.waitForTimeout(6500);await page.keyboard.up("s");check("Progressive braking reaches a stop",(await read()).model.speed===0);await mark("07-braking-settled");
 await page.keyboard.press("p");await page.getByRole("button",{name:"Save this view",exact:true}).waitFor();const download=page.waitForEvent("download");await page.getByRole("button",{name:"Save this view",exact:true}).click();await(await download).saveAs(path.join(out,"local-photo.png"));await page.keyboard.press("Escape");check("Photo mode creates a local PNG and Escape handles only that layer",(await read()).s.photo==="false");
 await options();await page.getByRole("button",{name:"Camera motion · full",exact:true}).click();await page.getByRole("button",{name:"Sound on",exact:true}).click();check("Comfort and sound-off acknowledge their state",await page.getByRole("button",{name:"Sound off",exact:true}).isVisible());await page.getByRole("button",{name:"Sound off",exact:true}).click();await page.getByRole("button",{name:"Camera motion · reduced",exact:true}).click();await page.getByRole("button",{name:"Stop at next viewpoint",exact:true}).click();
 const start=Date.now();let shore=false,climb=false,crest=false,descent=false,fast=false,lastPrint=0,visited=new Set(),coasted=false;
 while(Date.now()-start<540000){
  await page.waitForTimeout(1000);const v=await read();assert.ok(v.model);for(const sector of v.s.sectors.split(","))visited.add(sector);checkBound(v.s.sectors);
  if(!shore&&v.s.state==="scenic-stop"){
   shore=true;check("Actual gradual stop at the lake viewpoint",Math.abs(v.model.distance-roadStops[0].distance)<4);await mark("08-lake-scenic-stop");
   await page.keyboard.press("p");await page.getByRole("button",{name:"Save this view",exact:true}).waitFor();await mark("09-scenic-photo-view");await page.keyboard.press("Escape");await continuous();
  }
  if(!climb&&v.model.grade>.05&&v.model.distance>roadLength*.25){climb=true;check("Climb is a real positive grade and lower-gear effort",v.model.speed>0);await mark("10-real-climb");}
  if(!crest&&v.model.distance>roadLength*.484){crest=true;await mark("11-crest-reveal");}
  if(crest&&!coasted&&v.model.distance>roadLength*.49){coasted=true;await options();await page.getByRole("button",{name:"Coast freely",exact:true}).click();await page.waitForTimeout(2200);await mark("12-crest-coast");await continuous();}
  if(!descent&&v.model.grade<-.04&&v.model.distance>roadLength*.53){descent=true;await options();await page.getByRole("button",{name:"Coast freely",exact:true}).click();await page.waitForTimeout(3500);await mark("13-gravity-descent");await continuous();await page.waitForFunction(()=>window.__ROAD_DEBUG__?.audio.debug()?.wind>0);check("Gravity and wind contribute on descent",(await read()).audio.wind>0);}
  if(!fast&&v.model.speed>11&&v.model.distance>roadLength*.55){fast=true;await page.keyboard.down("d");await page.waitForTimeout(700);const high=(await read()).model.steering;await page.keyboard.up("d");check("High-speed steering is smaller than low-speed authority",Math.abs(high)<low);await mark("14-fast-cornering");}
  if(Date.now()-lastPrint>15000){lastPrint=Date.now();report.samples.push({seconds:(Date.now()-start)/1000,...v});await flush();console.log((v.model.distance/roadLength*100).toFixed(0)+"% / "+(v.model.speed*3.6).toFixed(0)+" km/h / "+v.s.state);}
  if(v.model.ended)break;
 }
 const end=await read();check("Continuous full route finishes without teleport or infinite loading",end.model.ended);report.journeySeconds=(Date.now()-start)/1000;check("Bounded streaming traverses the full authored geography",visited.size>=18&&Number(end.s.sectors.split(",").length)<=6);await mark("15-last-road-stop");
 // 通过原 Cinema API 验证同次访问原位返回；不会改动 Cinema 数据或导航。
 const before=await read();await page.evaluate(()=>{const lib=window.__PALACE_DEV__.library.getState();window.__PALACE_DEV__.state.getState().openCinema(lib.wallpapers[0]);});await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==="cinema"&&document.querySelector(".world-ready"));await page.evaluate(()=>window.__PALACE_DEV__.state.getState().exitCinema());await page.locator(".road-status").waitFor({state:"attached"});await page.locator(".world-ready canvas").waitFor();await page.waitForTimeout(600);
 const after=await read();check("Cinema restores road posture, distance and spatial position",after.s.mounted==="true"&&Math.abs(after.model.distance-before.model.distance)<.05&&after.camera.every((n,i)=>Math.abs(n-before.camera[i])<.08));await mark("16-cinema-return");
 await page.evaluate(()=>window.__ROAD_DEBUG__.model.distance=NaN);await page.waitForTimeout(600);const recovered=await read();check("Explicit invalid-state recovery returns the last safe point stopped",recovered.model.recovered&&recovered.model.speed===0&&Number.isFinite(recovered.model.distance));
 await options();await page.getByRole("button",{name:"Return to the Palace",exact:true}).click();await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==="worlds"&&document.querySelector(".world-ready"));await mark("17-museum-return");
 await page.evaluate(()=>window.__PALACE_DEV__.state.getState().enterRoom("cycling"));await page.locator(".road-mount").waitFor();check("Fresh re-entry restores progress on foot without stale riding controls",(await read()).s.mounted==="false");await mark("18-safe-re-entry");
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;report.failureState=await read().catch(()=>null);process.exitCode=1;console.error(e.stack);await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});}finally{await context.close();await page.video()?.saveAs(path.join(out,"continuous-native-ride.webm"));await flush();await browser.close();}
function checkBound(sectors){assert.ok(sectors.split(",").length<=6,"No more than six active route sectors");}
console.log("Continuous road journey: "+report.checks.length+" checks / "+(report.passed?"PASS":"FAIL"));
