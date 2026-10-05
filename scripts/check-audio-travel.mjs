import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.PALACE_URL || "http://127.0.0.1:4173";
const output = process.env.PALACE_ARTIFACTS || path.resolve("qa-artifacts");
const report = {
  base,
  checkedAt: new Date().toISOString(),
  scope:
    "Explicit playback of the repository's self-made Palace Study WAV, imported through local audio UI, through Guide travel between three 3D rooms; real native Audio objects observed through CDP, with no application debug exports or injected global state.",
  checks: [],
  observations: [],
  errors: [],
  uploads: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PALACE_BROWSER ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  localStorage.setItem(
    "memory-palace:v3",
    JSON.stringify({
      state: { quality: "low", tutorialDone: true, reducedMotion: true },
      version: 0,
    }),
  );
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("request", (request) => { if (request.method() === "POST") report.uploads.push(request.url()); });
page.on("console", (message) => {
  if (message.type() === "error") report.errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    report.errors.push(`${response.status()} ${response.url()}`);
});
const session = await context.newCDPSession(page);
const objectGroup = "palace-native-audio-qa";
async function call(
  objectId,
  functionDeclaration,
  returnByValue = true,
  args = [],
) {
  const result = await session.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration,
    returnByValue,
    arguments: args,
    objectGroup,
  });
  assert.equal(
    result.exceptionDetails,
    undefined,
    "native Audio inspection must succeed",
  );
  return result.result;
}
let prototypeId;
async function audioElements() {
  const { objects } = await session.send("Runtime.queryObjects", {
    prototypeObjectId: prototypeId,
    objectGroup,
  });
  return objects.objectId;
}
async function snapshot(objectId) {
  return (
    await call(
      objectId,
      `function () {
    return { src: this.currentSrc || this.src, paused: this.paused,
      ended: this.ended, currentTime: this.currentTime, duration: this.duration,
      readyState: this.readyState };
  }`,
    )
  ).value;
}
async function guideTravel(room, title) {
  await page.locator(".guide-button").click();
  await page
    .getByRole("dialog", { name: "Museum guide", exact: true })
    .waitFor();
  await page.locator(".room-link").filter({ hasText: title }).click();
  await page.locator(".room-caption").filter({ hasText: title }).waitFor();
  assert.equal(new URL(page.url()).pathname, `/${room}`);
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "destination must be a 3D room",
  );
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Guide should close after travel",
  );
  await page.waitForTimeout(900);
}

try {
  await page.goto(`${base}/music`);
  await page
    .locator(".room-caption")
    .filter({ hasText: "LISTENING ROOM" })
    .waitFor();
  await page.locator(".world-ready").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Pause music", exact: true })
      .count(),
    0,
    "music must not autoplay",
  );
  await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
  await page
    .getByRole("dialog", { name: "Listening collection", exact: true })
    .waitFor();
  await page.getByLabel("Import local audio files").setInputFiles({
    name: "Palace Study — No. 01.wav",
    mimeType: "audio/wav",
    buffer: await readFile("public/media/generated/palace-study.wav"),
  });
  await page
    .locator(".record-row")
    .filter({ hasText: "Palace Study — No. 01" })
    .locator(".record-title")
    .click();
  await page
    .getByRole("dialog", { name: "Listening collection", exact: true })
    .getByRole("button", { name: "Pause music", exact: true })
    .waitFor();
  await page.waitForTimeout(750);
  const prototype = await session.send("Runtime.evaluate", {
    expression: "HTMLAudioElement.prototype",
    objectGroup,
  });
  prototypeId = prototype.result.objectId;
  const elements = await audioElements();
  const active = await call(
    elements,
    `function () {
    return this.find(element => !element.paused && element.currentSrc.startsWith('blob:'));
  }`,
    false,
  );
  assert.ok(
    active.objectId,
    "explicit Play must start a real native Audio element",
  );
  const nativeCount = (
    await call(elements, "function () { return this.length; }")
  ).value;
  assert.equal(nativeCount, 2, "the player owns two native crossfade slots");
  const eventLog = await call(
    active.objectId,
    `function () {
    const events = [];
    for (const type of ['pause', 'ended', 'emptied', 'abort']) {
      this.addEventListener(type, () => events.push({ type, currentTime: this.currentTime }));
    }
    return events;
  }`,
    false,
  );
  let previous = await snapshot(active.objectId);
  assert.equal(previous.paused, false);
  assert.ok(previous.currentTime > 0.2);
  assert.ok(previous.readyState >= 2);
  const source = previous.src;
  report.observations.push({
    room: "music",
    nativeAudioCount: nativeCount,
    ...previous,
  });
  report.checks.push("Palace Study starts only after an explicit user click");
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Listening collection", exact: true })
    .waitFor({ state: "hidden" });
  for (const [room, title] of [
    ["projects", "PROJECT GALLERY"],
    ["research", "RESEARCH VAULT"],
  ]) {
    await guideTravel(room, title);
    const currentElements = await audioElements();
    const currentCount = (
      await call(currentElements, "function () { return this.length; }")
    ).value;
    assert.equal(
      currentCount,
      nativeCount,
      "room travel must not recreate the Audio slots",
    );
    const sameElement = (
      await call(
        active.objectId,
        "function (elements) { return elements.includes(this); }",
        true,
        [{ objectId: currentElements }],
      )
    ).value;
    assert.equal(
      sameElement,
      true,
      "the same native Audio object must remain alive",
    );
    const current = await snapshot(active.objectId);
    assert.equal(
      current.src,
      source,
      "room travel must preserve the track source",
    );
    assert.equal(current.paused, false, "room travel must not pause music");
    assert.equal(current.ended, false);
    assert.ok(
      current.currentTime > previous.currentTime + 0.3,
      "playback position must continue growing across room travel",
    );
    await page
      .locator(".now-playing-tag")
      .filter({ hasText: "Palace Study — No. 01" })
      .waitFor();
    await page
      .locator(".now-playing-tag")
      .getByRole("button", { name: "Pause music", exact: true })
      .waitFor();
    report.observations.push({
      room,
      nativeAudioCount: currentCount,
      sameNativeAudioElement: sameElement,
      ...current,
    });
    report.checks.push(
      `Guide travel to ${room} preserves native Audio identity, track and advancing playback`,
    );
    previous = current;
    console.log(
      `PASS ${room}: same native Audio, paused=false, time=${current.currentTime.toFixed(3)}s`,
    );
  }
  report.nativeAudioEventsDuringTravel = (
    await call(eventLog.objectId, "function () { return this; }")
  ).value;
  assert.deepEqual(
    report.nativeAudioEventsDuringTravel,
    [],
    "travel must not emit pause, ended, emptied or abort",
  );
  await guideTravel("music", "PERSONAL LISTENING ROOM");
  await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
  await page.getByLabel("Import lyrics for current track").setInputFiles({
    name: "palace-study.lrc", mimeType: "text/plain",
    buffer: Buffer.from("[00:00]A threshold of light\n[00:04]A note held in glass\n[00:08]停在这束光里"),
  });
  await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).click();
  const seek = page.getByLabel("Track progress", { exact: true });
  await seek.press("Home");
  await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "0");
  for (let i = 0; i < 50; i++) await seek.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector(".lyric-wall")?.dataset.line === "1");
  assert.ok(Math.abs((await snapshot(active.objectId)).currentTime - 5) < 0.2);
  await page.waitForTimeout(600);
  assert.equal(await page.locator(".lyric-wall").getAttribute("data-line"), "1");
  await page.locator(".collection-panel").evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: path.join(output, "production-lyrics-panel.png") });
  report.checks.push("Production local LRC binds to the native recording; real keyboard seeking and pause keep the wall synchronized");
  await page.reload(); await page.locator(".world-ready").waitFor();
  assert.equal(await page.evaluate(() => "__PALACE_DEBUG__" in window || "__PALACE_DEV__" in window), false);
  await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
  await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).count(), 0);
  await page.getByRole("dialog").getByRole("button", { name: "Play music", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('600 13px "Space Grotesk"')));
  assert.deepEqual(report.uploads, []);
  report.checks.push("Production audio blob and lyric metadata survive refresh; explicit Play resumes them, self-hosted typography loads and no upload occurs");
  assert.deepEqual(report.errors, [], "there must be no browser errors");
  report.exitCode = 0;
  console.log(
    "PASS production audio and lyric regression; 5 checks, native Audio preserved across rooms and local lyrics restored after refresh",
  );
} catch (error) {
  report.failure = error.stack || String(error);
  report.exitCode = 1;
  process.exitCode = 1;
  console.error(report.failure);
} finally {
  await writeFile(
    path.join(output, "palace-audio-travel-report.json"),
    JSON.stringify(report, null, 2),
  );
  await session
    .send("Runtime.releaseObjectGroup", { objectGroup })
    .catch(() => undefined);
  await browser.close();
}
