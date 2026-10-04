import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
const output = process.env.PALACE_ARTIFACTS || "qa-artifacts/room-soundtracks";
const base = process.env.PALACE_URL || "http://127.0.0.1:5186";
await mkdir(output, { recursive: true });
// A long, quiet fixture avoids a short recording ending while software WebGL compiles.
const samples = 22050 * 90,
  pcm = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i++)
  pcm.writeInt16LE(
    Math.round(Math.sin((i * 2 * Math.PI * 220) / 22050) * 100),
    i * 2,
  );
const wav = Buffer.alloc(44 + pcm.length);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(22050, 24);
wav.writeUInt32LE(44100, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(pcm.length, 40);
pcm.copy(wav, 44);
const browser = await chromium.launch({
  executablePath: process.env.PALACE_BROWSER,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
});
await context.addInitScript(() => {
  if (!localStorage.getItem("memory-palace:v3"))
    localStorage.setItem(
      "memory-palace:v3",
      JSON.stringify({
        state: {
          quality: "medium",
          reducedMotion: true,
          tutorialDone: true,
          mute: true,
          musicVolume: 0.01,
        },
        version: 0,
      }),
    );
});
await context.addInitScript(() => {
  window.audioCalls = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.audioCalls.push({ src: this.src, time: Date.now() });
    return play.call(this).catch((error) => {
      window.audioCalls.push({ error: error.message });
      throw error;
    });
  };
});
const page = await context.newPage();
page.setDefaultTimeout(90000);
const report = { checks: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
const ready = async () => {
  await page.waitForFunction(() => Boolean(window.__PALACE_DEBUG__?.camera));
};
async function travel(title, id) {
  await page.keyboard.press("m");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.waitForFunction(
    (room) => window.__PALACE_DEBUG__?.roomId === room,
    id,
  );
}
async function shelf() {
  if (await page.locator(".now-playing-open").count())
    await page.locator(".now-playing-open").click();
  else await page.getByRole("button", { name: "OPEN COLLECTION" }).click();
}
async function playing(title) {
  await page.waitForFunction(
    (name) =>
      document.querySelector(".record-information h3")?.textContent === name,
    title,
  );
  await page
    .getByRole("button", { name: "Pause music", exact: true })
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[aria-label="Track progress"]').value) >
      0.2,
  );
}
try {
  await page.goto(base + "/music");
  await ready();
  await shelf();
  assert.equal(
    await page
      .getByRole("button", { name: "Pause music", exact: true })
      .count(),
    0,
  );
  await page
    .getByLabel("Import local audio files")
    .setInputFiles({
      name: "Room soundtrack test.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await page
    .getByRole("button", { name: "Edit Room soundtrack test", exact: true })
    .click();
  await page.getByLabel("Play in rooms").selectOption("editorial");
  await page.getByRole("button", { name: "SAVE NOTES" }).click();
  await page.locator(".metadata-form").waitFor({ state: "hidden" });
  await page.reload();
  await ready();
  await shelf();
  await page
    .getByRole("button", { name: "Edit Room soundtrack test", exact: true })
    .click();
  assert.deepEqual(
    await page
      .getByLabel("Play in rooms")
      .evaluate((select) =>
        Array.from(select.selectedOptions).map((o) => o.value),
      ),
    ["editorial"],
  );
  await page.getByRole("button", { name: "Close record editor" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Unmute all sound" }).click();
  await travel("THE EDITORIAL STUDIO", "editorial");
  await shelf();
  await playing("Room soundtrack test");
  await page.screenshot({
    path: path.join(output, "editorial-assigned-music.png"),
  });
  await page.keyboard.press("Escape");
  await travel("THE ARCHIVE", "archive");
  await shelf();
  await playing("Welcome Home, Son");
  await page.screenshot({
    path: path.join(output, "archive-assigned-music.png"),
  });
  report.checks.push(
    "No song starts before a trusted gesture.",
    "Room assignment persists through reload in IndexedDB.",
    "Entering Editorial automatically plays its assigned imported WAV.",
    "Entering Archive switches to the complete user song Welcome Home, Son and progresses.",
  );
  await page.keyboard.press("Escape");
  await travel("LIQUID WEB", "liquid-web");
  await ready();
  await page.waitForTimeout(1800);
  await page.locator("canvas").click({ position: { x: 800, y: 450 } });
  await page.getByRole("link", { name: "SOURCE", exact: true }).waitFor();
  const enter = page.getByRole("link", { name: "ENTER PROJECT", exact: true });
  assert.match(
    await enter.getAttribute("href"),
    /^\/personal-media\/projects\/liquid-web\/.+\.html$/,
  );
  const popupPromise = page.waitForEvent("popup");
  await enter.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.match(popup.url(), /personal-media\/projects\/liquid-web/);
  assert.ok((await popup.locator("body").innerText()).length > 200);
  report.checks.push(
    "Clicking the giant Liquid Web screen exposes SOURCE and opens the real private local website with ENTER PROJECT.",
  );
  await popup.close();
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  report.diagnostics = await page.evaluate(() => ({
    body: document.body.innerText,
    settings: localStorage.getItem("memory-palace:v3"),
    audioCalls: window.audioCalls,
  }));
  await page.screenshot({ path: path.join(output, "room-music-failure.png") });
  throw error;
} finally {
  await writeFile(
    path.join(output, "room-soundtracks.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
