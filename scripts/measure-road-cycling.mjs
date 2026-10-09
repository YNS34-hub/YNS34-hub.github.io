import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {roadLength} from "../src/worlds/road/route.ts";
const base=process.env.PALACE_URL||"http://127.0.0.1:5190",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/road-performance");await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:false,args:["--use-angle=d3d11","--window-position=0,0","--window-size=1920,1080"]});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
const page=await context.newPage();page.setDefaultTimeout(90000);await page.route(base+"/__road_fixture__",r=>r.fulfill({contentType:"text/html",body:"<!doctype html><title>Saved route staging</title>"}));
const report={sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:!!execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim(),when:new Date().toISOString(),browser:browser.version(),headed:true,viewport:[1920,1080],dpr:1,quality:"medium",build:"Vite development build with original read-only diagnostics; public production is verified separately.",gpu:JSON.parse(execFileSync("powershell",["-NoProfile","-Command","Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion | ConvertTo-Json -Compress"],{encoding:"utf8"})),scope:"Real RAF wall intervals including simulation. Main-pass renderer.info counts exclude shadow/offscreen passes; material-map MB excludes full VRAM. No GPU timer query. Native mount/pedal; valid saved-position staging is used for geographic samples.",samples:[],errors:[]};
page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
const flush=()=>writeFile(path.join(out,"performance.json"),JSON.stringify(report,null,2));
async function measure(label,seconds=6){
 await page.bringToFront();const data=await page.evaluate(async seconds=>{
  const frames=[],start=performance.now(),peak={calls:0,triangles:0,textures:0,lights:0,mapMB:0};let prev=start,last;
  await new Promise(resolve=>{const tick=now=>{frames.push(now-prev);prev=now;const d=window.__PALACE_DEBUG__,r=d.renderer,gl=r.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info");let lights=0,bytes=0;const maps=new Set();d.scene.traverse(o=>{if(o.isLight)lights++;for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))for(const key of["map","normalMap","bumpMap","roughnessMap"]){const t=m[key];if(t&&!maps.has(t.uuid)){maps.add(t.uuid);bytes+=(t.image?.width||0)*(t.image?.height||0)*4*4/3;}}});
   last={room:d.roomId,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),effectiveQuality:window.__PALACE_DEV__.state.getState().effectiveQuality,calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,lights,mapMB:bytes/1024/1024};for(const k in peak)peak[k]=Math.max(peak[k],last[k]);if(now-start>=seconds*1000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  const sorted=[...frames].sort((a,b)=>a-b),elapsed=frames.reduce((a,b)=>a+b,0);return{fps:frames.length*1000/elapsed,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),frames:frames.length,last,peak};
 },seconds);assert.match(data.last.renderer,/NVIDIA.*GTX 1650/i);report.samples.push({label,...data});await flush();console.log(label+": "+data.fps.toFixed(1)+" FPS / p95 "+data.p95Ms.toFixed(1)+" / max "+data.maxMs.toFixed(1));
}
try{
 for(const [name,t]of[["trailhead",0],["dense forest",.045],["climb",.285],["lake reveal",.185],["shore road",.233],["high meadow",.487],["golden valley",.51],["fast descent",.60]]){
  await page.goto(base+"/__road_fixture__");await page.evaluate(d=>localStorage.setItem("memory-palace:road:v2",JSON.stringify({route:2,distance:d,gear:7,comfort:false})),t*roadLength);
  await page.goto(base+"/cycling/");await page.locator(".world-ready canvas").waitFor();await page.waitForFunction(d=>Math.abs(Number(document.querySelector(".road-status")?.dataset.distance)-d)<2,t*roadLength);
  await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled);await page.keyboard.up("w");await page.keyboard.press("e");await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.mounted==="true"&&document.querySelector(".road-status")?.dataset.state!=="mounting");await page.waitForTimeout(1500);await measure(name+" / stationary");
  if(name==="dense forest"||name==="fast descent"){
   await page.keyboard.down("w");await page.waitForTimeout(8000);await measure(name+" / native pedaling",8);await page.keyboard.up("w");await measure(name+" / coasting",6);
  }
  await page.screenshot({path:path.join(out,name.replaceAll(" ","-")+".png")});
 }
 await page.goto(base+"/worlds/");await page.locator(".world-ready canvas").waitFor();await page.waitForTimeout(1500);await measure("museum wing / after road exits");
 assert.deepEqual(report.errors,[]);report.meets45Mean=report.samples.every(s=>s.fps>=45);report.meets60Mean=report.samples.every(s=>s.fps>=60);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}finally{await flush();await browser.close();}
