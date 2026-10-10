import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/motion-layer", "accessibility");
const report = { checks: [], errors: [], uploads: [], performanceEvidence: false };
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PALACE_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  ...(process.env.PALACE_RECORD_MOTION === "1" ? { recordVideo: { dir: out, size: { width: 1920, height: 1080 } } } : {}),
});
await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
await context.addInitScript(() => {
  localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, reducedMotion: false, roomSoundtracks: false, mute: false }, version: 0 }));
  // 只记录原生 animate 的实际结果以检查生命周期，不更改动画时间或生产状态。
  window.__MOTION_QA__ = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function(...args) {
    const result = animate.apply(this, args);
    window.__MOTION_QA__.push({ node: this, animation: result });
    return result;
  };
});
const page = await context.newPage();
page.setDefaultTimeout(45000);
page.on("pageerror", e => report.errors.push(e.message));
page.on("request", r => { if (r.method() === "POST") report.uploads.push(r.url()); });
const ready = () => page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEV__?.library.getState().ready);
const active = () => page.evaluate(() => document.getAnimations().filter(a => a.id.startsWith("palace:") && ["running", "paused"].includes(a.playState)).length);
async function check(name, action) { await action(); report.checks.push({ name, passed: true }); console.log("PASS " + name); }
try {
  await page.goto(base + "/music"); await ready();
  await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
  await page.getByLabel("Import local audio files").setInputFiles({ name: "Motion Access.wav", mimeType: "audio/wav", buffer: await readFile("public/media/generated/palace-study.wav") });
  await page.locator(".record-row").filter({ hasText: "Motion Access" }).locator(".record-title").click();
  await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).waitFor();
  await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "access.lrc", mimeType: "text/plain", buffer: Buffer.from(Array.from({ length: 20 }, (_, i) => "[00:" + String(i).padStart(2, "0") + ".00]Original accessibility study " + i).join("\n")) });
  await page.keyboard.press("Escape");
  await check("rapid native cues cancel superseded instances and finish without retained inline styles", async () => {
    await page.evaluate(async () => {
      const d = window.__PALACE_DEV__;
      for (let i = 0; i < 8; i++) {
        await d.library.getState().updateTrack(d.audio.getState().currentId, { title: "Motion Access " + i });
        await new Promise(resolve => setTimeout(resolve, 35));
      }
    });
    await page.waitForTimeout(650);
    assert.equal(await active(), 0);
    const styles = await page.locator(".now-playing-open span").evaluate(node => ({ opacity: node.style.opacity, transform: node.style.transform, title: node.querySelector("strong").textContent }));
    assert.deepEqual(styles, { opacity: "", transform: "", title: "Motion Access 7" });
    const results = await page.evaluate(() => window.__MOTION_QA__.filter(x => x.animation.id.startsWith("palace:")).map(x => x.animation.playState));
    assert.ok(results.includes("idle"), "Superseded native cues must actually be cancelled.");
    assert.ok(results.includes("finished"));
  });
  await check("live OS reduced motion cancels existing cues and keeps genuine audio and lyric time", async () => {
    await page.evaluate(() => window.__PALACE_DEV__.library.getState().updateTrack(window.__PALACE_DEV__.audio.getState().currentId, { title: "Motion Access reduced" }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.reduced === "true");
    assert.equal(await active(), 0);
    await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(5.3));
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "5");
    const state = await page.evaluate(() => ({ signal: window.__PALACE_DEBUG__.audioSignal.available, playing: window.__PALACE_DEV__.audio.getState().playing, transition: getComputedStyle(document.querySelector(".lyric-roll")).transitionDuration }));
    assert.equal(state.playing, true); assert.equal(state.signal, true); assert.ok(parseFloat(state.transition) <= 0.00001);
    await page.screenshot({ path: path.join(out, "os-reduced.png") });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });
  await check("application reduced setting cancels in-flight identity cues without owning playback", async () => {
    await page.evaluate(() => window.__PALACE_DEV__.library.getState().updateTrack(window.__PALACE_DEV__.audio.getState().currentId, { title: "Motion Access app reduced" }));
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.reduced === "true");
    assert.equal(await active(), 0);
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: false }));
  });
  await check("paused disc retains orientation and resumes from the same native animation", async () => {
    await page.locator(".now-playing-open").click();
    const disc = page.locator(".record-disc");
    await page.waitForTimeout(350);
    const before = await disc.evaluate(node => { const a = node.getAnimations().find(a => a.animationName === "turn-record"); window.__QA_DISC__ = a; return a?.currentTime; });
    assert.ok(before > 0);
    await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).click();
    await page.waitForTimeout(200);
    const paused = await disc.evaluate(node => ({ same: node.getAnimations().includes(window.__QA_DISC__), time: window.__QA_DISC__.currentTime, state: window.__QA_DISC__.playState }));
    await page.waitForTimeout(250);
    assert.equal(await disc.evaluate(() => window.__QA_DISC__.currentTime), paused.time);
    assert.equal(paused.same, true); assert.equal(paused.state, "paused");
    await page.getByRole("dialog").getByRole("button", { name: "Play music", exact: true }).click();
    await page.waitForFunction(time=>window.__QA_DISC__?.playState==="running"&&window.__QA_DISC__.currentTime>time,paused.time);
    assert.ok(await disc.evaluate(() => window.__QA_DISC__.currentTime) > paused.time);
    await page.keyboard.press("Escape");
  });
  await check("rapid Cinema navigation settles the original material and preserves exact return view", async () => {
    const origin = await page.evaluate(() => { const c = window.__PALACE_DEBUG__.camera; return { room: "music", position: c.position.toArray(), quaternion: c.quaternion.toArray() }; });
    await page.evaluate(() => { const d = window.__PALACE_DEV__; d.state.getState().openCinema(d.library.getState().wallpapers[0]); });
    await ready();
    for (let i = 0; i < 5; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(40); }
    await page.waitForFunction(()=>!window.__PALACE_DEBUG__.scene.getObjectByName("cinema-outgoing"));
    await page.waitForTimeout(100);
    const projection = await page.evaluate(() => {
      const group = window.__PALACE_DEBUG__.scene.getObjectByName("cinema-projection"), result = [];
      group.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) result.push({ color: o.material.color.toArray(), opacity: o.material.opacity }); });
      return result;
    });
    assert.equal(projection.length, 1); assert.deepEqual(projection[0].color, [1, 1, 1]); assert.equal(projection[0].opacity, 1);
    await page.keyboard.press("Escape"); await ready();
    const returned = await page.evaluate(() => { const d = window.__PALACE_DEBUG__; return { room: d.roomId, position: d.camera.position.toArray(), quaternion: d.camera.quaternion.toArray() }; });
    assert.equal(returned.room, origin.room);
    // 相机欧拉角回写有浮点舍入；以远小于可见位移的公差检查原位、原朝向。
    for (const key of ["position", "quaternion"]) returned[key].forEach((value, i) => assert.ok(Math.abs(value - origin[key][i]) < 1e-12));
  });
  await check("keyboard focus and single Escape work immediately while guide animation is active", async () => {
    await page.keyboard.press("m"); await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), true);
    const before = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await page.keyboard.down("w"); await page.waitForTimeout(150); await page.keyboard.up("w");
    assert.deepEqual(await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray()), before);
    await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").count(), 0);
  });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally {
  await context.close();
  if (page.video()) { await page.video().saveAs(path.join(out, "native-motion.webm")); report.video = "native-motion.webm"; }
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
