import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190", out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/world-preparation");
await mkdir(out, { recursive: true });
const report = { head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), checks: [], errors: [], uploads: [], samples: [],
  scope: "Development lifecycle stress: only fast cancellation uses the existing debug navigation hook. Interaction after preparation uses native buttons and keys." };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
const page = await context.newPage(); page.setDefaultTimeout(60000);
page.on("pageerror", error => report.errors.push(error.message));
page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
page.on("request", request => { if (request.method() === "POST") report.uploads.push(request.url()); });
const ready = room => page.waitForFunction(room => document.querySelector(".world-ready") && window.__PALACE_DEBUG__?.roomId === room && window.__PALACE_DEBUG__.scene.getObjectByName("prepared-world:" + room)?.userData.prepared, room);
const travel = async prefix => { await page.locator(".guide-button").click(); await page.getByRole("button", { name: new RegExp("^" + prefix + "\\s+") }).click(); };
const sample = async label => report.samples.push({ label, ...await page.evaluate(() => ({ room: window.__PALACE_DEBUG__.roomId, textures: window.__PALACE_DEBUG__.renderer.info.memory.textures, far: window.__PALACE_DEBUG__.camera.far })) });
try {
  await page.goto(base + "/worlds"); await ready("worlds");
  await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("basketball"));
  await page.waitForTimeout(70);
  await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("cycling"));
  await page.waitForTimeout(70);
  await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("worlds"));
  await ready("worlds"); await sample("cancelled cold preparation");
  report.checks.push("Pending preparations can be abandoned without readiness, visibility or camera ownership leaking into the next destination");
  for (const quality of ["medium", "low", "high"]) {
    await page.evaluate(quality => window.__PALACE_DEV__.state.getState().update({ quality }), quality);
    await travel("W1"); await ready("basketball");
    await page.getByRole("button", { name: "R · Recall ball", exact: true }).click();
    await page.getByRole("button", { name: "E · Pick up nearby ball", exact: true }).click();
    await page.getByRole("button", { name: "E · Dribble", exact: true }).click();
    await page.getByRole("button", { name: "E · Hold ball", exact: true }).waitFor();
    await travel("W2"); await ready("cycling");
    const before = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await page.keyboard.down("w"); await page.waitForTimeout(1200); await page.keyboard.up("w");
    const after = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    assert.ok(Math.hypot(...after.map((v, i) => v - before[i])) > .6, "Native pedal input survives a direct court-to-route replacement");
    await page.getByRole("button", { name: "Brake · Space", exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector(".ride-speed strong")?.textContent) === 0);
    const lake = await page.evaluate(() => window.__PALACE_DEBUG__.scene.getObjectByName("sky-reflecting-lake")?.type || null);
    if (quality === "low") assert.equal(lake, "Mesh"); else assert.equal(lake, "Reflector");
    await page.getByRole("button", { name: "Back to Worlds", exact: true }).click(); await ready("worlds");
    await sample(quality + " / recovered original world limits"); assert.equal(report.samples.at(-1).far, 200);
    report.checks.push(quality + " preparation preserves native pickup/dribble, direct Guide transfer, real pedalling, brake and camera return");
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const room of ["basketball", "cycling", "worlds"]) { await page.evaluate(room => window.__PALACE_DEV__.state.getState().enterRoom(room), room); await ready(room); }
    await sample("repeat " + cycle);
  }
  const repeats = report.samples.filter(s => s.label.startsWith("repeat"));
  assert.ok(Math.max(...repeats.map(s => s.textures)) - Math.min(...repeats.map(s => s.textures)) <= 2, "Repeated exits must not accumulate GPU textures");
  report.checks.push("Three additional round trips settle to bounded GPU textures");
  await page.screenshot({ path: path.join(out, "prepared-worlds.png") });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) { report.failure = error.stack; console.error(error.stack); process.exitCode = 1; }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("World preparation: " + report.checks.length + " checks; " + (report.passed ? "PASS" : "FAIL"));
