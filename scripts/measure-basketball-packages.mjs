import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const base=process.env.PALACE_URL||"http://127.0.0.1:5194";
const out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/basketball-packages/performance");
await mkdir(out,{recursive:true});
const probe=await chromium.launch({channel:"msedge",headless:false,args:["--enable-automation"]});
let defaults;
try{const cdp=await probe.newBrowserCDPSession();defaults=(await cdp.send("Browser.getBrowserCommandLine")).arguments.find(a=>a.startsWith("--disable-features="));await cdp.detach();}finally{await probe.close();}
const args=["--use-angle=d3d11",(defaults||"--disable-features=")+",CalculateNativeWinOcclusion"];
const browser=await chromium.launch({channel:"msedge",headless:false,args});
const report={date:new Date().toISOString(),base,headed:true,browser:browser.version(),viewport:[1920,1080],quality:"medium",scope:"Visible native Edge; neutral public avatar; native venue selection and E dribble. Seven-second stationary and four-second dribble samples. Distinct rendered-frame wall-clock intervals; no screenshot encoding/build/other QA browser during measurement. Counts include current renderer info; not a thermal benchmark or full graphics-memory audit.",samples:[],errors:[]};
const flush=()=>writeFile(path.join(out,"performance.json"),JSON.stringify(report,null,2));
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 await context.route("**/personal-media/avatar.json",r=>r.fulfill({json:{profile:null}}));
 await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
 const page=await context.newPage();page.setDefaultTimeout(60000);page.on("pageerror",e=>report.errors.push(e.message));
 await page.goto(base+"/basketball?view=third");
 await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==="basketball"&&window.__PRESENCE_DEBUG__&&!window.__PRESENCE_DEBUG__.activity.getState().warming&&document.querySelector(".world-ready"));
 async function measure(label,seconds){
  await page.bringToFront();await page.waitForFunction(()=>!document.hidden&&document.hasFocus());
  const sample=await page.evaluate(async seconds=>{
   const d=window.__PALACE_DEBUG__,r=d.renderer,gl=r.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info"),start=performance.now(),intervals=[];
   let last=start,frame=r.info.render.frame,duplicates=0,hidden=0,unfocused=0;const peak={calls:0,triangles:0,textures:0};
   await new Promise(resolve=>{const tick=now=>{if(r.info.render.frame!==frame){intervals.push(now-last);last=now;frame=r.info.render.frame;}else duplicates++;hidden+=Number(document.hidden);unfocused+=Number(!document.hasFocus());peak.calls=Math.max(peak.calls,r.info.render.calls);peak.triangles=Math.max(peak.triangles,r.info.render.triangles);peak.textures=Math.max(peak.textures,r.info.memory.textures);if(now-start>=seconds*1000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
   const elapsed=performance.now()-start,sorted=[...intervals].sort((a,b)=>a-b);
   return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),fps:intervals.length*1000/elapsed,renderedFrames:intervals.length,duplicateTicks:duplicates,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),peak,hidden,unfocused,dpr:r.getPixelRatio(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],effectiveQuality:window.__PALACE_DEV__.state.getState().effectiveQuality};
  },seconds);
  report.samples.push({label,...sample});await flush();assert.equal(sample.hidden,0);assert.equal(sample.unfocused,0);assert.ok(sample.renderedFrames>0);console.log(label+": "+sample.fps.toFixed(1)+" FPS; p95 "+sample.p95Ms.toFixed(1)+"ms");
 }
 for(const[id,index]of[["park",0],["blacktop",1],["retro-arena",2],["practice-gym",3],["rooftop",4]]){
  await page.getByRole("button",{name:"人物 / 穿搭",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"人物与穿搭",exact:true});
  await dialog.locator("fieldset").filter({has:page.locator("legend",{hasText:"球场风格"})}).getByRole("button").nth(index).click();
  await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});await page.waitForTimeout(2000);
  await measure(id+" / still",7);
  await page.getByRole("button",{name:"R · Recall ball",exact:true}).click();await page.getByRole("button",{name:"E · Pick up nearby ball",exact:true}).click();
  await page.keyboard.press("e");await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.dribbling);await page.waitForTimeout(350);
  await measure(id+" / dribble",4);
  await page.keyboard.press("e");await page.waitForFunction(()=>!window.__PRESENCE_DEBUG__.presence.dribbling);
 }
 await page.getByRole('button',{name:'Night lights',exact:true}).click();await page.waitForTimeout(1800);
 await measure('rooftop / night still',7);await page.keyboard.press('e');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.presence.dribbling);await measure('rooftop / night dribble',4);
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await flush();await browser.close();}
