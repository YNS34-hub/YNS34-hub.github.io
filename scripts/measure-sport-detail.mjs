import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
const out=process.env.PALACE_ARTIFACTS||"qa-artifacts/personal-athlete/performance";
const quality=process.env.PALACE_QUALITY||"medium",personal=process.env.PALACE_PERSONAL==="1";assert.ok(["medium","high"].includes(quality));
await mkdir(out,{recursive:true});
const probe=await chromium.launch({channel:"msedge",headless:false,args:["--enable-automation"]});
let defaults;
try{const cdp=await probe.newBrowserCDPSession();defaults=(await cdp.send("Browser.getBrowserCommandLine")).arguments.find(a=>a.startsWith("--disable-features="));await cdp.detach();}finally{await probe.close();}
const args=["--use-angle=d3d11",(defaults||"--disable-features=")+",CalculateNativeWinOcclusion"];
const browser=await chromium.launch({channel:"msedge",headless:false,args});
const report={baseline:"12671dfb211a3059c870dc7d00bf9d5ed6a8b3df",sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:!!execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim(),date:new Date().toISOString(),browser:browser.version(),args,headed:true,viewport:[1920,1080],quality:"medium",dpr:"per scene, see drawingBuffer",scope:"Actual visible native Edge. Only its window-occlusion detector is disabled in the isolated test. Rendered-frame RAF wall intervals; duplicate RAF ticks excluded. Main-pass calls/triangles; sampled texture estimates are not total VRAM. Native pedaling / no speed injection. No other QA browser or build during measurement. Short samples, not a thermal or whole-route benchmark.",samples:[],errors:[]};
const flush=()=>writeFile(out+"/performance.json",JSON.stringify(report,null,2));
report.quality=quality;report.personalAvatar=personal;
async function measure(page,label,seconds=7){
 await page.bringToFront();await page.waitForFunction(()=>!document.hidden&&document.hasFocus());
 const sample=await page.evaluate(async seconds=>{
  const d=window.__PALACE_DEBUG__,r=d.renderer,gl=r.getContext(),extension=gl.getExtension("WEBGL_debug_renderer_info"),start=performance.now(),intervals=[];
  let last=start,frame=r.info.render.frame,duplicates=0,hidden=0,unfocused=0;const peak={calls:0,triangles:0,textures:0};
  await new Promise(resolve=>{const tick=now=>{if(r.info.render.frame!==frame){intervals.push(now-last);last=now;frame=r.info.render.frame;}else duplicates++;hidden+=Number(document.hidden);unfocused+=Number(!document.hasFocus());peak.calls=Math.max(peak.calls,r.info.render.calls);peak.triangles=Math.max(peak.triangles,r.info.render.triangles);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=seconds*1000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  const elapsed=performance.now()-start,sorted=[...intervals].sort((a,b)=>a-b),maps=new Set();let lights=0,shadows=0,bytes=0;
  d.scene.traverse(o=>{if(o.isLight&&o.intensity>.01){lights++;shadows+=Number(o.castShadow);}for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))for(const t of[...["map","normalMap","bumpMap","roughnessMap","metalnessMap","alphaMap"].map(k=>m[k]),...(m.userData?.courtTextures||[])]){const key=t&&[t.source.uuid,t.colorSpace,t.wrapS,t.wrapT,t.anisotropy].join(":");if(t&&!maps.has(key)){maps.add(key);bytes+=(t.image?.width||0)*(t.image?.height||0)*4*4/3;}}});
  return{dpr:r.getPixelRatio(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),fps:intervals.length*1000/elapsed,renderedFrames:intervals.length,duplicateTicks:duplicates,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),peak,activeLights:lights,shadowLights:shadows,materialMiB:bytes/1024/1024,programs:r.info.programs?.length,hidden,unfocused,quality:window.__PALACE_DEV__.state.getState().effectiveQuality,ride:window.__PRESENCE_DEBUG__.ride.getState().speed};
 },seconds);
 report.samples.push({label,...sample});await flush();assert.match(sample.renderer,/NVIDIA.*GTX 1650/i);assert.equal(sample.hidden,0);assert.equal(sample.unfocused,0);assert.ok(sample.renderedFrames>0);
 console.log(`${label}: ${sample.fps.toFixed(1)} rendered FPS / p95 ${sample.p95Ms.toFixed(1)}ms / calls ${sample.peak.calls}`);
}
try{
 // 可选固定提交的隔离导出用于同机比较；绝不切换或覆盖使用中的开发分支。
 for(const[label,url]of[...(process.env.PALACE_BASELINE_URL?[["before",process.env.PALACE_BASELINE_URL]]:[]),["after",process.env.PALACE_URL||"http://127.0.0.1:5190"]]){
  if(label==="before"){const marker=await(await fetch(url+"/qa-baseline.json")).json();assert.equal(marker.sha,report.baseline);}
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
  if(!personal)await context.route("**/personal-media/avatar.json",r=>r.fulfill({json:{profile:null}}));
  // 只改变隔离测试上下文的画质选择；本机人物只从既有本地注册读取，报告不写私人参数或文件列表。
  await context.addInitScript(quality=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality,tutorialDone:true,roomSoundtracks:false},version:0})),quality);
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on("pageerror",e=>report.errors.push(e.message));
  const ready=async room=>{await page.bringToFront();await page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&window.__PRESENCE_DEBUG__&&!window.__PRESENCE_DEBUG__.activity.getState().warming&&document.querySelector(".world-ready"),room);await page.waitForTimeout(2000);};
  await page.goto(url+"/basketball?view=third");await ready("basketball");await measure(page,label+" / court daylight");
  await page.getByRole("button",{name:"Night lights",exact:true}).click();await page.waitForTimeout(2200);await measure(page,label+" / court night");
  for(const room of["cycling","alpine-ride"]){
   await page.goto(url+"/"+room+"?view=third");await ready(room);await page.keyboard.down("w");await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.ride.getState().nearBike);await page.keyboard.up("w");await page.getByRole("button",{name:"Mount / ride · E",exact:true}).click();await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.ride.getState().mounted&&window.__ROAD_DEBUG__.view.mountProgress===1);await page.waitForTimeout(500);await measure(page,label+" / "+room+" still",5);
   await page.keyboard.down("w");await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.ride.getState().cadence>20);await measure(page,label+" / "+room+" pedaling");
   if(label==="after"){await page.keyboard.press("c");await page.waitForTimeout(850);await measure(page,label+" / "+room+" standing pedaling");}
   await page.keyboard.up("w");
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await flush();await browser.close();}
