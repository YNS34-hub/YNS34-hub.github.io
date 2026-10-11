import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base=process.env.PALACE_URL||"http://127.0.0.1:5191",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/third-person/public");
const personalControls=process.env.PALACE_PERSONAL_CONTROLS==="1";
await mkdir(out,{recursive:true});
const report={sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),base,checkedAt:new Date().toISOString(),scope:"Actual public build; native keys/buttons and visible DOM only. No debug APIs, camera staging or simulation injection.",checks:[],errors:[],uploads:[]};
// 可见窗口验收统一关闭测试浏览器的后台节流；不改变应用的输入、暂停或物理步长。
const browserArgs=["--use-angle=d3d11","--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding"];
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:process.env.PALACE_HEADED!=="1",args:browserArgs});report.browser=browser.version();report.headed=process.env.PALACE_HEADED==="1";report.browserArgs=browserArgs;report.courtRuns=[];
let page;
try{
 for(const width of process.env.PALACE_WIDTH?[Number(process.env.PALACE_WIDTH)]:[1920,2560]){
  const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1});
  await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
  page=await context.newPage();await page.bringToFront();page.setDefaultTimeout(90000);
  page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
  page.on("request",r=>{if(r.method()==="POST")report.uploads.push(r.url());});page.on("response",r=>{if(r.status()>=400)report.errors.push(r.status()+" "+r.url());});
  await page.goto(base+"/basketball?view=third");await page.locator(".world-ready canvas").waitFor();await page.locator(".court-hud").waitFor();
  assert.equal(await page.getByRole("button",{name:"Third person · V",exact:true}).getAttribute("aria-pressed"),"true");
  assert.equal(await page.evaluate(()=>!!window.__PALACE_DEV__||!!window.__PRESENCE_DEBUG__||!!window.__ROAD_DEBUG__),false);
  await page.getByRole("button",{name:"R · Recall ball",exact:true}).click();await page.keyboard.press("e");await page.getByRole("button",{name:"F · Layup",exact:true}).waitFor();
  await page.locator("canvas").click({position:{x:width*.62,y:150}});
  await page.bringToFront();await page.waitForFunction(()=>!document.hidden&&document.hasFocus());
  const trace=await page.evaluateHandle(()=>{
   let frames=0,active=true;const events=[];
   const tick=()=>{if(active){frames++;requestAnimationFrame(tick);}};
   const input=e=>{if(events.length<200)events.push({type:e.type,code:e.code,repeat:e.repeat,at:performance.now(),hidden:document.hidden,focused:document.hasFocus()});};
   document.addEventListener("keydown",input);document.addEventListener("keyup",input);window.addEventListener("blur",input);requestAnimationFrame(tick);
   return{read:()=>({frames,events}),dispose:()=>{active=false;document.removeEventListener("keydown",input);document.removeEventListener("keyup",input);window.removeEventListener("blur",input);}};
  });
  const run={width,samples:[]},runStart=Date.now();report.courtRuns.push(run);
  const turbo=personalControls?"Enter":"Shift",finishKey=personalControls?"Numpad5":"g";
  await page.keyboard.down(turbo);await page.keyboard.down("w");let accepted=false;
  if(personalControls){
   // 5 在远处是投篮键，不能沿路不停松键把球扔掉。像用户一样等待实际进入篮下动作范围，再按一次。
   await page.waitForFunction(()=>{const h=document.querySelector(".court-hud");return h?.dataset.primaryAction==="dunk"&&h.dataset.finishReady==="true";});await page.keyboard.press(finishKey);accepted=(await page.locator(".shot-result").textContent())?.includes("ATTACK THE RIM");run.acceptedAtSeconds=(Date.now()-runStart)/1000;
  }else for(let i=0;i<80;i++){await page.keyboard.press(finishKey);await page.waitForTimeout(80);const hint=await page.locator(".shot-result").textContent();if(i%10===0)run.samples.push({attempt:i,seconds:(Date.now()-runStart)/1000,hint,...await page.evaluate(()=>({hidden:document.hidden,focused:document.hasFocus()}))});if(hint?.includes("ATTACK THE RIM")){accepted=true;run.acceptedAtSeconds=(Date.now()-runStart)/1000;break;}}
  await page.keyboard.up("w");await page.keyboard.up(turbo);run.inputTrace=await trace.evaluate(t=>t.read());await trace.evaluate(t=>t.dispose());await trace.dispose();assert.ok(accepted,"Actual native run-up must reach an eligible dunk");
  await page.waitForFunction(()=>document.querySelector(".practice-score strong")?.textContent?.replace(/\s/g,"")==="1/1");
  await page.keyboard.press("v");assert.equal(await page.getByRole("button",{name:"First person",exact:true}).getAttribute("aria-pressed"),"true");
  await page.keyboard.press("v");await page.goto(base+"/basketball");await page.locator(".world-ready canvas").waitFor();await page.locator(".court-hud").waitFor();assert.equal(await page.getByRole("button",{name:"Third person · V",exact:true}).getAttribute("aria-pressed"),"true");
  if(personalControls){
   await page.getByRole("button",{name:"人物 / 穿搭",exact:true}).click();const wardrobe=page.getByRole("dialog",{name:"人物与穿搭"});await wardrobe.waitFor();
   assert.equal(await wardrobe.getByRole("button",{name:/照片参考角色/}).count(),0,"Clean public builds must not expose a private profile");assert.equal(await wardrobe.locator(".athlete-outfits button").count(),6);
   await wardrobe.getByRole("button",{name:/黑白街球/}).click();await page.keyboard.press("Escape");await wardrobe.waitFor({state:"hidden"});await page.reload();await page.locator(".world-ready canvas").waitFor();
   await page.getByRole("button",{name:"人物 / 穿搭",exact:true}).click();await wardrobe.waitFor();assert.equal(await wardrobe.getByRole("button",{name:/黑白街球/}).getAttribute("aria-pressed"),"true");await page.keyboard.press("Escape");
   report.checks.push({width,name:"Public Enter + Numpad5 physically scores; six outfits / original ESC gate / refresh restoration; no private avatar profile"});
  }
  await page.screenshot({path:path.join(out,`${width}-court.png`)});report.checks.push({width,name:"Public court: native sprint/dunk physically scores, view toggle and reload, no dev exports"});
  for(const room of["cycling","alpine-ride"]){
   await page.goto(base+"/"+room+"?view=third");await page.locator(".world-ready canvas").waitFor();await page.locator(".road-mount").waitFor();
   await page.keyboard.down("w");await page.waitForFunction(()=>document.querySelector(".road-mount")?.disabled===false);await page.keyboard.up("w");await page.keyboard.press("e");
   await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.mounted==="true");await page.waitForTimeout(800);
   await page.keyboard.down("w");await page.waitForFunction(()=>Number(document.querySelector(".road-status")?.dataset.speed)>.5);await page.keyboard.up("w");
   await page.keyboard.press("v");assert.equal(await page.getByRole("button",{name:"First person",exact:true}).getAttribute("aria-pressed"),"true");await page.keyboard.press("v");
   await page.keyboard.down("s");await page.waitForFunction(()=>Number(document.querySelector(".road-status")?.dataset.speed)<.01);await page.keyboard.up("s");
   await page.keyboard.press("p");await page.locator(".road-photo-tools").waitFor();await page.keyboard.press("Escape");await page.locator(".road-photo-tools").waitFor({state:"hidden"});
   await page.screenshot({path:path.join(out,`${width}-${room}.png`)});
   await page.getByRole("button",{name:"Ride options",exact:true}).click();await page.getByRole("button",{name:"Return to the Palace",exact:true}).click();
   await page.locator(".room-caption").filter({hasText:"WORLDS BEYOND"}).waitFor();
   report.checks.push({width,name:room+": public third-person native mount/ride/brake, views, photo/ESC, Palace return"});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(e){report.failure=e.stack;try{await page.screenshot({path:path.join(out,"failure.png")});report.diagnostic=await page.locator("body").innerText();}catch{}console.error(e);process.exitCode=1;}
finally{await writeFile(path.join(out,"validation.json"),JSON.stringify(report,null,2));await browser.close();}
console.log(`Third-person public: ${report.checks.length} journeys · ${report.passed?"PASS":"FAIL"}`);
