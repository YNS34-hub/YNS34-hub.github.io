import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const phase = Number(process.env.PALACE_INTERACTION_PHASE || 2);
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/interaction-worlds");
await mkdir(out, { recursive: true });
const report = { baseline: "0e50661bcab27e0249ef57832599f14c740ab9c5", head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), modified: !!execFileSync("git", ["status", "--porcelain"]).toString().trim(), phase, checks: [], views: [], errors: [], posts: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
report.browser = browser.version();
try {
  for (const width of [1920, 2560]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 1440 }, deviceScaleFactor: 1 });
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
    await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, reducedMotion: false, roomSoundtracks: false }, version: 0 })));
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("request", request => { if (request.method() === "POST") report.posts.push(request.url()); });
    const ready = () => page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__ && window.__PALACE_DEV__?.library.getState().ready);
    const goto = async id => { await page.goto(base + "/" + (id === "atrium" ? "" : id)); await ready(); await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ started: true })); };
    const pose = async (position, target) => {
      await page.evaluate(({ position, target }) => {
        const d = window.__PALACE_DEV__, camera = window.__PALACE_DEBUG__.camera;
        camera.position.set(...position); camera.lookAt(...target);
        d.state.getState().update({ returnView: { roomId: d.state.getState().roomId, position: camera.position.toArray(), quaternion: camera.quaternion.toArray() }, travelSequence: d.state.getState().travelSequence + 1 });
      }, { position, target });
    };
    const shot = async (name, wait = 850) => {
      await page.waitForTimeout(wait);
      const file = name + "-" + width + ".png"; await page.screenshot({ path: path.join(out, file) });
      report.views.push({ file, room: await page.evaluate(() => window.__PALACE_DEV__.state.getState().roomId), quality: "medium", dpr: 1, width });
    };
    await goto("atrium"); await pose([8, 1.65, 10], [0, 3.3, 0]); await shot("atrium-rest");
    await goto("projects"); await pose([-2.5, 1.65, -1], [-2.5, 4.8, -8]);
    await page.locator(".interaction-hint").filter({ hasText: "View project" }).waitFor();
    await shot("project-gaze");
    const before = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await page.keyboard.press("e"); await page.getByRole("dialog").waitFor();
    await page.keyboard.down("w"); await page.waitForTimeout(400); await page.keyboard.up("w");
    const still = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    assert.deepEqual(still, before);
    await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").count(), 0);
    await pose([-2.5, 1.65, -1], [0, 2, 12]); await page.waitForTimeout(600);
    assert.equal(await page.locator(".interaction-hint").count(), 0);
    report.checks.push({ width, name: "Real gaze → E opens existing project; modal blocks WASD; look-away clears dwell" });
    await goto("editorial");
    const work = await page.evaluate(() => {
      let object; window.__PALACE_DEBUG__.scene.traverse(o => { if (!object && o.name.startsWith("work:")) object = o; });
      if (!object) return null;
      object.updateWorldMatrix(true, false);
      const e = object.matrixWorld.elements;
      return { position: [e[12], e[13], e[14]], id: object.userData.resourceId, forward: [e[8], e[9], e[10]] };
    });
    assert.ok(work);
    await pose([work.position[0] + work.forward[0] * 6, 1.65, work.position[2] + work.forward[2] * 6], work.position);
    await page.locator(".interaction-hint").filter({ hasText: "View image" }).waitFor();
    const savedBefore = await page.evaluate(id => window.__PALACE_DEV__.library.getState().personal.visuals.find(w => w.id === id)?.favorite, work.id);
    await page.keyboard.press("f");
    await page.getByRole("status").filter({ hasText: savedBefore ? "Released" : "Kept" }).waitFor();
    const savedAfter = await page.evaluate(id => window.__PALACE_DEV__.library.getState().personal.visuals.find(w => w.id === id)?.favorite, work.id);
    assert.equal(!!savedAfter, !savedBefore); await shot("image-collect");
    const origin = await page.evaluate(() => ({ p: window.__PALACE_DEBUG__.camera.position.toArray(), q: window.__PALACE_DEBUG__.camera.quaternion.toArray() }));
    await page.keyboard.press("e"); await ready(); assert.equal(await page.evaluate(() => window.__PALACE_DEV__.state.getState().roomId), "cinema");
    await shot("image-viewing"); await page.keyboard.press("Escape"); await ready();
    const returned = await page.evaluate(() => ({ p: window.__PALACE_DEBUG__.camera.position.toArray(), q: window.__PALACE_DEBUG__.camera.quaternion.toArray() }));
    for (const key of ["p", "q"]) returned[key].forEach((v, i) => assert.ok(Math.abs(v - origin[key][i]) < 1e-6));
    await page.reload(); await ready();
    assert.equal(!!await page.evaluate(id => window.__PALACE_DEV__.library.getState().personal.visuals.find(w => w.id === id)?.favorite, work.id), !!savedAfter);
    report.checks.push({ width, name: "Gaze favorite persists; original Cinema exact camera return retained" });
    await goto("music"); await pose([6, 1.65, -1.5], [6.8, 4.4, -10.3]);
    await page.locator(".interaction-hint").filter({ hasText: "Open player" }).waitFor();
    await page.keyboard.press("e"); await page.getByRole("dialog").waitFor();
    await page.getByLabel("Import local audio files").setInputFiles({ name: "Interaction Study.wav", mimeType: "audio/wav", buffer: await readFile("public/media/generated/palace-study.wav") });
    await page.locator(".record-row").filter({ hasText: "Interaction Study" }).locator(".record-title").click();
    await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "interaction-study.lrc", mimeType: "text/plain", buffer: Buffer.from("[00:00.00]A real recording.\n[00:03.00]A quiet room.\n[00:06.00]A visitor listens.\n[00:09.00]The room responds.") });
    await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector('.lyric-wall[data-attended="true"]') && window.__PALACE_DEBUG__.audioSignal.available);
    assert.ok(await page.locator(".lyric-line").count() <= 7);
    await shot("lyrics-attended");
    await page.locator(".now-playing-action").click(); await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.__PALACE_DEV__.audio.getState().playing), false);
    await shot("lyrics-settled");
    report.checks.push({ width, name: "Existing real analyser + synchronized seven-line lyrics + E player + pause settling" });
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
    await page.locator(".now-playing-open").click(); await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator(".player-art-transfer").count(), 0); await page.keyboard.press("Escape");
    report.checks.push({ width, name: "Reduced motion retains all controls without cover flight" });
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.posts, []); report.passed = true;
} catch (error) { report.failure = error.stack; console.error(error.stack); process.exitCode = 1; }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("Interaction phase " + phase + ": " + report.checks.length + " checks; " + (report.passed ? "PASS" : "FAIL"));
