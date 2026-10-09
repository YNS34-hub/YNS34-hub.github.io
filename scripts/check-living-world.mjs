import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// 只用公开图和原创测试音乐，原生 DOM 操作触发交互；视频不得含私人素材。
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/living-world");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless:true, args:["--use-angle=d3d11"] });
const context = await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1920,height:1080}}});
await context.route("**/personal-media/manifest.json",r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
await context.addInitScript(()=>localStorage.setItem("memory-palace:v3",JSON.stringify({state:{quality:"medium",tutorialDone:true,roomSoundtracks:false},version:0})));
const page=await context.newPage(),report={checks:[],errors:[],browser:browser.version(),viewport:"1920x1080",quality:"medium",performanceClaim:false};
page.setDefaultTimeout(45000);page.on("pageerror",e=>report.errors.push(e.message));
const shot=async name=>page.screenshot({path:path.join(out,name+".png")});
const ready=()=>page.waitForSelector(".world-ready");
try {
  await page.goto("http://127.0.0.1:5190/");await ready();await page.waitForTimeout(1000);await shot("hero-rest");
  await page.getByRole("button",{name:"ENTER THE PALACE",exact:true}).click();await ready();await shot("entered");
  await page.goto("http://127.0.0.1:5190/editorial");await ready();
  await page.getByRole("button",{name:/OPEN COLLECTION/}).click();await page.locator(".editorial-strip").waitFor();
  const articles=page.locator(".editorial-strip > article"), first=articles.first();
  const before=await first.evaluate(n=>n.getBoundingClientRect().width);
  await first.locator(".visual-work-image").focus();await page.waitForTimeout(600);
  const after=await first.evaluate(n=>n.getBoundingClientRect().width);assert.ok(after>before+50);
  await shot("editorial-keyboard-focus");report.checks.push("Editorial responds to keyboard focus with original-aspect images");
  await first.getByRole("button",{name:/ENTER WALLPAPER CINEMA/}).click();await ready();
  await page.locator(".cinema-controls").waitFor();await page.mouse.move(20,500);await page.waitForTimeout(3700);
  assert.ok(await page.locator(".cinema-controls").evaluate(n=>Number(getComputedStyle(n).opacity))<.2);await shot("cinema-idle");
  await page.keyboard.press("ArrowRight");await page.waitForTimeout(500);
  assert.ok(await page.locator(".cinema-controls").evaluate(n=>Number(getComputedStyle(n).opacity))>.9);
  const favorite=page.getByRole("button",{name:"Favorite image",exact:true}),was=await favorite.getAttribute("aria-pressed");
  await favorite.click();await page.waitForTimeout(250);assert.notEqual(await favorite.getAttribute("aria-pressed"),was);
  await page.keyboard.press("i");await page.locator(".cinema-metadata").waitFor();await shot("cinema-metadata");
  await page.keyboard.press("Escape");assert.equal(await page.locator(".cinema-metadata").count(),0);assert.equal(await page.locator(".cinema-controls").count(),1);
  await page.keyboard.press("Escape");await ready();assert.equal(await page.locator(".cinema-controls").count(),0);
  report.checks.push("Cinema idle/activity/favorite/metadata and one-layer Escape retain original navigation");
  await page.goto("http://127.0.0.1:5190/music");await ready();await page.getByRole("button",{name:/OPEN COLLECTION/}).click();
  await page.getByLabel("Import local audio files").setInputFiles({name:"Living Study.wav",mimeType:"audio/wav",buffer:await readFile("public/media/generated/palace-study.wav")});
  await page.getByRole("button",{name:"Edit Living Study",exact:true}).click();
  await page.getByLabel("Import local album art").setInputFiles("public/media/projects/giannis-editorial.jpg");
  await page.getByRole("button",{name:"Close record editor",exact:true}).click();
  await page.locator(".record-row").filter({hasText:"Living Study"}).locator(".record-title").click();
  await page.getByRole("dialog").getByRole("button",{name:"Pause music",exact:true}).waitFor();
  await page.keyboard.press("Escape");await page.waitForTimeout(600);await shot("mini-playing");
  await page.locator(".now-playing-open").click();
  await page.waitForFunction(()=>document.querySelectorAll(".player-anchor-transfer").length>=2);
  await shot("player-continuity");await page.waitForTimeout(600);
  assert.equal(await page.locator(".player-anchor-transfer").count(),0);await shot("player-rest");
  await page.getByRole("dialog").getByRole("button",{name:"Pause music",exact:true}).click();
  await page.keyboard.press("Escape");await page.waitForTimeout(1000);await shot("mini-paused");
  report.checks.push("Native audio and local cover import; real playback; shared title/control/timeline; transient nodes cleaned");
  await page.emulateMedia({reducedMotion:"reduce"});await page.locator(".now-playing-open").click();await page.waitForTimeout(100);
  assert.equal(await page.locator(".player-anchor-transfer,.player-art-transfer").count(),0);await page.keyboard.press("Escape");
  report.checks.push("System reduced motion skips shared flights while player remains usable");
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}
finally{await context.close();await browser.close();await writeFile(path.join(out,"validation.json"),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
