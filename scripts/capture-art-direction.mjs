import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Run against Vite's development server: scene inspection is deliberately absent
// from production. Regression scripts separately exercise the production build.
const base = process.env.PALACE_URL || "http://127.0.0.1:5173";
const output =
  process.env.PALACE_ARTIFACTS || path.resolve("qa-artifacts/art-direction");
const rooms = (
  process.env.PALACE_ROOMS ||
  "atrium,projects,research,music,wallpapers,imagined-worlds,archive,unfinished"
).split(",");
const story = process.env.PALACE_STORY === "1";
const moments = process.env.PALACE_MOMENTS === "1";
const report = {
  base,
  checkedAt: new Date().toISOString(),
  viewport: [1600, 1000],
  renderer:
    "Headless Chromium / SwiftShader; draw counts are not hardware FPS measurements.",
  scenes: [],
  checks: [],
  errors: [],
  externalRequests: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PALACE_BROWSER || undefined,
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
await context.addInitScript(() => {
  if (!localStorage.getItem("memory-palace:v3")) {
    localStorage.setItem(
      "memory-palace:v3",
      JSON.stringify({
        state: {
          quality: "medium",
          reducedMotion: true,
          tutorialDone: true,
          mute: true,
        },
        version: 0,
      }),
    );
  }
});
const page = await context.newPage();
page.setDefaultTimeout(90000);
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    report.errors.push(`${response.status()} ${response.url()}`);
});
page.on("request", (request) => {
  if (
    /^https?:/.test(request.url()) &&
    new URL(request.url()).origin !== new URL(base).origin
  )
    report.externalRequests.push(request.url());
});
async function frames(count = 6) {
  const frame = await page.evaluate(
    () => window.__PALACE_DEBUG__.renderer.info.render.frame,
  );
  await page.waitForFunction(
    ({ frame, count }) =>
      window.__PALACE_DEBUG__.renderer.info.render.frame >= frame + count,
    { frame, count },
  );
}
async function arrive(room) {
  await page.goto(base + (room === "atrium" ? "/" : `/${room}`));
  await page.locator(".world-ready").waitFor();
  await page.waitForFunction(() => Boolean(window.__PALACE_DEBUG__?.scene));
  await frames();
  await page.waitForTimeout(400);
}
async function photograph(name) {
  // Presence alone is not a finished visual state; let native overlay animations settle.
  await page.waitForTimeout(700);
  const stats = await page.evaluate(() => {
    const d = window.__PALACE_DEBUG__;
    return d
      ? {
          room: d.roomId,
          position: d.camera.position.toArray(),
          calls: d.renderer.info.render.calls,
          triangles: d.renderer.info.render.triangles,
          textures: d.renderer.info.memory.textures,
          residentCorridorChunks: d.residentCorridorChunks,
          gravityAngle: d.scene.getObjectByName("gravity-architecture")
            ?.rotation.z,
        }
      : null;
  });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(layout.scrollWidth <= layout.width, `${name}: horizontal overflow`);
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  report.scenes.push({ name, ...stats, ...layout });
  console.log("CAPTURED", name, JSON.stringify(stats));
}
async function position(x, y, z) {
  await page.evaluate(
    ([x, y, z]) => window.__PALACE_DEBUG__.camera.position.set(x, y, z),
    [x, y, z],
  );
  await frames(4);
}
try {
  for (const room of rooms) {
    await arrive(room);
    await photograph(room);
  }
  if (story) {
    await arrive("corridor");
    for (const [phase, z] of [
      [2, -28],
      [3, -55],
      [4, -80],
      [5, -108],
    ]) {
      await position(0, 1.65, z);
      await photograph(`corridor-phase-${phase}`);
    }
    for (const rule of [
      "mirror",
      "compressing",
      "impossible",
      "floating",
      "loop",
      "memory",
    ]) {
      await arrive(rule === "memory" ? "memory" : `anomaly-${rule}`);
      await photograph(rule);
      if (rule === "impossible") {
        await position(0, 1.65, 4);
        await photograph("impossible-inside");
      }
    }
  }
  if (story || moments) {
    await arrive("anomaly-gravity");
    await page
      .getByRole("button", { name: "Experience settings", exact: true })
      .click();
    await page.locator("#motion").uncheck();
    await page.keyboard.press("Escape");
    await position(0, 1.65, 4);
    await page.waitForFunction(
      () =>
        window.__PALACE_DEBUG__.scene.getObjectByName("gravity-architecture")
          ?.rotation.z < -0.45,
    );
    await photograph("gravity-datum");
    await position(0, 1.65, -7);
    await page.waitForFunction(
      () =>
        window.__PALACE_DEBUG__.scene.getObjectByName("gravity-architecture")
          ?.rotation.z < -1.1,
    );
    await photograph("gravity-shift");
    await arrive("music");
    await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
    await page
      .locator(".record-row")
      .filter({ hasText: "Palace Study — No. 01" })
      .locator(".record-title")
      .click();
    await page
      .getByRole("dialog", { name: "Listening collection", exact: true })
      .getByRole("button", { name: "Pause music", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Repeat: off", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Repeat: all", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await frames(10);
    await photograph("music-playing");
    await position(2.8, 1.65, 0.6);
    // Use the actual mouse-look input to photograph the physical turntable.
    await page.mouse.move(1100, 420);
    await page.mouse.down();
    await page.mouse.move(790, 565, { steps: 6 });
    await page.mouse.up();
    await frames();
    await photograph("music-installation");
  }
  if (story || moments || process.env.PALACE_UI === "1") {
    await arrive("projects/reviewer-first-audit");
    await page
      .getByRole("dialog", { name: "Reviewer-First Audit", exact: true })
      .waitFor();
    await photograph("project-focus");
    await page.keyboard.press("Escape");
    await page.locator(".guide-button").click();
    await page
      .getByRole("dialog", { name: "Museum guide", exact: true })
      .waitFor();
    await photograph("museum-guide");
    await page.keyboard.press("Escape");
    await page.goto(`${base}/?view=index`);
    await page.locator(".index-view").waitFor();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await photograph("index-desktop");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(".index-item").first().click();
    await photograph("focus-1440");
    await page.keyboard.press("Escape");
    report.checks.push(
      "Native explicit playback, album installation, Guide, Focus, 1920px index and 1440px Focus inspected.",
    );
  }
  if (process.env.PALACE_MOVEMENT === "1") {
    await arrive("corridor");
    const start = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await page.keyboard.down("w");
    try {
      await page.waitForFunction(
        (z) => window.__PALACE_DEBUG__.camera.position.z < z - 0.2,
        start[2],
      );
    } finally {
      await page.keyboard.up("w");
    }
    const moved = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    await position(3.075, 1.65, moved[2]);
    await page.keyboard.down("d");
    try {
      await frames(8);
    } finally {
      await page.keyboard.up("d");
    }
    const boundary = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    assert.ok(boundary[0] <= 3.081 && boundary[0] > 3.07, "corridor wall must contain native keyboard movement");
    assert.equal(boundary[1], 1.65);
    await position(0, 1.65, -108);
    const chunks = await page.evaluate(() => window.__PALACE_DEBUG__.residentCorridorChunks);
    assert.equal(chunks, 5, "distant travel must retain only five corridor chunks");
    await arrive("anomaly-compressing");
    await position(7.5, 1.65, -12);
    const narrow = await page.evaluate(() => window.__PALACE_DEBUG__.camera.position.toArray());
    assert.ok(narrow[0] < 2.8, "compression collision must follow the visible taper");
    await page.keyboard.down("s");
    try {
      await page.waitForFunction(
        (z) => window.__PALACE_DEBUG__.camera.position.z > z + 0.2,
        narrow[2],
      );
    } finally {
      await page.keyboard.up("s");
    }
    report.movement = { start, moved, boundary, chunks, narrow };
    report.checks.push("Native WASD advances, corridor walls contain movement, five chunks remain resident, and the tapered room permits return.");
  }
  assert.deepEqual(report.errors, [], "browser errors");
  assert.deepEqual(
    report.externalRequests,
    [],
    "scene media must remain self-hosted",
  );
} finally {
  await writeFile(
    path.join(output, "capture-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
