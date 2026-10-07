import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190", out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/cycling");
await mkdir(out, { recursive: true });
const report = { baseline: "0e50661bcab27e0249ef57832599f14c740ab9c5", head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), quality: "medium", dpr: 1, checks: [], views: [], errors: [], uploads: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
try {
  for (const width of process.env.PALACE_SIZE === "1920" ? [1920] : [1920, 2560]) {
    const height = width === 1920 ? 1080 : 1440;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(process.env.PALACE_VIDEO === "1" ? { recordVideo: { dir: out, size: { width: 1920, height: 1080 } } } : {}) });
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
    await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on("pageerror", error => report.errors.push(error.message)); page.on("request", request => { if (request.method() === "POST") report.uploads.push(request.url()); });
    const ready = () => page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__ && window.__PALACE_DEV__?.library.getState().ready);
    const speed = () => page.locator(".ride-speed strong").textContent().then(Number);
    const position = () => page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    const lookAtLake = async () => {
      const delta = await page.evaluate(() => {
        const c = window.__PALACE_DEBUG__.camera, e = c.matrixWorld.elements;
        const from = Math.atan2(e[8], e[10]), to = Math.atan2(c.position.x - 53, c.position.z + 13);
        const yaw = Math.atan2(Math.sin(to - from), Math.cos(to - from));
        return -yaw / (.0022 * window.__PALACE_DEV__.state.getState().sensitivity);
      });
      await page.mouse.move(width * .5, height * .55); await page.mouse.down(); await page.mouse.move(width * .5 + delta, height * .58, { steps: 20 }); await page.mouse.up();
    };
    const shot = async name => { await page.waitForTimeout(600); const file = name + "-" + width + ".png"; await page.screenshot({ path: path.join(out, file) }); report.views.push({ file, width, position: await position() }); console.log("Captured " + file); };
    await page.goto(base + "/cycling"); await ready(); await shot("forest-entry");
    assert.equal(await speed(), 0);
    const first = await position();
    await page.getByRole("button", { name: "Start / resume ride", exact: true }).click();
    await page.keyboard.down("w"); await page.waitForTimeout(6500); await page.keyboard.up("w");
    assert.ok(await speed() > 17); assert.ok(Math.hypot(...(await position()).map((v, i) => v - first[i])) > 15);
    await shot("forest-moving");
    await page.getByRole("button", { name: "Brake · Space", exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector(".ride-speed strong")?.textContent) === 0);
    const stopped = await position(); await page.waitForTimeout(600); assert.deepEqual(await position(), stopped);
    await page.locator(".guide-button").click(); await page.keyboard.down("w"); await page.waitForTimeout(400); await page.keyboard.up("w"); assert.deepEqual(await position(), stopped);
    await page.keyboard.press("Escape");
    report.checks.push({ width, name: "Real pedal progression, acceleration, brake and modal input isolation" });
    await page.getByRole("button", { name: "Stop at next viewpoint", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".ride-hud h2")?.textContent === "LAKE OPENING" && Number(document.querySelector(".ride-speed strong")?.textContent) === 0, null, { timeout: 90000 });
    await lookAtLake();
    await shot("lake-stop"); const lake = await position();
    await page.keyboard.press("p"); await page.getByRole("button", { name: "Save this view", exact: true }).waitFor();
    assert.equal(await page.locator(".hud").evaluate(node => getComputedStyle(node).visibility), "hidden");
    await page.keyboard.down("w"); await page.waitForTimeout(450); await page.keyboard.up("w"); assert.deepEqual(await position(), lake);
    await shot("lake-photo");
    const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Save this view", exact: true }).click(); await (await download).saveAs(path.join(out, "lake-scene-export-" + width + ".png"));
    await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Photo view · P", exact: true }).waitFor();
    await page.reload(); await ready(); assert.equal(await speed(), 0);
    const restored = await position(); restored.forEach((v, i) => assert.ok(Math.abs(v - lake[i]) < .01));
    report.checks.push({ width, name: "Actual lake viewpoint stop, look-around, photo controls, local PNG export, one-level Escape and refresh progression" });
    await page.getByRole("button", { name: "Stop at next viewpoint", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".ride-hud h2")?.textContent === "VALLEY GLOW" && Number(document.querySelector(".ride-speed strong")?.textContent) === 0, null, { timeout: 90000 });
    await shot("valley-stop");
    await page.getByRole("button", { name: "Stop at next viewpoint", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".ride-hud h2")?.textContent === "THE OVERLOOK" && Number(document.querySelector(".ride-speed strong")?.textContent) === 0, null, { timeout: 90000 });
    await shot("overlook-stop");
    await lookAtLake(); await shot("overlook-lake-view");
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
    await page.getByRole("button", { name: "Start / resume ride", exact: true }).click();
    await page.waitForTimeout(2000); await shot("reduced-motion-ride");
    await page.getByRole("button", { name: "Brake · Space", exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector(".ride-speed strong")?.textContent) === 0);
    await page.getByRole("button", { name: "Back to Worlds", exact: true }).click(); await ready();
    assert.equal(await page.evaluate(() => window.__PALACE_DEV__.state.getState().roomId), "worlds");
    assert.equal(await page.evaluate(() => window.__PALACE_DEBUG__.camera.far), 200);
    report.checks.push({ width, name: "Actual valley / overlook progression, reduced-motion ride and original navigation return" });
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) { report.failure = error.stack; console.error(error.stack); process.exitCode = 1; }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("Cycling: " + report.checks.length + " checks; " + (report.passed ? "PASS" : "FAIL"));
