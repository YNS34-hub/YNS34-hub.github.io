import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base=process.env.PALACE_URL||"http://127.0.0.1:5190",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/scenic-stops/after");
await mkdir(out,{recursive:true});
const report={source:process.env.PALACE_CAPTURE_SHA||execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:!!execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim(),base,quality:"medium",dpr:1,scope:"Visual-only fixed camera and explicitly restored scenic-stop save. No ride, shooting, or performance results are inferred from staged views.",frames:[],errors:[]};
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:process.env.PALACE_HEADED!=="1",args:["--use-angle=d3d11"]});
try{
  for(const width of[1920,2560]){
    const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1});
    await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
    await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
    const ready=async page=>{await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==="cycling"&&document.querySelector(".world-ready")&&window.__ROAD_DEBUG__);await page.waitForTimeout(600);};
    const bootstrap=await context.newPage();await bootstrap.goto(base+"/cycling?view=first");await ready(bootstrap);
    const stops=await bootstrap.evaluate(()=>window.__ROAD_DEBUG__.model.geography.stops.map(s=>s.distance));await bootstrap.close();
    for(let index=0;index<stops.length;index++){
      // 使用新文档的恢复入口，避免旧页面 pagehide 把刚写的测试存档覆盖回起点。
      const page=await context.newPage();page.setDefaultTimeout(120000);page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
      await page.addInitScript(distance=>localStorage.setItem("memory-palace:road:v2",JSON.stringify({route:2,distance,gear:6,comfort:true})),stops[index]);
      await page.goto(base+"/cycling?view=first");await ready(page);
      assert.ok(Math.abs(await page.evaluate(()=>window.__ROAD_DEBUG__.model.distance)-stops[index])<.01,"The declared stop save must actually restore before capture");
      const requested=await page.evaluate(distance=>{
        const camera=window.__PRESENCE_DEBUG__.presence.camera,p=camera.position.clone(),t=p.clone(),map=window.__ROAD_DEBUG__.model.geography;
        map.sample(distance,p,t);const r=Math.hypot(t.x,t.z),nx=-t.z/r,nz=t.x/r,side=nx*(520-p.x)+nz*(-452-p.z)>=0?1:-1;
        const position=[p.x-t.x/r*3,p.y+1.77,p.z-t.z/r*3],target=[p.x+nx*5*side,p.y+.45,p.z+nz*5*side];
        camera.position.set(...position);camera.lookAt(...target);const s=window.__PALACE_DEV__.state.getState();
        s.update({returnView:{roomId:s.roomId,position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},travelSequence:s.travelSequence+1});return{position,target};
      },stops[index]);
      await page.waitForTimeout(650);
      const actual=await page.evaluate(()=>({position:window.__PALACE_DEBUG__.camera.position.toArray(),quaternion:window.__PALACE_DEBUG__.camera.quaternion.toArray()}));
      assert.ok(Math.hypot(actual.position[0]-requested.position[0],actual.position[2]-requested.position[2])<.001,"The fixed view must remain at its declared stopping point");
      const file=`${width}-stop-${index}.png`;await page.screenshot({path:path.join(out,file)});
      report.frames.push({width,index,distance:stops[index],file,requested,actual});console.log(file);await page.close();
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(path.join(out,"captures.json"),JSON.stringify(report,null,2));await browser.close();}
