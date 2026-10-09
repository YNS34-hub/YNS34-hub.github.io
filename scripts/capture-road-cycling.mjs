import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {roadLength} from "../src/worlds/road/route.ts";
const out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/road-visuals"),base=process.env.PALACE_URL||"http://127.0.0.1:5190";
await mkdir(out,{recursive:true});const length=roadLength,report={sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirty:!!execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim(),scope:"Static camera staging through valid saved route positions; approach and mount use native input. Separate journeys verify continuous travel.",frames:[],errors:[]};
const frames=[["stationary-cockpit",0],["forest-road",.045],["woodland-s-curve",.10],["climb",.285],["crest",.48],["first-lake-reveal",.185],["lakeside-road",.233],["high-meadow",.487],["golden-valley",.51],["descent",.60],["waterline",.74],["sunset-road",.89],["scenic-stop",.23]].filter(f=>!process.env.PALACE_CAPTURE_FRAMES||process.env.PALACE_CAPTURE_FRAMES.split(",").includes(f[0]));
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--use-angle=d3d11"]});
try{for(const size of [{width:1920,height:1080},{width:2560,height:1440}].filter(s=>!process.env.PALACE_CAPTURE_WIDTH||s.width===Number(process.env.PALACE_CAPTURE_WIDTH))){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1});
 await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on("pageerror",e=>report.errors.push(e.message));page.on("console",m=>{if(m.type()==="error")report.errors.push(m.text());});
 await page.route(base+"/__road_fixture__",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><title>Saved-route fixture</title>"}));
 for(const [name,progress] of frames){
  await page.goto(base+"/__road_fixture__");
  await page.evaluate(({distance})=>localStorage.setItem("memory-palace:road:v2",JSON.stringify({route:2,distance,gear:7,comfort:false})),{distance:progress*length});
  await page.goto(base+"/cycling/");await page.locator(".world-ready canvas").waitFor();
  await page.waitForFunction(distance=>Math.abs(Number(document.querySelector(".road-status")?.dataset.distance)-distance)<2,progress*length);
  if(progress===0){await page.screenshot({path:path.join(out,size.width+"-threshold.png")});}
  await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled,{},{timeout:10000});await page.keyboard.up("w");
  if(progress===0)await page.screenshot({path:path.join(out,size.width+"-road-bike.png")});
  await page.keyboard.press("e");await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.mounted==="true"&&document.querySelector(".road-status")?.dataset.state!=="mounting");
  await page.waitForTimeout(350);const actual=await page.locator(".road-status").evaluate(el=>({...el.dataset}));
  if(Math.abs(Number(actual.distance)-progress*length)>3)throw new Error("Saved fixture was replaced: "+name+" "+actual.distance);
  await page.screenshot({path:path.join(out,size.width+"-"+name+".png")});report.frames.push({name,width:size.width,height:size.height,progress,actual});
  if(name==="high-meadow"){
   await page.keyboard.press("p");await page.getByRole("button",{name:"Save this view",exact:true}).waitFor();
   await page.mouse.move(size.width*.5,size.height*.5);await page.mouse.down();await page.mouse.move(size.width*.53,size.height*.56,{steps:24});await page.mouse.up();await page.waitForTimeout(450);
   await page.screenshot({path:path.join(out,size.width+"-photo-mode.png")});await page.keyboard.press("Escape");
  }
  console.log(size.width+" "+name);
 }
 await context.close();
}if(report.errors.length)throw new Error(report.errors.join("\n"));}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}finally{await writeFile(path.join(out,"captures.json"),JSON.stringify(report,null,2));await browser.close();}
