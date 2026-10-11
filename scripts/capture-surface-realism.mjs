import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base=process.env.PALACE_URL||"http://127.0.0.1:5190",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/surface-realism/after");await mkdir(out,{recursive:true});
const report={source:process.env.PALACE_CAPTURE_SHA||execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),base,when:new Date().toISOString(),quality:"medium",dpr:1,scope:"Declared fixed-camera visual staging only; no scores, speed or route progress injection.",frames:[],errors:[]};
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--use-angle=d3d11"]});
try{
 for(const width of[1920,2560]){
  const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1});
  await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
  await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
  const page=await context.newPage();page.setDefaultTimeout(120000);page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
  for(const room of["basketball","cycling","alpine-ride"]){
   await page.goto(base+"/"+room+"?view=first");await page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&document.querySelector(".world-ready")&&!window.__PRESENCE_DEBUG__?.activity.getState().warming,room);await page.waitForTimeout(700);
   const poses=room==="basketball"?[
    ["court-wide",[2,1.65,9],[0,2.4,-12.1]],
    ["court-surface",[2,1.65,-2],[0,.05,-6]],
    ["court-hoop",[2.5,1.65,-9.3],[0,3.4,-12.7]],
    ["court-night",[2,1.65,9],[0,2.4,-12.1]],
   ]:await page.evaluate(room=>{
    const c=window.__PRESENCE_DEBUG__.presence.camera,p=c.position.clone(),t=p.clone(),ahead=p.clone(),map=window.__ROAD_DEBUG__.model.geography;
    map.sample(0,p,t);map.sample(40,ahead,t);const first=p.clone();map.sample(0,first,t);
    const horizontal=Math.hypot(t.x,t.z),tx=t.x/horizontal,tz=t.z/horizontal,nx=-tz,nz=tx;
    return[
     [room+"-wide",[p.x+nx*.3-tx,p.y+1.77,p.z+nz*.3-tz],[ahead.x,ahead.y+1.3,ahead.z]],
     [room+"-shoulder",[p.x+nx*2.6+tx,p.y+1.77,p.z+nz*2.6+tz],[p.x+nx*4.5+tx*5,p.y+.1,p.z+nz*4.5+tz*5]],
    ];
   },room);
   for(const[name,position,target]of poses){
    if(name==="court-night"){await page.getByRole("button",{name:"Night lights",exact:true}).click();await page.waitForTimeout(4000);}
    await page.evaluate(({position,target})=>{const s=window.__PALACE_DEV__.state.getState(),c=window.__PRESENCE_DEBUG__.presence.camera;c.position.set(...position);c.lookAt(...target);s.update({returnView:{roomId:s.roomId,position:c.position.toArray(),quaternion:c.quaternion.toArray()},travelSequence:s.travelSequence+1});},{position,target});await page.waitForTimeout(700);
    const actual=await page.evaluate(()=>({position:window.__PALACE_DEBUG__.camera.position.toArray(),quaternion:window.__PALACE_DEBUG__.camera.quaternion.toArray()})),file=`${width}-${name}.png`;
    await page.screenshot({path:path.join(out,file)});report.frames.push({room,name,file,width,requested:{position,target},actual});console.log(file);
   }
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}finally{await writeFile(path.join(out,"captures.json"),JSON.stringify(report,null,2));await browser.close();}
