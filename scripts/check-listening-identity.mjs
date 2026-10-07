import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/quality-leap", "identity-lyrics");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PALACE_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const report = { browser: browser.version(), quality: "medium", dpr: 1, checks: [], skippedChecks: [], brand: [], errors: [], uploads: [] };
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  if (window.top !== window) return;
  window.__QA_AUDIO__ = [];
  window.Audio = new Proxy(window.Audio, { construct(target, args) { const element = Reflect.construct(target, args); window.__QA_AUDIO__.push(element); return element; } });
  if (localStorage.getItem("memory-palace:v3")) return;
  localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, reducedMotion: false, roomSoundtracks: false, mute: true }, version: 0 }));
});
const page = await context.newPage();
page.setDefaultTimeout(40000);
page.on("pageerror", e => report.errors.push(e.message));
page.on("request", request => { if (request.method() === "POST") report.uploads.push(request.url()); });
const ready = async () => {
  await page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__?.camera);
  await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ started: true, overlay: null }));
  await page.evaluate(() => document.fonts.ready);
};
const shot = name => page.screenshot({ path: path.join(out, name + ".png") });
const check = async (name, action) => {
  try {
    if (await action() === false) { report.skippedChecks.push(name + ": local static fixture unavailable"); return; }
    report.checks.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    report.checks.push({ name, passed: false, error: error.message });
    throw error;
  }
};
const player = () => page.evaluate(() => {
  const { currentId, playing, progress, duration, error } = window.__PALACE_DEV__.audio.getState();
  return { currentId, playing, progress, duration, error };
});
const openPlayer = async () => {
  await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
  await page.getByRole("dialog").waitFor();
};
const closePlayer = async () => {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
};
async function pose(position, target) {
  await page.evaluate(({ position, target }) => {
    const { state } = window.__PALACE_DEV__, s = state.getState(), c = window.__PALACE_DEBUG__.camera;
    c.position.set(...position); c.lookAt(...target);
    s.update({ travelSequence: s.travelSequence + 1, returnView: { roomId: s.roomId, position, quaternion: c.quaternion.toArray() } });
  }, { position, target });
  await page.waitForTimeout(1000);
}
const mainTitle = "Palace Study — No. 01";
const lrc = ["A threshold of light", "A note held in glass", "The room remembers a sound", "停在这束光里", "A quiet interval", "The archive keeps listening"]
  .map((line, i) => `[00:${String(i * 4).padStart(2, "0")}.00]${line}`).join("\n");
try {
  await check("floating identity uses the actual self-hosted font, fixed hierarchy, transparent backing and no hover transform", async () => {
    for (const size of [[1920, 1080], [2560, 1440]]) {
      await page.setViewportSize({ width: size[0], height: size[1] });
      for (const room of ["atrium", "music", "archive"]) {
        await page.goto(base + "/" + (room === "atrium" ? "" : room)); await ready(); await page.waitForTimeout(1500);
        const metric = await page.locator(".wordmark").evaluate(el => {
          const main = getComputedStyle(el), sub = getComputedStyle(el.querySelector("small")), bounds = el.getBoundingClientRect();
          return { font: main.fontFamily, loaded: document.fonts.check('600 13px "Space Grotesk"'), size: main.fontSize, weight: main.fontWeight, spacing: main.letterSpacing, background: main.backgroundColor, border: main.borderTopWidth, shadow: main.boxShadow, transform: main.transform, color: main.color, subSize: sub.fontSize, subWeight: sub.fontWeight, subOpacity: sub.opacity, subGap: sub.marginTop, gap: main.gap, width: bounds.width, height: bounds.height, subtitle: el.querySelector("small").textContent };
        });
        assert.ok(metric.loaded && metric.font.includes("Space Grotesk"));
        assert.equal(metric.size, "13px"); assert.equal(metric.weight, "600");
        assert.equal(metric.subSize, "8px"); assert.equal(metric.subWeight, "500"); assert.equal(metric.subOpacity, "0.55");
        assert.equal(metric.background, "rgba(0, 0, 0, 0)"); assert.equal(metric.border, "0px"); assert.equal(metric.shadow, "none");
        if (room !== "atrium") assert.equal(metric.color, "rgb(219, 234, 242)", "dark galleries need readable light identity ink");
        assert.equal(metric.subtitle, "JIE TIAN · LIVING ARCHIVE");
        await page.locator(".wordmark").hover(); await page.waitForTimeout(250);
        assert.equal(await page.locator(".wordmark").evaluate(el => getComputedStyle(el).transform), metric.transform);
        await page.mouse.move(1700, 800);
        report.brand.push({ room, resolution: size, ...metric });
        await shot(`${room}-identity-${size[0]}`);
        await page.screenshot({ path: path.join(out, `${room}-mark-${size[0]}.png`), clip: { x: 26, y: 18, width: 300, height: 80 } });
        if (room === "atrium") {
          await pose([8, 1.65, 10], [0, 3.3, 0]);
          await shot(`atrium-bright-identity-${size[0]}`);
          report.brand.push({ room: "atrium-bright", resolution: size, color: await page.locator(".wordmark").evaluate(el => getComputedStyle(el).color) });
        }
      }
    }
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(base + "/music"); await ready();
  if (process.env.PALACE_CLOUDMUSIC === "1") await check("all local CloudMusic records play through the existing native player without stacking players", async () => {
    const tracks = await page.evaluate(() => window.__PALACE_DEV__.library.getState().music.filter(t => t.id.includes("636c6f75646d75736963" )).map(t => ({ id: t.id, title: t.title })));
    assert.equal(tracks.length, 38);
    report.cloudMusic = [];
    await openPlayer();
    await page.getByLabel("Crossfade duration").selectOption("0");
    for (const track of tracks) {
      await page.locator(`.record-row[data-track-id="${track.id}"] .record-title`).click();
      await page.waitForFunction(id => { const a = window.__PALACE_DEV__.audio.getState(); return a.currentId === id && a.playing && a.duration > 0; }, track.id);
      await page.waitForTimeout(350);
      const actual = await player(); assert.equal(actual.error, null); assert.ok(actual.progress > 0);
      assert.equal(await page.evaluate(() => window.__QA_AUDIO__.filter(a => !a.paused && !a.ended && a.currentSrc).length), 1);
      assert.equal(await page.evaluate(() => window.__QA_AUDIO__.length), 2);
      report.cloudMusic.push({ title: track.title, duration: actual.duration, progress: actual.progress, playing: actual.playing });
    }
    await closePlayer();
    await page.locator(".now-playing-tag").getByRole("button", { name: "Pause music", exact: true }).click();
  });
  else report.skippedChecks.push("CloudMusic batch playback: enable PALACE_CLOUDMUSIC=1 only on a local collection with those 38 source files.");
  await check("local timed lyrics attach to the selected audio and follow playback, forward seek, backward seek and pause", async () => {
    await openPlayer();
    await page.getByLabel("Import local audio files").setInputFiles({ name: mainTitle + ".wav", mimeType: "audio/wav", buffer: await readFile("public/media/generated/palace-study.wav") });
    const row = page.locator(".record-row").filter({ hasText: mainTitle }); await row.waitFor(); await row.locator(".record-title").click();
    await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).waitFor();
    await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "palace-study.lrc", mimeType: "text/plain", buffer: Buffer.from(lrc) });
    await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
    await page.locator(".collection-panel").evaluate(el => { el.scrollTop = 0; }); await shot("lyrics-panel"); await closePlayer();
    await pose([6, 1.65, -1.5], [6.8, 4.4, -10.3]);
    await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(13));
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "3");
    assert.equal(await page.locator(".lyric-line.is-current").innerText(), "停在这束光里");
    // 先在真实播放时钟的当前窗口验值，截图耗时不应把录音推进到下一句后再验前一句。
    await page.waitForTimeout(1000); await shot("lyrics-playing");
    const active = await page.locator(".lyric-line.is-current").evaluate(el => el.getBoundingClientRect());
    assert.ok(active.width > 80 && active.height > 10);
    await page.locator(".now-playing-tag").getByRole("button", { name: "Pause music", exact: true }).click();
    const paused = await player(); await page.waitForTimeout(900); assert.ok(Math.abs((await player()).progress - paused.progress) < 0.1);
    await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(5));
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "1"); await page.waitForTimeout(1000); await shot("lyrics-seek-paused");
    const signal = await page.evaluate(() => ({ ...window.__PALACE_DEBUG__.audioSignal })); assert.equal(signal.available, false);
    const strips = await page.evaluate(() => window.__PALACE_DEBUG__.scene.getObjectByName("rhythm-light-details").children.map(x => x.material.emissiveIntensity));
    assert.ok(strips.every(x => Math.abs(x - 0.08) < 0.003));
  });
  await check("the physical lyric surface hides from behind, tracks the camera and remains aligned at 1440p", async () => {
    await pose([6.8, 1.65, -14], [6.8, 4.4, -10.3]);
    assert.equal(await page.locator(".lyrics-projection").evaluate(el => getComputedStyle(el).visibility), "hidden");
    await pose([6, 1.65, -1.5], [6, 1.65, 10]);
    assert.equal(await page.locator(".lyrics-projection").evaluate(el => getComputedStyle(el).visibility), "hidden");
    await page.setViewportSize({ width: 2560, height: 1440 });
    await pose([6, 1.65, -1.5], [6.8, 4.4, -10.3]);
    assert.equal(await page.locator(".lyrics-projection").evaluate(el => getComputedStyle(el).visibility), "visible");
    await shot("lyrics-wall-2560"); await page.setViewportSize({ width: 1920, height: 1080 });
  });
  await check("a rebuilt static resource follows the manifest while v1 favorite and metadata records survive", async () => {
    const source = await page.evaluate(async () => {
      const track = window.__PALACE_DEV__.library.getState().music.find(t => t.src && t.source === "static");
      if (!track) return null;
      const { writeLibraryRecord } = await import("/src/systems/idb.ts");
      await writeLibraryRecord({ id: track.id, collection: "music", data: { ...track, src: "/personal-media/music/obsolete-v1.mp3", favorite: true } });
      return { id: track.id, src: track.src };
    });
    if (!source) return false;
    await page.reload(); await ready();
    const restored = await page.evaluate(id => window.__PALACE_DEV__.library.getState().music.find(t => t.id === id), source.id);
    assert.equal(restored.src, source.src); assert.equal(restored.favorite, true);
  });
  await check("lyric metadata and timing edits survive refresh without losing the audio blob", async () => {
    await openPlayer(); await page.getByRole("button", { name: `Edit ${mainTitle}`, exact: true }).click();
    await page.getByLabel("Lyric timing offset").fill("2"); await page.getByRole("button", { name: /SAVE NOTES/ }).click();
    await closePlayer(); const id = (await player()).currentId; await page.reload(); await ready();
    const track = await page.evaluate(id => window.__PALACE_DEV__.library.getState().music.find(t => t.id === id), id);
    assert.equal(track.lyricsOffset, 2); assert.equal(track.lyrics.lines.length, 6); assert.ok(track.src.startsWith("blob:"));
    await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(6.5));
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "2");
  });
  await check("invalid lyric imports preserve the previous lyrics and untimed text stays honest and scrollable", async () => {
    await openPlayer();
    await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "no-lyrics.lrc", mimeType: "text/plain", buffer: Buffer.from("[00:00.00]暂无歌词") });
    await page.getByText("No readable lyrics in this file. Choose another file.", { exact: true }).waitFor();
    await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
    await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "local-notes.txt", mimeType: "text/plain", buffer: Buffer.from("Untimed local words\nThese notes have no invented timestamps.\n" + Array.from({ length: 40 }, (_, i) => `Local reading test ${i + 1}`).join("\n")) });
    await page.getByText("Untimed lyrics · scroll to read", { exact: true }).waitFor(); await closePlayer();
    assert.equal(await page.locator(".lyric-wall").getAttribute("data-line"), "-1"); assert.equal(await page.locator(".lyric-untimed").getAttribute("tabindex"), "0");
    await pose([6, 1.65, -1.5], [6.8, 4.4, -10.3]);
    assert.equal(await page.locator(".lyrics-projection").evaluate(el => getComputedStyle(el).visibility), "visible");
    const view = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await page.locator(".lyric-untimed").focus();
    assert.ok(await page.locator(".lyric-untimed").evaluate(el => document.activeElement === el));
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(500);
    assert.ok(await page.locator(".lyric-untimed").evaluate(el => el.scrollTop > 0));
    assert.deepEqual(await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray()), view);
    await page.keyboard.press("Escape");
    await page.keyboard.down("w"); await page.waitForTimeout(180); await page.keyboard.up("w");
    assert.notDeepEqual(await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray()), view);
    await shot("lyrics-untimed");
    await openPlayer(); await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "palace-study.lrc", mimeType: "text/plain", buffer: Buffer.from(lrc) }); await closePlayer();
  });
  await check("long timed lyrics keep seven live lines, snap on a long seek, and obey reduced motion", async () => {
    await openPlayer();
    const long = Array.from({ length: 200 }, (_, i) => `[00:${(i * 0.15).toFixed(2).padStart(5, "0")}]Original test line ${i}`).join("\n");
    await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "long-study.lrc", mimeType: "text/plain", buffer: Buffer.from(long) });
    await closePlayer(); await pose([6, 1.65, -1.5], [6.8, 4.4, -10.3]);
    await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(25));
    await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "166");
    assert.ok(await page.locator(".lyric-line").count() <= 7);
    assert.equal(await page.locator(".lyric-roll").evaluate(el => getComputedStyle(el).transitionDuration), "0s");
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
    await page.evaluate(() => window.__PALACE_DEV__.audio.getState().seek(25.1));
    assert.ok(await page.locator(".lyric-roll").evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < 0.001));
    await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: false }));
    await openPlayer(); await page.getByLabel("Import lyrics for current track").setInputFiles({ name: "palace-study.lrc", mimeType: "text/plain", buffer: Buffer.from(lrc) }); await closePlayer();
  });
  await check("changing tracks clears the previous lyric identity and offers a real local LRC import entry", async () => {
    await openPlayer(); const other = page.locator(".record-row").filter({ has: page.getByRole("button", { name: "Edit 日落大道", exact: true }) }).filter({ hasText: "Personal collection" });
    if (await other.count()) await other.locator(".record-title").click();
    else {
      await page.getByLabel("Import local audio files").setInputFiles({ name: "Palace Study — no lyrics.wav", mimeType: "audio/wav", buffer: await readFile("public/media/generated/palace-study.wav") });
      await page.locator(".record-row").filter({ hasText: "Palace Study — no lyrics" }).locator(".record-title").click();
    }
    await closePlayer(); await page.locator(".lyric-empty").waitFor(); assert.equal(await page.locator(".lyric-line").count(), 0);
    await page.getByRole("button", { name: "IMPORT LOCAL LRC →", exact: true }).click(); await page.getByRole("dialog").waitFor(); await closePlayer();
    assert.equal(report.uploads.length, 0);
  });
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
