import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/court-lighting"); await mkdir(out, { recursive: true });
const report = { sha: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), scope: "Native lighting/player input; declared debug camera staging and read-only scene diagnostics.", checks: [], errors: [], cycles: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.route("**/personal-media/manifest.json", r => r.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
const page = await context.newPage(); page.setDefaultTimeout(60000);
page.on("pageerror", e => report.errors.push(e.message)); page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
const ready = () => page.locator(".world-ready canvas").waitFor();
const activity = () => page.evaluate(async () => (await import("/src/worlds/activity.ts")).useActivity.getState());
const travel = async prefix => {
  await page.locator(".guide-button").click(); await page.getByRole("button", { name: new RegExp("^" + prefix + "\\s+") }).click();
  // 等待目的地本身的可见状态，避免误读上一室尚未移除的 world-ready。
  if (prefix === "W1") await page.locator(".court-hud").waitFor();
  if (prefix === "W0") await page.locator(".room-caption").filter({ hasText: "WORLDS BEYOND" }).waitFor();
  await ready();
};
try {
  await page.goto(base + "/basketball/"); await ready();
  await page.getByRole("button", { name: "R · Recall ball", exact: true }).click();
  await page.getByRole("button", { name: "E · Pick up nearby ball", exact: true }).click();
  await page.getByRole("button", { name: "E · Dribble", exact: true }).click();
  const before = await activity();
  await page.getByRole("button", { name: "Night lights", exact: true }).click(); await page.waitForTimeout(2600);
  const after = await activity(); assert.equal(after.mode, "held"); assert.equal(after.dribbling, true); assert.equal(after.shots, before.shots); assert.equal(after.made, before.made);
  const heights = []; for (let sample = 0; sample < 6; sample++) { heights.push(await page.evaluate(() => window.__PALACE_DEBUG__.scene.getObjectByName("practice-ball").position.y)); await page.waitForTimeout(110); }
  assert.ok(Math.max(...heights) - Math.min(...heights) > .3);
  report.checks.push("Day → night retains the held ball, live dribble and counters");
  await page.reload(); await ready(); assert.equal(await page.getByRole("button", { name: "Night lights", exact: true }).getAttribute("aria-pressed"), "true");
  report.checks.push("Night lighting preference restores after refresh");
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.getByRole("button", { name: "Daylight", exact: true }).click(); await page.waitForTimeout(200);
  const quiet = await page.evaluate(async () => (await import("/src/worlds/court/state.ts")).courtAtmosphere.night); assert.equal(quiet, 0);
  report.checks.push("Reduced motion settles the lighting immediately; gameplay remains available");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (let cycle = 0; cycle < 3; cycle++) {
    await travel("W0"); await page.waitForTimeout(650);
    const palace = await page.evaluate(() => ({ far: window.__PALACE_DEBUG__.camera.far, exposure: window.__PALACE_DEBUG__.renderer.toneMappingExposure, court: !!window.__PALACE_DEBUG__.scene.getObjectByName("basketball-practice-world") }));
    assert.equal(palace.far, 200); assert.equal(palace.exposure, 1); assert.equal(palace.court, false);
    await travel("W1"); await page.waitForTimeout(800);
    const current = await page.evaluate(() => ({ ...window.__PALACE_DEBUG__.renderer.info.memory, prepared: window.__PALACE_DEBUG__.scene.getObjectByName("prepared-world:basketball").userData.prepared }));
    assert.equal(current.prepared, true); report.cycles.push(current);
  }
  assert.ok(report.cycles.at(-1).textures <= report.cycles[0].textures + 1);
  assert.ok(report.cycles.at(-1).geometries <= report.cycles[0].geometries + 1);
  report.checks.push("Three consecutive returns restore the museum environment without growing GPU resource counts");
  await page.screenshot({ path: path.join(out, "restored-court.png") });
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (e) { report.failure = e.stack; process.exitCode = 1; console.error(e.stack); await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {}); }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("Court lighting: " + report.checks.length + " checks; " + (report.passed ? "PASS" : "FAIL"));
