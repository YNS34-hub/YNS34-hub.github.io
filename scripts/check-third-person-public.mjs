import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base=process.env.PALACE_URL||"http://127.0.0.1:5191",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/third-person/public");
await mkdir(out,{recursive:true});
const report={sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),base,checkedAt:new Date().toISOString(),scope:"Actual public build; native keys/buttons and visible DOM only. No debug APIs, camera staging or simulation injection.",checks:[],errors:[],uploads:[]};
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--use-angle=d3d11"]});report.browser=browser.version();
let page;
try{
 for(const width of[1920,2560]){
  const context=await browser.newContext({viewport:{width,height:width===1920?1080:1440},deviceScaleFactor:1});
  await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
  page=await context.newPage();page.setDefaultTimeout(90000);
  page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
  page.on("request",r=>{if(r.method()==="POST")report.uploads.push(r.url());});page.on("response",r=>{if(r.status()>=400)report.errors.push(r.status()+" "+r.url());});
  await page.goto(base+"/basketball?view=third");await page.locator(".world-ready canvas").waitFor();await page.locator(".court-hud").waitFor();
  assert.equal(await page.getByRole("button",{name:"Third person · V",exact:true}).getAttribute("aria-pressed"),"true");
  assert.equal(await page.evaluate(()=>!!window.__PALACE_DEV__||!!window.__PRESENCE_DEBUG__||!!window.__ROAD_DEBUG__),false);
  await page.getByRole("button",{name:"R · Recall ball",exact:true}).click();await page.keyboard.press("e");await page.getByRole("button",{name:"F · Layup",exact:true}).waitFor();
  await page.keyboard.down("Shift");await page.keyboard.down("w");let accepted=false;
  for(let i=0;i<80;i++){await page.keyboard.press("g");await page.waitForTimeout(80);if((await page.locator(".shot-result").textContent())?.includes("ATTACK THE RIM")){accepted=true;break;}}
  await page.keyboard.up("w");await page.keyboard.up("Shift");assert.ok(accepted,"Actual native run-up must reach an eligible dunk");
  await page.waitForFunction(()=>document.querySelector(".practice-score strong")?.textContent?.replace(/\s/g,"")==="1/1");
  await page.keyboard.press("v");assert.equal(await page.getByRole("button",{name:"First person",exact:true}).getAttribute("aria-pressed"),"true");
  await page.keyboard.press("v");await page.reload();await page.locator(".world-ready canvas").waitFor();await page.locator(".court-hud").waitFor();assert.equal(await page.getByRole("button",{name:"Third person · V",exact:true}).getAttribute("aria-pressed"),"true");
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
