import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// 仅在本机显式运行；报告不保留私人曲名、路径、歌词或原素材 ID。
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/local-audio-batch");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: false, args: ["--use-angle=d3d11", "--window-size=1920,1080"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  window.__BATCH_AUDIO__ = [];
  window.Audio = new Proxy(window.Audio, { construct(target, args) { const audio = Reflect.construct(target, args); window.__BATCH_AUDIO__.push(audio); return audio; } });
  localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false, mute: false }, version: 0 }));
});
const report = { browser: browser.version(), headed: true, scope: "Native UI playback of the existing local CloudMusic catalog in a fresh page. No private names, source IDs or file paths retained. Existing two-slot player only.", expected: 38, samples: [], errors: [], uploads: [], passed: false };
const page = await context.newPage(); page.setDefaultTimeout(45000);
page.on("pageerror", () => report.errors.push("Runtime error; inspect local browser manually."));
page.on("request", r => { if (r.method() === "POST") report.uploads.push("unexpected upload"); });
try {
  await page.goto((process.env.PALACE_URL || "http://127.0.0.1:5190") + "/music");
  await page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEV__?.library.getState().ready);
  const tracks = await page.evaluate(() => window.__PALACE_DEV__.library.getState().music.filter(t => t.id.includes("636c6f75646d75736963")).map(t => t.id));
  assert.equal(tracks.length, report.expected);
  await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
  await page.getByLabel("Crossfade duration").selectOption("0");
  for (const [index, id] of tracks.entries()) {
    await page.locator(`.record-row[data-track-id="${id}"] .record-title`).click();
    await page.waitForFunction(id => { const a = window.__PALACE_DEV__.audio.getState(); return a.currentId === id && a.playing && a.duration > 0; }, id);
    await page.waitForTimeout(650);
    const actual = await page.evaluate(() => {
      const s = window.__PALACE_DEV__.audio.getState();
      return { duration: s.duration, progress: s.progress, playing: s.playing, hasError: !!s.error,
        playingSlots: window.__BATCH_AUDIO__.filter(a => !a.paused && !a.ended && a.currentSrc).length, allocatedSlots: window.__BATCH_AUDIO__.length };
    });
    assert.equal(actual.hasError, false); assert.ok(actual.progress > 0); assert.equal(actual.playingSlots, 1); assert.equal(actual.allocatedSlots, 2);
    report.samples.push({ item: index + 1, digest: createHash("sha256").update(id).digest("hex").slice(0, 12), ...actual });
    await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2));
    console.log("PASS local audio item " + (index + 1) + " / " + report.expected);
  }
  await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).click();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) {
  report.failure = "Local audio check failed at item " + (report.samples.length + 1) + "; " + error.name;
  process.exitCode = 1; console.error(report.failure);
} finally {
  await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
