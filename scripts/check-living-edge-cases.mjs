import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// 公开图片、独立浏览器库；网络与后台状态故障由测试注入，切图/导入/骑行使用原生输入。
const base="http://127.0.0.1:5190",out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/living-edges");
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--use-angle=d3d11"]});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1920,height:1080}}});
await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
const page=await context.newPage(),report={checks:[],errors:[],uploads:[],performanceEvidence:false};
page.setDefaultTimeout(45000);page.on("pageerror",e=>report.errors.push(e.stack));page.on("request",r=>{if(r.method()==="POST")report.uploads.push(r.url());});
const ready=()=>page.waitForFunction(()=>document.querySelector(".world-ready")&&window.__PALACE_DEV__?.library.getState().ready);
const shot=name=>page.screenshot({path:path.join(out,name+".png")});
const projection=()=>page.evaluate(()=>{const g=window.__PALACE_DEBUG__.scene.getObjectByName("cinema-projection");return{failed:g?.userData.imageFailed,outgoing:g?.children.filter(n=>n.name==="cinema-outgoing").length,pictureVisible:g?.children.find(n=>n.name!=="cinema-outgoing")?.visible};});
let releaseSlow;
try{
 await page.goto(base+"/wallpapers");await ready();
 const bytes=await readFile("public/media/projects/giannis-editorial.jpg");
 await context.route("**/__motion_fixture__/*",async r=>{
  if(r.request().url().endsWith("slow.jpg"))await new Promise(resolve=>{releaseSlow=resolve;});
  if(r.request().url().endsWith("failed.jpg"))return r.fulfill({status:404,body:"test: intentionally unavailable"});
  await r.fulfill({contentType:"image/jpeg",body:bytes});
 });
 await page.evaluate(()=>{
  const d=window.__PALACE_DEV__,items=["first","slow","failed","last"].map(id=>({id:"edge-"+id,title:"Public study / "+id,src:"/__motion_fixture__/"+id+".jpg",category:"editorial",date:"2026",source:"Public project screenshot",tags:[]}));
  d.library.setState({wallpapers:items,personal:{...d.library.getState().personal,visuals:[],projects:[],research:[]}});
  d.state.getState().openCinema(items[0]);
 });
 await ready();await page.waitForTimeout(1000);
 await page.keyboard.press("ArrowRight");await page.waitForTimeout(350);
 assert.deepEqual(await projection(),{failed:false,outgoing:1,pictureVisible:false});await shot("slow-image-retains-outgoing");
 releaseSlow();await page.waitForFunction(()=>{const g=window.__PALACE_DEBUG__.scene.getObjectByName("cinema-projection");return g&&!g.getObjectByName("cinema-outgoing")&&g.children[0].visible;});
 report.checks.push("Slow image retains one actual outgoing artwork until decode completes, then disposes the transient plane");
 await page.keyboard.press("ArrowRight");await page.waitForFunction(()=>window.__PALACE_DEBUG__.scene.getObjectByName("cinema-projection")?.userData.imageFailed===true);
 assert.deepEqual(await projection(),{failed:true,outgoing:0,pictureVisible:true});await shot("failed-image-original-placeholder");
 await page.keyboard.press("ArrowRight");await page.waitForTimeout(1100);assert.equal((await projection()).failed,false);
 await page.keyboard.press("ArrowLeft");await page.keyboard.press("ArrowRight");await page.waitForTimeout(1100);assert.equal((await projection()).outgoing,0);
 // 显式模拟浏览器隐藏通知；不把故障注入称为真实切换标签的验收。
 await page.keyboard.press("ArrowRight");
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));});
 await page.waitForTimeout(100);assert.equal((await projection()).outgoing,0);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event("visibilitychange"));});
 await page.keyboard.press("Escape");await ready();assert.equal(await page.locator(".cinema-controls").count(),0);
 assert.equal(await page.evaluate(()=>!!window.__PALACE_DEBUG__.scene.getObjectByName("cinema-outgoing")),false);
 report.checks.push("404 never mislabels the previous image; recovery, rapid arrows, injected visibility loss and exit clean transient planes");
 await page.goto(base+"/portraits");await ready();await page.getByRole("button",{name:/OPEN COLLECTION/}).click();
 await page.getByLabel("Import files into a room").setInputFiles([{name:"Public placement study.jpg",mimeType:"image/jpeg",buffer:bytes},{name:"failed.png",mimeType:"image/png",buffer:Buffer.from("test failure")}]);
 assert.equal(await page.getByLabel("Target gallery").inputValue(),"portraits");await shot("import-recognized");
 await page.getByRole("button",{name:"CONFIRM PLACEMENT",exact:true}).click();await page.getByRole("button",{name:"Retry this file"}).waitFor();await shot("import-result");
 const id=await page.evaluate(()=>window.__PALACE_DEV__.library.getState().personal.visuals.find(x=>x.title==="Public placement study")?.id);assert.ok(id);
 await page.getByRole("button",{name:"SEE IN THE ROOM →"}).click();await ready();await page.waitForFunction(id=>!!window.__PALACE_DEBUG__.scene.getObjectByName("work:"+id),id);await shot("import-placed");
 await page.reload();await ready();await page.waitForFunction(id=>!!window.__PALACE_DEBUG__.scene.getObjectByName("work:"+id),id);
 report.checks.push("Native batch import recognizes public image, isolates failed file, places in Portraits and restores the same resource after refresh");
 await page.goto(base+"/music");await ready();await page.getByRole("button",{name:/OPEN COLLECTION/}).click();
 const audio=await readFile("public/media/generated/palace-study.wav");
 await page.getByLabel("Import local audio files").setInputFiles([{name:"Original Study A.wav",mimeType:"audio/wav",buffer:audio},{name:"Original Study B.wav",mimeType:"audio/wav",buffer:audio}]);
 await page.locator(".record-row").filter({hasText:"Original Study A"}).locator(".record-title").click();
 await page.getByRole("dialog").getByRole("button",{name:"Pause music",exact:true}).waitFor();
 const firstId=await page.evaluate(()=>window.__PALACE_DEV__.audio.getState().currentId);
 await page.getByRole("button",{name:"Next track",exact:true}).click();
 await page.waitForFunction(id=>window.__PALACE_DEV__.audio.getState().currentId!==id,firstId);await page.waitForTimeout(700);await shot("native-track-switch");
 assert.equal(await page.locator(".player-anchor-transfer,.player-art-transfer").count(),0);
 await page.getByRole("dialog").getByRole("button",{name:"Pause music",exact:true}).click();await page.keyboard.press("Escape");
 report.checks.push("Native next-track preserves original player ownership, updates identity and leaves no shared-flight nodes");
 await page.goto(base+"/basketball");await ready();
 await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,s=window.__PALACE_DEV__.state.getState();d.camera.position.set(0,1.65,-4.8);d.camera.lookAt(0,3.05,-12.1);s.update({returnView:{roomId:s.roomId,position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray()},travelSequence:s.travelSequence+1});});
 await page.getByRole("button",{name:"R · Recall ball",exact:true}).click();await page.getByRole("button",{name:"E · Pick up nearby ball",exact:true}).click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const {courtResponse}=await import("/src/worlds/CourtArchitecture.tsx");window.__RIM_PEAK__=0;const until=performance.now()+5000;const read=()=>{window.__RIM_PEAK__=Math.max(window.__RIM_PEAK__,courtResponse.rim);if(performance.now()<until)requestAnimationFrame(read);};read();});
 await page.getByRole("button",{name:"Hold / release · Shoot",exact:true}).hover();await page.mouse.down();await page.waitForTimeout(720);await page.mouse.up();
 await page.getByRole("status").filter({hasText:"MISSED"}).waitFor();assert.ok(await page.evaluate(()=>window.__RIM_PEAK__)>0);await shot("native-rim-miss");
 report.checks.push("Native timed release produces actual rim collision response and missed-shot feedback; simulation was not injected");
 await page.emulateMedia({reducedMotion:"reduce"});await page.goto(base+"/cycling");await ready();
 await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled);await page.keyboard.up("w");await page.keyboard.press("e");
 await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.mounted==="true"&&document.querySelector(".road-status")?.dataset.state!=="mounting");
 await page.keyboard.press("q");await page.locator(".road-moment-gear").waitFor();await shot("reduced-gear");await page.waitForTimeout(2500);assert.equal(await page.locator(".road-moment-gear").count(),0);
 await page.waitForTimeout(2600);assert.equal(await page.locator(".road-moment-chapter").count(),0);
 report.checks.push("OS reduced motion keeps native mount and gear change usable; gear and chapter cues expire without CSS animation events");
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);await shot("failure").catch(()=>{});}
finally{releaseSlow?.();await context.close();await page.video().saveAs(path.join(out,"edge-cases.webm"));await browser.close();await writeFile(path.join(out,"validation.json"),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
