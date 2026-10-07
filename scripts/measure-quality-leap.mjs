import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const out = path.resolve(
    process.env.PALACE_ARTIFACTS || "qa-artifacts/quality-leap",
  ),
  base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const reportName = process.env.PALACE_PERFORMANCE_REPORT || "performance.json";
await mkdir(out, { recursive: true });
// A visible hardware browser is deliberate. Headless/SwiftShader numbers are not acceptance evidence.
const browser = await chromium.launch({
  executablePath:
    process.env.PALACE_BROWSER ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: false,
  args: [
    "--use-angle=d3d11",
    "--window-position=0,0",
    "--window-size=1920,1080",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await context.addInitScript(() =>
  localStorage.setItem(
    "memory-palace:v3",
    JSON.stringify({
      state: {
        quality: "medium",
        tutorialDone: true,
        reducedMotion: false,
        roomSoundtracks: false,
        mute: true,
      },
      version: 0,
    }),
  ),
);
const page = await context.newPage();
page.setDefaultTimeout(60000);
const report = {
  checkedAt: new Date().toISOString(),
  gitHead: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  workingTreeModified: !!execFileSync("git", ["status", "--porcelain"]).toString().trim(),
  browser: browser.version(),
  headed: true,
  resolution: [1920, 1080],
  dpr: 1,
  quality: "medium",
  scope:
    "Visible installed Edge on the local GTX 1650; requestAnimationFrame wall timings, renderer.info and estimated uncompressed scene texture bytes. Not GPU timer-query timings.",
  samples: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
const ready = () =>
  page.waitForFunction(
    () =>
      document.querySelector(".world-ready") && window.__PALACE_DEBUG__?.camera,
  );
async function measure(label, seconds = 5, move = false) {
  await page.bringToFront();
  const pending = page.evaluate(
    async ({ seconds }) => {
      const start = performance.now(),
        frames = [];
      let previous = start,
        peak = { calls: 0, triangles: 0, textures: 0, lights: 0, textureMB: 0 },
        last;
      await new Promise((resolve) => {
        const tick = (now) => {
          frames.push(now - previous);
          previous = now;
          const d = window.__PALACE_DEBUG__;
          if (d) {
            const r = d.renderer,
              gl = r.getContext(),
              ext = gl.getExtension("WEBGL_debug_renderer_info");
            let lights = 0,
              bytes = 0;
            const maps = new Set();
            d.scene.traverse((o) => {
              if (o.isLight) lights++;
              const materials = Array.isArray(o.material)
                ? o.material
                : [o.material];
              for (const m of materials.filter(Boolean))
                for (const key of [
                  "map",
                  "normalMap",
                  "bumpMap",
                  "roughnessMap",
                ]) {
                  const t = m[key];
                  if (t && !maps.has(t.uuid)) {
                    maps.add(t.uuid);
                    bytes +=
                      ((t.image?.width || 0) * (t.image?.height || 0) * 4 * 4) /
                      3;
                  }
                }
            });
            last = {
              room: d.roomId,
              renderer: ext
                ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                : gl.getParameter(gl.RENDERER),
              calls: r.info.render.calls,
              triangles: r.info.render.triangles,
              textures: r.info.memory.textures,
              lights,
              textureMB: bytes / 1024 / 1024,
              cache: d.textureStatus(),
            };
            for (const field of Object.keys(peak))
              peak[field] = Math.max(peak[field], last[field]);
          }
          if (now - start >= seconds * 1000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const sorted = [...frames].sort((a, b) => a - b),
        sum = frames.reduce((a, b) => a + b, 0);
      return {
        frames: frames.length,
        elapsedMs: sum,
        fps: (frames.length * 1000) / sum,
        medianMs: sorted[Math.floor(sorted.length * 0.5)],
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        maxMs: sorted.at(-1),
        peak,
        last,
      };
    },
    { seconds },
  );
  if (move) {
    await page.keyboard.down("w");
    await page.waitForTimeout(seconds * 1000);
    await page.keyboard.up("w");
  }
  const sample = { label, movement: move, ...(await pending) };
  report.samples.push(sample);
  console.log(
    label +
      " " +
      sample.fps.toFixed(1) +
      " FPS p95 " +
      sample.p95Ms.toFixed(1) +
      "ms / " +
      sample.peak.calls +
      " calls",
  );
  await writeFile(path.join(out, reportName), JSON.stringify(report, null, 2));
}
try {
  const rooms = [
    "atrium",
    "music",
    "corridor",
    "projects",
    "research",
    "wallpapers",
    "imagined-worlds",
    "cosmic",
    "glass-life",
    "portraits",
    "editorial",
    "liquid-web",
    "archive",
    "unfinished",
    "my-collection",
  ];
  for (const room of rooms.filter(
    (r) =>
      !process.env.PALACE_ROOMS ||
      process.env.PALACE_ROOMS.split(",").includes(r),
  )) {
    await page.goto(base + "/" + (room === "atrium" ? "" : room));
    await ready();
    await page.evaluate(() =>
      window.__PALACE_DEV__.state
        .getState()
        .update({ started: true, overlay: null }),
    );
    await page.waitForTimeout(1500);
    await measure(room + " / still");
    if (["atrium", "music", "corridor"].includes(room))
      await measure(room + " / walking", 7, true);
    if (room === "music" && process.env.PALACE_PERF_LYRICS === "1") {
      await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
      await page.getByLabel("Import local audio files").setInputFiles({
        name: "Palace Study — performance.wav", mimeType: "audio/wav",
        buffer: await readFile("public/media/generated/palace-study.wav"),
      });
      await page.locator(".record-row").filter({ hasText: "Palace Study — performance" }).locator(".record-title").click();
      await page.getByRole("dialog").getByRole("button", { name: "Pause music", exact: true }).waitFor();
      await page.getByLabel("Import lyrics for current track").setInputFiles({
        name: "palace-study.lrc", mimeType: "text/plain",
        buffer: Buffer.from(Array.from({ length: 7 }, (_, i) => `[00:${String(i * 4).padStart(2, "0")}.00]Original Palace Study line ${i + 1}`).join("\n")),
      });
      await page.getByText("Synchronized wall lyrics", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        const s = window.__PALACE_DEV__.state.getState(), c = window.__PALACE_DEBUG__.camera;
        c.position.set(6, 1.65, -1.5); c.lookAt(6.8, 4.4, -10.3);
        s.update({ travelSequence: s.travelSequence + 1, returnView: { roomId: "music", position: c.position.toArray(), quaternion: c.quaternion.toArray() } });
        window.__PALACE_DEV__.audio.getState().seek(2);
      });
      await page.waitForFunction(() => window.__PALACE_DEBUG__.audioSignal.available && document.querySelector(".lyric-wall")?.dataset.playing === "true");
      await measure("music / native playback, FFT and scrolling lyric wall", 8);
      await page.screenshot({ path: path.join(out, "performance-lyrics.png") });
      await page.locator(".now-playing-tag").getByRole("button", { name: "Pause music", exact: true }).click();
    }
  }
  if (!process.env.PALACE_ROOMS) {
    await page.goto(base + "/corridor");
    await ready();
    await page.evaluate(() =>
      window.__PALACE_DEV__.state.getState().update({ started: true }),
    );
    const switches = measure(
      "room switches / mixed gallery and five corridor chunks",
      12,
    );
    for (const room of [
      "projects",
      "music",
      "wallpapers",
      "portraits",
      "glass-life",
      "imagined-worlds",
      "atrium",
      "corridor",
    ]) {
      await page.evaluate(
        (room) => window.__PALACE_DEV__.state.getState().enterRoom(room),
        room,
      );
      await ready();
      await page.waitForTimeout(550);
    }
    await switches;
    await measure("corridor streaming / bounded cache", 12, true);
  }
  report.meetsMean45 = report.samples.every((x) => x.fps >= 45);
  report.meetsP95Frame22ms = report.samples.every((x) => x.p95Ms <= 1000 / 45);
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error.stack);
} finally {
  await writeFile(path.join(out, reportName), JSON.stringify(report, null, 2));
  await browser.close();
}
