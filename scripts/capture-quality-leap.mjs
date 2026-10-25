import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
const out = path.resolve(
  process.env.PALACE_ARTIFACTS || "qa-artifacts/quality-leap",
);
const phase = process.env.PALACE_PHASE || "before";
const browser = await chromium.launch({
  executablePath:
    process.env.PALACE_BROWSER ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: process.env.PALACE_HEADED !== "1",
  args: ["--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  phase,
  sha: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  browser: browser.version(),
  quality: "medium",
  dpr: 1,
  errors: [],
  views: [],
};
const views = [
  ["atrium", "entry", [0, 1.65, 23], [0, 3.2, -3]],
  ["atrium", "mid", [8, 1.65, 10], [0, 3.3, 0]],
  ["atrium", "glass", [4.9, 2.0, 4.2], [0, 3.2, 0]],
  ...(process.env.PALACE_EXTRA === "1"
    ? [
        ["atrium", "glass-side", [-6.3, 2.0, -1.6], [0, 3.2, 0]],
        ["atrium", "glass-rear", [2.8, 2.0, -6.5], [0, 3.2, 0]],
        ["cosmic", "entry", [0, 1.65, 13.8], [0, 4.2, -25]],
        ["unfinished", "runtime-entry", [0, 1.65, 10.8], [0, 3.15, -8]],
      ]
    : []),
  ["music", "still", [1.5, 1.65, 10.8], [0, 2.75, -5]],
  ["music", "detail", [4.8, 1.65, -0.5], [0, 3.5, -5]],
  ["corridor", "entry", [0, 1.65, 14], [0, 2.5, -30]],
  ["corridor", "transition", [0, 1.65, -22], [0, 2.6, -53]],
  ["corridor", "anomaly", [0, 1.65, -64], [0, 3, -87]],
  ...[
    "projects",
    "research",
    "wallpapers",
    "imagined-worlds",
    "glass-life",
    "portraits",
    "editorial",
    "liquid-web",
    "archive",
    "unfinished",
    "my-collection",
  ].map((room) => [room, "entry", [0, 1.65, 13.8], [0, 3.15, -8]]),
];
const activeViews = process.env.PALACE_ROOMS
  ? views.filter((v) => process.env.PALACE_ROOMS.split(",").includes(v[0]))
  : views;
await mkdir(path.join(out, phase), { recursive: true });
try {
  for (const [width, height] of process.env.PALACE_SIZE === "1920"
    ? [[1920, 1080]]
    : [
        [1920, 1080],
        [2560, 1440],
      ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "memory-palace:v3",
        JSON.stringify({
          state: {
            quality: "medium",
            effectiveQuality: "medium",
            tutorialDone: true,
            mute: true,
            reducedMotion: true,
            roomSoundtracks: false,
          },
          version: 0,
        }),
      ),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on("pageerror", (e) => report.errors.push(e.message));
    for (const [room, name, position, target] of activeViews) {
      await page.goto(`${base}/${room === "atrium" ? "" : room}`);
      await page.waitForFunction(() => !!window.__PALACE_DEBUG__?.camera);
      await page.waitForFunction(() => document.querySelector(".world-ready"));
      await page.waitForTimeout(200);
      await page.evaluate(
        async ({ position, target }) => {
          const { state: usePalaceStore } = window.__PALACE_DEV__;
          usePalaceStore
            .getState()
            .update({ started: true, overlay: "guide", mode: "explore" });
          window.__PALACE_DEBUG__.camera.position.set(...position);
          window.__PALACE_DEBUG__.camera.lookAt(...target);
        },
        { position, target },
      );
      await page.addStyleTag({
        content:
          ".dialog-backdrop,.entry-scrim,.entry-copy,.tutorial-card,.landing,.core-caption,.welcome-caption{display:none!important}",
      });
      await page.waitForTimeout(3500);
      const metrics = await page.evaluate(async () => {
        const d = window.__PALACE_DEBUG__,
          r = d.renderer,
          c = r.getContext();
        const ext = c.getExtension("WEBGL_debug_renderer_info");
        let lights = 0;
        d.scene.traverse((o) => {
          if (o.isLight) lights++;
        });
        const times = [];
        let prev = performance.now();
        for (let i = 0; i < 90; i++)
          await new Promise((resolve) =>
            requestAnimationFrame((t) => {
              times.push(t - prev);
              prev = t;
              resolve();
            }),
          );
        times.sort((a, b) => a - b);
        return {
          renderer: ext
            ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            : c.getParameter(c.RENDERER),
          calls: r.info.render.calls,
          triangles: r.info.render.triangles,
          textures: r.info.memory.textures,
          geometries: r.info.memory.geometries,
          lights,
          medianMs: times[45],
          p95Ms: times[85],
          fps: 1000 / (times.reduce((a, b) => a + b, 0) / times.length),
        };
      });
      const file = `${room}-${name}-${width}.png`;
      await page.screenshot({ path: path.join(out, phase, file) });
      report.views.push({
        room,
        name,
        width,
        height,
        position,
        target,
        file,
        metrics,
      });
      await writeFile(
        path.join(out, `${phase}.json`),
        JSON.stringify(report, null, 2),
      );
      console.log(
        `${phase} ${file} ${metrics.renderer} ${metrics.calls} calls ${metrics.fps.toFixed(1)} fps`,
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(out, `${phase}.json`),
    JSON.stringify(report, null, 2),
  );
}
