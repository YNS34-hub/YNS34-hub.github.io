import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/world-integration"), base = process.env.PALACE_URL || "http://127.0.0.1:5190";
await mkdir(out, { recursive: true });
const report = { reference: "0e50661bcab27e0249ef57832599f14c740ab9c5", head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), checks: [], errors: [], uploads: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
try {
  for (const width of [1920, 2560]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 1440 }, deviceScaleFactor: 1 });
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
    await context.addInitScript(() => {
      localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 }));
      window.__WORLD_QA__ = { contexts: 0, animations: [] };
      const Context = window.AudioContext;
      window.AudioContext = new Proxy(Context, { construct(target, args) { window.__WORLD_QA__.contexts++; return Reflect.construct(target, args); } });
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(...args) { const a = animate.apply(this, args); window.__WORLD_QA__.animations.push(a); return a; };
    });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on("pageerror", e => report.errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
    page.on("request", r => { if (r.method() === "POST") report.uploads.push(r.url()); });
    const ready = () => page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEV__?.library.getState().ready);
    const pose = (position, target) => page.evaluate(({ position, target }) => {
      const c = window.__PALACE_DEBUG__.camera, s = window.__PALACE_DEV__.state.getState(); c.position.set(...position); c.lookAt(...target);
      s.update({ returnView: { roomId: s.roomId, position, quaternion: c.quaternion.toArray() }, travelSequence: s.travelSequence + 1 });
    }, { position, target });
    const shot = async name => { await page.waitForTimeout(650); await page.screenshot({ path: path.join(out, name + "-" + width + ".png") }); };
    await page.goto(base + "/"); await ready(); await page.getByRole("button", { name: "ENTER THE PALACE" }).click(); await ready();
    await pose([14.4, 1.65, 7.2], [19.55, 3.1, 7.2]);
    await page.locator(".interaction-hint").filter({ hasText: "Enter world" }).waitFor();
    await shot("atrium-worlds-door"); await page.keyboard.press("e");
    await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().roomId === "worlds"); await ready();
    await shot("worlds-preview-windows");
    assert.equal(await page.locator(".world-loader").count(), 0);
    report.checks.push({ width, name: "Actual Atrium E doorway / original threshold walk / new-world preview windows" });
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("music")); await ready();
    await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
    await page.getByLabel("Import local audio files").setInputFiles({ name: "World Continuity.wav", mimeType: "audio/wav", buffer: await readFile("public/media/generated/palace-study.wav") });
    await page.locator(".record-row").filter({ hasText: "World Continuity" }).locator(".record-title").click();
    // 原创测试录音仅 36 秒；通过原播放器的真实循环控制覆盖多房间的完整验收时长。
    await page.getByRole("button", { name: "Repeat: off", exact: true }).click();
    await page.getByRole("button", { name: "Repeat: all", exact: true }).click();
    await page.getByRole("button", { name: "Repeat: one", exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit World Continuity", exact: true }).click();
    await page.getByLabel("Import local album art").setInputFiles({ name: "Original Court Study.webp", mimeType: "image/webp", buffer: await readFile("public/media/worlds/after-hours.webp") });
    await page.getByAltText("Current album artwork").waitFor();
    await page.getByRole("button", { name: "Close record editor" }).click(); await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector(".now-playing-open img")?.complete);
    const track = await page.evaluate(() => window.__PALACE_DEV__.audio.getState().currentId);
    const before = await page.evaluate(() => window.__PALACE_DEV__.audio.getState().progress);
    await page.locator(".now-playing-open").click(); await page.getByRole("dialog").waitFor(); await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => window.__WORLD_QA__.animations.some(a => a.id === "palace:player-continuity")));
    assert.equal(await page.locator(".player-art-transfer").count(), 0);
    assert.equal(await page.evaluate(() => window.__PALACE_DEV__.audio.getState().currentId), track);
    assert.ok(await page.evaluate(() => window.__PALACE_DEV__.audio.getState().progress) >= before);
    await shot("player-with-original-cover"); await page.keyboard.press("Escape"); await page.waitForTimeout(450);
    assert.equal(await page.locator(".player-art-transfer").count(), 0);
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
    const count = await page.evaluate(() => window.__WORLD_QA__.animations.filter(a => a.id === "palace:player-continuity").length);
    await page.locator(".now-playing-open").click(); await page.getByRole("dialog").waitFor(); await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => window.__WORLD_QA__.animations.filter(a => a.id === "palace:player-continuity").length), count);
    await page.keyboard.press("Escape");
    report.checks.push({ width, name: "Native audio + original cover import / real cover continuity / cleanup / unchanged track and progress / reduced motion" });
    for (const room of ["basketball", "cycling", "music"]) {
      await page.evaluate(room => window.__PALACE_DEV__.state.getState().enterRoom(room), room); await ready();
      if (room === "basketball") await page.getByRole("button", { name: "R · Recall ball", exact: true }).click();
      if (room === "cycling") {
        await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled);await page.keyboard.up("w");
        await page.keyboard.press("e");await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.mounted==="true"&&document.querySelector(".road-status")?.dataset.state!=="mounting");
        await page.keyboard.down("w");await page.waitForTimeout(1000);await page.keyboard.up("w");await page.keyboard.down("s");await page.waitForFunction(()=>Number(document.querySelector(".road-status")?.dataset.speed)===0);await page.keyboard.up("s");
      }
      assert.equal(await page.evaluate(() => window.__PALACE_DEV__.audio.getState().currentId), track);
      assert.equal(await page.evaluate(() => window.__PALACE_DEV__.audio.getState().playing), true);
    }
    assert.equal(await page.evaluate(() => window.__WORLD_QA__.contexts), 1);
    await page.reload(); await ready(); assert.equal(await page.evaluate(() => window.__PALACE_DEV__.audio.getState().currentId), track);
    assert.ok(await page.evaluate(() => window.__PALACE_DEV__.library.getState().music.find(t => t.id === window.__PALACE_DEV__.audio.getState().currentId)?.cover));
    report.checks.push({ width, name: "Native repeating original fixture survives museum / court / ride travel; effects share one existing context; native library and cover survive refresh" });
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (e) { report.failure = e.stack; console.error(e.stack); process.exitCode = 1; }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("World integration: " + report.checks.length + " checks; " + (report.passed ? "PASS" : "FAIL"));
