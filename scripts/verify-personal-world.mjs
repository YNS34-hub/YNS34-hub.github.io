import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
const base = process.env.PALACE_URL || "http://127.0.0.1:5186";
const output = path.resolve(
  process.env.PALACE_ARTIFACTS || "qa-artifacts/personal-world",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PALACE_BROWSER || undefined,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
});
await context.addInitScript(() =>
  localStorage.setItem(
    "memory-palace:v3",
    JSON.stringify({
      state: {
        quality: "medium",
        tutorialDone: true,
        mute: true,
        reducedMotion: true,
      },
      version: 0,
    }),
  ),
);
const page = await context.newPage();
page.setDefaultTimeout(60000);
const report = { checks: [], errors: [], external: [], screenshots: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
page.on("request", (r) => {
  if (
    /^https?:/.test(r.url()) &&
    new URL(r.url()).origin !== new URL(base).origin
  )
    report.external.push(r.url());
});
const ready = async () => {
  await page.locator(".world-ready").waitFor();
  await page.waitForTimeout(1000);
};
const photograph = async (name) => {
  await page.screenshot({ path: path.join(output, name + ".png") });
  report.screenshots.push(name);
};
async function travel(title, id) {
  await page.keyboard.press("m");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.waitForURL("**/" + id);
  await ready();
}
async function walk() {
  const start = await page.evaluate(
    () => window.__PALACE_DEBUG__.camera.position.z,
  );
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(
      (z) => window.__PALACE_DEBUG__.camera.position.z < z - 0.2,
      start,
      { timeout: 20000 },
    );
  } finally {
    await page.keyboard.up("w");
  }
}
try {
  await page.goto(base);
  await ready();
  await page.getByRole("button", { name: "ENTER THE PALACE" }).click();
  await walk();
  await photograph("walk-atrium");
  for (const [title, id] of [
    ["PROJECT GALLERY", "projects"],
    ["RESEARCH VAULT", "research"],
    ["PERSONAL LISTENING ROOM", "music"],
    ["THE WALLPAPER VAULT", "wallpapers"],
    ["AI VISUAL ARCHIVE", "imagined-worlds"],
    ["THE ARCHIVE", "archive"],
    ["UNFINISHED WING", "unfinished"],
    ["MY COLLECTION", "my-collection"],
  ]) {
    await travel(title, id);
    await walk();
    await photograph("walk-" + id);
  }
  report.checks.push(
    "Native Guide travel and WASD walk through Atrium and eight destinations, including My Collection.",
  );
  await page.goto(base + "/projects");
  await ready();
  const start = await page.evaluate(() =>
    window.__PALACE_DEBUG__.camera.position.toArray(),
  );
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(
      (z) => window.__PALACE_DEBUG__.camera.position.z < z - 0.2,
      start[2],
      { timeout: 20000 },
    );
  } finally {
    await page.keyboard.up("w");
  }
  const end = await page.evaluate(() =>
    window.__PALACE_DEBUG__.camera.position.toArray(),
  );
  assert.ok(end[2] < start[2] - 0.15);
  report.checks.push("Native WASD movement in Project Gallery.");
  await page.goto(base + "/wallpapers");
  await ready();
  await page.getByRole("button", { name: "OPEN COLLECTION" }).click();
  const originalCount = await page.locator(".visual-work").count();
  await page.getByLabel("Import local wallpaper images").setInputFiles({
    name: "qa-private-wallpaper.png",
    mimeType: "image/png",
    buffer: await readFile("public/media/projects/the-memory-palace.png"),
  });
  await page.waitForFunction(
    (n) => document.querySelectorAll(".visual-work").length === n + 1,
    originalCount,
  );
  await page
    .getByRole("button", { name: "ENTER WALLPAPER CINEMA" })
    .first()
    .click();
  await page.waitForURL("**/cinema");
  await ready();
  await page.waitForTimeout(7000);
  const first = await page.locator(".cinema-controls span").innerText();
  await page.keyboard.press("ArrowRight");
  const second = await page.locator(".cinema-controls span").innerText();
  assert.notEqual(first, second);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator(".cinema-controls span").innerText(), first);
  const favorite = page.getByRole("button", { name: "Favorite image" });
  const before = await favorite.getAttribute("aria-pressed");
  await favorite.click();
  assert.notEqual(await favorite.getAttribute("aria-pressed"), before);
  await page.keyboard.press("i");
  await page.locator(".cinema-metadata").waitFor();
  await photograph("cinema");
  await page.keyboard.press("Escape");
  await page.waitForURL("**/wallpapers");
  report.checks.push(
    "Cinema previous/next keyboard navigation, persistent favorite, metadata and ESC return.",
  );
  await page.reload();
  await ready();
  await page.getByRole("button", { name: "OPEN COLLECTION" }).click();
  assert.equal(await page.locator(".visual-work").count(), originalCount + 1);
  report.checks.push(
    "Image import Blob and metadata survive reload in IndexedDB.",
  );
  await page
    .getByRole("button", { name: "ENTER WALLPAPER CINEMA" })
    .first()
    .click();
  await page.waitForURL("**/cinema");
  assert.notEqual(
    await page
      .getByRole("button", { name: "Favorite image" })
      .getAttribute("aria-pressed"),
    before,
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.goto(base + "/music");
  await ready();
  await page.getByRole("button", { name: "OPEN COLLECTION" }).click();
  assert.ok((await page.locator(".record-list").innerText()).includes("梁博"));
  await page
    .getByLabel("Import local audio files")
    .setInputFiles(
      process.env.PALACE_AUDIO_FIXTURE ||
        "public/media/generated/palace-study.wav",
    );
  await page.waitForFunction(
    () => document.querySelectorAll(".record-row").length === 5,
  );
  await page.locator(".record-title").last().click();
  await page
    .getByRole("button", { name: "Pause music", exact: true })
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[aria-label="Track progress"]').value) >
      0.2,
  );
  await page.waitForTimeout(800);
  if (process.env.PALACE_AUDIO_FIXTURE) {
    await page
      .getByRole("button", { name: "Edit Local metadata study", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Title", { exact: true }).inputValue(),
      "Local metadata study",
    );
    assert.equal(
      await page.getByLabel("Artist", { exact: true }).inputValue(),
      "Palace QA",
    );
    assert.equal(
      await page.getByLabel("Album", { exact: true }).inputValue(),
      "Private library test",
    );
    await page.getByAltText("Current album artwork").waitFor();
    assert.ok(
      Number(await page.getByLabel("Track progress").getAttribute("max")) > 3,
    );
    await page.getByRole("button", { name: "Close record editor" }).click();
    report.checks.push(
      "MP3 title, artist, album, attached artwork and duration read from file tags.",
    );
  }
  await photograph("imported-audio");
  await page.reload();
  await ready();
  await page.getByRole("button", { name: "OPEN COLLECTION" }).click();
  assert.equal(await page.locator(".record-row").count(), 5);
  await page.locator(".record-title").last().click();
  await page
    .getByRole("button", { name: "Pause music", exact: true })
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[aria-label="Track progress"]').value) >
      0.2,
  );
  report.checks.push(
    "Local audio import/playback and library restoration; Liang Bo shelf contains metadata only.",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
} finally {
  await writeFile(
    path.join(output, "verification.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
