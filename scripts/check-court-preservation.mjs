import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190", phase = Number(process.env.PALACE_INTERACTION_PHASE || 3);
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/active-worlds"); await mkdir(out, { recursive: true });
const report = { baseline: "98ba16749fe6e8bb05d48db2e072089e273e5d59", head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), phase, quality: "medium", dpr: 1, checks: [], views: [], errors: [], uploads: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: process.env.PALACE_HEADED !== "1", args: ["--use-angle=d3d11"] });
report.browser = browser.version();
let diagnosticPage;
try {
  for (const width of [1920, 2560]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 1440 }, deviceScaleFactor: 1, ...(process.env.PALACE_VIDEO === "1" ? { recordVideo: { dir: out, size: { width: 1920, height: 1080 } } } : {}) });
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
    await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
    const page = diagnosticPage = await context.newPage(); page.setDefaultTimeout(45000);
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    page.on("request", request => { if (request.method() === "POST") report.uploads.push(request.url()); });
    const ready = () => page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__ && window.__PALACE_DEV__?.library.getState().ready);
    const goto = async id => { await page.goto(base + "/" + id); await ready(); };
    const pose = async (position, target) => page.evaluate(({ position, target }) => {
      const camera = window.__PALACE_DEBUG__.camera, s = window.__PALACE_DEV__.state.getState(); camera.position.set(...position); camera.lookAt(...target);
      s.update({ returnView: { roomId: s.roomId, position: camera.position.toArray(), quaternion: camera.quaternion.toArray() }, travelSequence: s.travelSequence + 1 });
    }, { position, target });
    const shot = async name => { await page.waitForTimeout(700); const file = name + "-" + width + ".png"; await page.screenshot({ path: path.join(out, file) }); report.views.push({ file, room: await page.evaluate(() => window.__PALACE_DEV__.state.getState().roomId), width }); };
    await goto("worlds"); await shot("worlds-wing");
    await pose([-6.1, 1.65, -7], [-6.1, 3.1, -11.2]); await page.locator(".interaction-hint").filter({ hasText: "Enter world" }).waitFor();
    await page.keyboard.press("e"); await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().roomId === "basketball"); await ready();
    await shot("court-entry");
    const from = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await page.keyboard.down("w"); await page.waitForTimeout(500); await page.keyboard.up("w");
    const to = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    assert.ok(Math.hypot(to[0] - from[0], to[2] - from[2]) > .5);
    await pose([1.5, 1.65, 8.5], [1.5, .12, 6]); await page.locator(".interaction-hint").filter({ hasText: "Pick up" }).waitFor();
    await page.keyboard.press("e"); await page.getByRole("button", { name: "E · Dribble", exact: true }).waitFor();
    await page.getByRole("button", { name: "E · Dribble", exact: true }).click();
    const ballY = () => page.evaluate(() => window.__PALACE_DEBUG__.scene.getObjectByName("practice-ball").position.y);
    const firstY = await ballY(); await page.waitForTimeout(200); assert.ok(Math.abs(await ballY() - firstY) > .03);
    await shot("court-dribble"); await page.getByRole("button", { name: "E · Hold ball", exact: true }).click();
    await pose([0, 1.65, -4.8], [0, 3.05, -12.1]); await page.waitForTimeout(250);
    const shoot = page.getByRole("button", { name: "Hold / release · Shoot", exact: true });
    await shoot.hover(); await page.mouse.down(); await page.waitForTimeout(895); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector(".practice-score strong")?.textContent?.replace(/\s/g, "") === "1/1");
    await shot("court-made"); await page.getByRole("button", { name: "R · Recall ball", exact: true }).click();
    await page.getByRole("button", { name: "E · Pick up nearby ball", exact: true }).click();
    await page.getByRole("button", { name: "E · Dribble", exact: true }).waitFor();
    await pose([5, 1.65, -3], [10, 2, 4]);
    const again = page.getByRole("button", { name: "Hold / release · Shoot", exact: true });
    await again.hover(); await page.mouse.down(); await page.waitForTimeout(240); await page.mouse.up();
    await page.getByRole("status").filter({ hasText: "MISSED" }).waitFor();
    await shot("court-missed");
    await page.locator(".guide-button").click(); const paused = await ballY();
    await page.keyboard.down("w"); await page.waitForTimeout(350); await page.keyboard.up("w"); assert.equal(await ballY(), paused);
    await page.keyboard.press("Escape");
    await pose([0, 1.65, 13.8], [0, 2.4, 17.2]); await page.locator(".interaction-hint").filter({ hasText: "Back to the palace" }).waitFor();
    await page.keyboard.press("e"); await page.waitForFunction(() => window.__PALACE_DEV__.state.getState().roomId === "worlds"); await ready();
    report.checks.push({ width, name: "Physical threshold → walk → gaze pickup → real dribble → timed shot made → miss → recall → modal pause → physical return" });
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) {
  try { report.diagnostic = await diagnosticPage.evaluate(async () => { const d=window.__PALACE_DEBUG__,s=window.__PALACE_DEV__?.state.getState();const a=await import('/src/worlds/activity.ts');return {ready:!!document.querySelector('.world-ready'),debug:!!d,debugRoom:d?.roomId,library:window.__PALACE_DEV__?.library.getState().ready,room:s?.roomId,overlay:s?.overlay,started:s?.started,mode:s?.mode,activity:a.useActivity.getState(),environment:d?.scene.environment?.uuid,prepared:d?.scene.getObjectByName('prepared-world:basketball')?.userData,text:document.body.innerText.slice(-1700)};});await diagnosticPage.screenshot({path:path.join(out,'failure.png')});}catch(e){report.diagnosticFailure=e.message;}
  report.failure = error.stack; console.error(error.stack); process.exitCode = 1; }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("Activity phase " + phase + ": " + report.checks.length + " journeys; " + (report.passed ? "PASS" : "FAIL"));
