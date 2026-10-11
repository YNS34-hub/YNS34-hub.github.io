import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
const out=process.env.PALACE_ARTIFACTS||"qa-artifacts/third-person/performance";await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:false,args:["--use-angle=d3d11","--window-position=0,0","--window-size=1920,1080"]});
const report={baseline:"e9a3b43e17e659b5021d00eade3c9370673e7558",sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:!!execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim(),when:new Date().toISOString(),headed:true,browser:browser.version(),viewport:[1920,1080],dpr:1,quality:"medium",scope:"Short visible Edge / actual NVIDIA samples. RAF wall intervals, not GPU timers. Main-pass calls/triangles; sampled material bytes, not complete VRAM. Native locomotion; only the explicitly labelled court shot starting pose is staged. No competing QA browsers during measurement.",samples:[],errors:[]};
const flush=()=>writeFile(out+"/performance.json",JSON.stringify(report,null,2));
async function measure(page,label,seconds=7){await page.bringToFront();const value=await page.evaluate(async seconds=>{
 const d=window.__PALACE_DEBUG__,r=d.renderer,gl=r.getContext(),e=gl.getExtension("WEBGL_debug_renderer_info"),frames=[],peak={calls:0,triangles:0,textures:0};const start=performance.now();let previous=start;
 await new Promise(resolve=>{const tick=now=>{frames.push(now-previous);previous=now;peak.calls=Math.max(peak.calls,r.info.render.calls);peak.triangles=Math.max(peak.triangles,r.info.render.triangles);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=seconds*1000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 const sorted=[...frames].sort((a,b)=>a-b);let lights=0,shadows=0,bytes=0;const maps=new Set();d.scene.traverse(o=>{if(o.isLight&&o.intensity>.01){lights++;if(o.castShadow)shadows++;}for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))for(const t of[...["map","normalMap","bumpMap","roughnessMap","metalnessMap","alphaMap"].map(k=>m[k]),...(m.userData?.courtTextures||[])]){const key=t&&[t.source.uuid,t.colorSpace,t.wrapS,t.wrapT,t.anisotropy].join(":");if(t&&!maps.has(key)){maps.add(key);bytes+=(t.image?.width||0)*(t.image?.height||0)*4*4/3;}}});
 return{fps:frames.length*1000/frames.reduce((a,b)=>a+b,0),frames:frames.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),peak,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),room:d.roomId,quality:window.__PALACE_DEV__.state.getState().effectiveQuality,activeLights:lights,shadowLights:shadows,materialMiB:bytes/1024/1024,programs:r.info.programs?.length};
 },seconds);assert.match(value.renderer,/NVIDIA.*GTX 1650/i);report.samples.push({label,...value});await flush();console.log(`${label}: ${value.fps.toFixed(1)} FPS / p95 ${value.p95Ms.toFixed(1)} ms / max ${value.maxMs.toFixed(1)} ms`);}
async function context(){const c=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});await c.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));await c.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));return c;}
async function ready(page,room){await page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&document.querySelector(".world-ready"),room);await page.waitForTimeout(2500);}
try{
 if(process.env.PALACE_NIGHT_ONLY==="1"){
  for(const[port,label,view]of[[5192,"e9a3b43","first"],[5190,"new","third"]]){
   const c=await context(),page=await c.newPage();page.setDefaultTimeout(90000);page.on("pageerror",e=>report.errors.push(e.message));
   const entryView=process.env.PALACE_TOGGLE_VIEW==="1"&&label==="new"?"first":view;
   await page.goto(`http://127.0.0.1:${port}/basketball/?view=${entryView}`);await ready(page,"basketball");
   if(entryView!==view){await page.getByRole("button",{name:"Third person · V",exact:true}).click();await page.waitForTimeout(700);}
   await measure(page,label+" / daylight",5);
   await page.getByRole("button",{name:"Night lights",exact:true}).click();await page.waitForTimeout(2400);await measure(page,label+" / first night interval",8);await measure(page,label+" / settled night",8);
   await page.getByRole("button",{name:"Daylight",exact:true}).click();await page.waitForTimeout(2400);await page.getByRole("button",{name:"Night lights",exact:true}).click();await page.waitForTimeout(2400);await measure(page,label+" / repeat night",5);await c.close();
  }
 }else{
 const before=await context(),baseline=await before.newPage();baseline.setDefaultTimeout(90000);await baseline.goto("http://127.0.0.1:5192/basketball/");await ready(baseline,"basketball");await measure(baseline,"e9a3b43 / court first-person entry");await before.close();
 const c=await context(),page=await c.newPage();page.setDefaultTimeout(90000);page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
 await page.goto("http://127.0.0.1:5190/basketball/?view=first");await ready(page,"basketball");await measure(page,"new / court first-person entry");
 await page.getByRole("button",{name:"Third person · V",exact:true}).click();await page.waitForTimeout(700);await measure(page,"new / court third-person daylight");
 await page.getByRole("button",{name:"Night lights",exact:true}).click();await page.waitForTimeout(2400);await measure(page,"new / court third-person night");
 await page.evaluate(()=>{const s=window.__PALACE_DEV__.state.getState(),c=window.__PRESENCE_DEBUG__.presence.camera;c.position.set(-3,1.65,10);c.lookAt(-3,2,-12);s.update({returnView:{roomId:s.roomId,position:c.position.toArray(),quaternion:c.quaternion.toArray()},travelSequence:s.travelSequence+1});});await page.waitForTimeout(250);await page.getByRole("button",{name:"R · Recall ball",exact:true}).click();await page.getByRole("button",{name:"E · Pick up nearby ball",exact:true}).click();await page.keyboard.down("Shift");await page.keyboard.down("w");await measure(page,"new / night sprint dribble (native, includes boundary stop)",5);await page.keyboard.up("w");await page.keyboard.up("Shift");await page.screenshot({path:out+"/court-third-night.png"});
 for(const room of["cycling","alpine-ride"]){await page.goto("http://127.0.0.1:5190/"+room+"?view=third");await ready(page,room);await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled,{},{timeout:20000});await page.keyboard.up("w");await page.keyboard.press("e");await page.waitForFunction(()=>window.__ROAD_DEBUG__?.view.mountProgress===1);await measure(page,"new / "+room+" third-person still",5);await page.keyboard.down("w");await page.keyboard.down("Shift");await measure(page,"new / "+room+" third-person native pedaling",7);await page.keyboard.up("w");await page.keyboard.up("Shift");await page.screenshot({path:out+"/"+room+"-third.png"});}
 await c.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await flush();await browser.close();}
