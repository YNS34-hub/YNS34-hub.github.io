import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const phase = process.env.PALACE_MOTION_PHASE || "1";
const baseline = phase === "baseline";
const stage = baseline ? 8 : Number(phase);
const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/motion-layer");
const publicMedia = { wallpapers: [], visuals: [], music: [], projects: [], research: [] };
const report = {
  phase, reference: process.env.PALACE_REFERENCE_SHA || "63805572054147816699f5ab5b8e513e7447c530", url: base,
  gitHead: baseline ? (process.env.PALACE_SOURCE_SHA || "63805572054147816699f5ab5b8e513e7447c530") : execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  runnerHead: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  workingTreeModified: !!execFileSync("git", ["status", "--porcelain"]).toString().trim(),
  quality: "medium", dpr: 1, content: "Identical public catalog and original browser-local Palace Study fixtures. No private recordings or manifests.",
  checks: [], views: [], cues: [], errors: [], uploads: [],
};
await mkdir(path.join(out, phase), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PALACE_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true, args: ["--use-angle=d3d11"],
});
report.browser = browser.version();
const save = async () => writeFile(path.join(out, phase + ".json"), JSON.stringify(report, null, 2));
const lyrics = Array.from({ length: 10 }, (_, i) => "[00:" + String(i * 3).padStart(2, "0") + ".00]Original motion study — line " + (i + 1)).join("\n");

try {
  for (const width of process.env.PALACE_SIZE === "1920" ? [1920] : [1920, 2560]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 1440 }, deviceScaleFactor: 1 });
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: publicMedia }));
    await context.addInitScript(() => {
      localStorage.setItem("memory-palace:v3", JSON.stringify({
        state: { quality: "medium", tutorialDone: true, reducedMotion: false, roomSoundtracks: false, mute: false }, version: 0,
      }));
      // 只暂停实际创建的欢迎动画来采样精确时间；不创建、替换或伪造动画。
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(...args) {
        const result = animate.apply(this, args);
        if (this.matches(".welcome-caption h1")) result.pause();
        return result;
      };
    });
    const page = await context.newPage();
    await page.bringToFront();
    page.setDefaultTimeout(45000);
    page.on("pageerror", e => report.errors.push(e.message));
    page.on("request", request => { if (request.method() === "POST") report.uploads.push(request.url()); });
    const ready = async () => {
      await page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__?.camera && window.__PALACE_DEV__?.library.getState().ready);
      await page.evaluate(() => document.fonts.ready);
    };
    const goto = async room => { await page.goto(base + "/" + (room === "atrium" ? "" : room)); await ready(); };
    const pose = async (position, target) => {
      await page.evaluate(({ position, target }) => {
        const s = window.__PALACE_DEV__.state.getState(), c = window.__PALACE_DEBUG__.camera;
        c.position.set(...position); c.lookAt(...target);
        s.update({ started: true, overlay: null, travelSequence: s.travelSequence + 1, returnView: { roomId: s.roomId, position, quaternion: c.quaternion.toArray() } });
      }, { position, target });
    };
    const shot = async (name, wait = 1000) => {
      if (wait) await page.waitForTimeout(wait);
      const file = name + "-" + width + ".png";
      await page.screenshot({ path: path.join(out, phase, file) });
      const view = await page.evaluate(() => {
        const d = window.__PALACE_DEBUG__, c = d.camera;
        return { room: d.roomId, position: c.position.toArray(), quaternion: c.quaternion.toArray(), calls: d.renderer.info.render.calls, triangles: d.renderer.info.render.triangles };
      });
      report.views.push({ name, file, width, ...view });
      await save();
      console.log("Captured " + phase + " / " + file);
    };
    const cueFrames = async (selector, name) => {
      const count = await page.locator(selector).evaluate(node => {
        const animations = node.getAnimations().filter(a => a.id.startsWith("palace:"));
        animations.forEach(a => { a.pause(); a.currentTime = 0; });
        return animations.length;
      });
      report.cues.push({ name, width, count });
      if (!baseline) assert.ok(count > 0, name + " reuses the original element with a one-shot cue");
      await shot(name + "-start", 0);
      await page.locator(selector).evaluate(node => node.getAnimations().filter(a => a.id.startsWith("palace:")).forEach(a => { a.currentTime = Number(a.effect.getTiming().duration) * 0.4 + Number(a.effect.getTiming().delay); }));
      await shot(name + "-moving", 0);
      await page.locator(selector).evaluate(node => node.getAnimations().filter(a => a.id.startsWith("palace:")).forEach(a => a.finish()));
      await shot(name + "-rest", 500);
    };
    await goto("atrium");
    if (stage >= 2) await cueFrames(".welcome-caption h1", "hero");
    await shot("welcome-rest");
    const identity = await page.locator(".wordmark").first().evaluate(node => {
      const css = getComputedStyle(node), small = getComputedStyle(node.querySelector("small")), box = node.getBoundingClientRect();
      return { width: box.width, height: box.height, family: css.fontFamily, size: css.fontSize, weight: css.fontWeight, gap: css.gap, subtitle: node.querySelector("small").textContent, subSize: small.fontSize, subWeight: small.fontWeight, background: css.backgroundColor, transform: css.transform };
    });
    assert.equal(identity.background, "rgba(0, 0, 0, 0)"); assert.equal(identity.size, "13px"); assert.equal(identity.weight, "600");
    assert.equal(identity.subtitle, "JIE TIAN · LIVING ARCHIVE"); assert.equal(identity.subSize, "8px"); assert.equal(identity.subWeight, "500");
    assert.ok(Math.abs(identity.width - 184.19) < 1);
    report.checks.push({ name: "Locked identity and typography", width, identity });
    await page.getByRole("button", { name: "ENTER THE PALACE", exact: true }).click();
    await ready(); await pose([8, 1.65, 10], [0, 3.3, 0]); await shot("atrium-rest");
    await goto("music"); await pose([1.5, 1.65, 10.8], [0, 2.75, -5]); await shot("music-rest");
    if (stage >= 3) {
      await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
      await page.getByLabel("Import local audio files").setInputFiles({ name: "Motion Study.wav", mimeType: "audio/wav", buffer: await readFile("public/media/generated/palace-study.wav") });
      await page.locator(".record-row").filter({ hasText: "Motion Study" }).locator(".record-title").click();
      await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).waitFor();
      await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "motion-study.lrc", mimeType: "text/plain", buffer: Buffer.from(lyrics) });
      await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
      await shot("player-rest");
      await page.keyboard.press("Escape");
      await pose([6, 1.65, -1.5], [6.8, 4.4, -10.3]);
      await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(6.2));
      await page.waitForFunction(() => window.__PALACE_DEBUG__.audioSignal.available && document.querySelector(".lyric-wall")?.dataset.playing === "true");
      await shot("lyrics-playing", 750);
      await page.locator(".now-playing-tag").getByRole("button", { name: "Pause music", exact: true }).click();
      await shot("lyrics-paused", 1800);
      assert.ok(await page.locator(".lyric-line").count() <= 7);
      const paused = await page.evaluate(() => ({ progress: window.__PALACE_DEV__.audio.getState().progress, line: document.querySelector(".lyric-wall").dataset.line }));
      await page.waitForTimeout(400);
      assert.ok(Math.abs(paused.progress - await page.evaluate(() => window.__PALACE_DEV__.audio.getState().progress)) < 0.01);
      assert.equal(await page.locator(".lyric-wall").getAttribute("data-line"), paused.line);
      report.checks.push({ name: "Original native audio, lyric timing, seven-line limit and pause", width });
      if (stage >= 3) {
        await page.evaluate(() => window.__PALACE_DEV__.library.getState().updateTrack(window.__PALACE_DEV__.audio.getState().currentId, { title: "Motion Study — new title" }));
        await shot("now-playing-rest");
      }
    }
    if (stage >= 5) {
      await goto("projects"); await pose([0, 1.65, 13.8], [0, 3.15, -8]); await shot("projects-rest");
      await page.mouse.move(width * .43, width === 1920 ? 490 : 653); await shot("work-hover", 350);
      const item = await page.evaluate(async () => {
        const response = await fetch("/content/projects.json"), data = await response.json();
        return Array.isArray(data) ? data[0] : data.projects?.[0];
      });
      assert.ok(item?.id);
      await page.evaluate(item => window.__PALACE_DEV__.state.getState().focusItem(item), item);
      await page.getByRole("dialog").waitFor();
      await shot("editorial-detail-rest", 1000);
      await page.keyboard.press("Escape");
      await goto("editorial"); await pose([0, 1.65, 13.8], [0, 3.15, -8]); await shot("editorial-rest");
      report.checks.push({ name: "Original work focus and editorial composition", width });
    }
    if (stage >= 6) {
      await goto("wallpapers"); await pose([2.3, 1.65, 8.5], [0, 3.4, -10]);
      const origin = await page.evaluate(() => { const c = window.__PALACE_DEBUG__.camera; return { position: c.position.toArray(), quaternion: c.quaternion.toArray() }; });
      await page.evaluate(() => { const d = window.__PALACE_DEV__; d.state.getState().openCinema(d.library.getState().wallpapers[0]); });
      await ready(); await shot("cinema-rest", 1200);
      await page.getByRole("button", { name: "Next image", exact: true }).click(); await shot("cinema-next-rest", 1000);
      await page.keyboard.press("i"); await shot("cinema-metadata", 450); await page.keyboard.press("Escape");
      assert.equal(await page.locator(".cinema-metadata").count(), 0);
      await page.keyboard.press("Escape"); await ready();
      const returned = await page.evaluate(() => { const c = window.__PALACE_DEBUG__.camera; return { position: c.position.toArray(), quaternion: c.quaternion.toArray() }; });
      for (const key of ["position", "quaternion"]) returned[key].forEach((x, i) => assert.ok(Math.abs(x - origin[key][i]) < 1e-6));
      report.checks.push({ name: "Cinema controls, one-level Escape and exact original return", width });
    }
    if (stage >= 7) {
      await page.locator(".guide-button").click(); await shot("guide-rest", 500);
      await page.keyboard.press("Escape");
      await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("research")); await ready(); await shot("threshold-rest", 1000);
      await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
      await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("music")); await ready(); await shot("reduced-motion-rest", 1000);
      const active = await page.evaluate(() => document.getAnimations().filter(a => a.id.startsWith("palace:") && a.playState === "running").length);
      assert.equal(active, 0);
      report.checks.push({ name: "Existing room navigation, ready condition and reduced-motion cancellation", width });
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []);
  report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await save(); await browser.close(); }
console.log("Motion phase " + phase + ": " + report.checks.length + " checks, " + report.views.length + " real frames; " + (report.passed ? "PASS" : "FAIL"));
