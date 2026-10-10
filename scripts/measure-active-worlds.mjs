import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/active-worlds/performance");
const base = process.env.PALACE_URL || "http://127.0.0.1:5190";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: false,
  args: ["--use-angle=d3d11", "--window-position=0,0", "--window-size=1920,1080"] });
const report = {
  measuredAt: new Date().toISOString(), head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  workingTreeModified: !!execFileSync("git", ["status", "--porcelain"]).toString().trim(),
  browser: browser.version(), headed: true, viewport: [1920, 1080], dpr: 1, quality: "medium",
  videoControllers: JSON.parse(execFileSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion | ConvertTo-Json -Compress"]).toString()),
  content: "Original new worlds, public catalog only. No private recordings, manifests or browser library.",
  scope: "Visible installed Edge / real D3D11 renderer. RAF wall timings include simulation and reflection frames. renderer.info is the final main-pass count; offscreen calls are not aggregated. Texture MB estimates material maps, not total VRAM. No GPU timer-query measurement.",
  samples: [], errors: [],
};
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
await context.addInitScript(() => {
  if (!localStorage.getItem("memory-palace:v3")) localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, reducedMotion: false, roomSoundtracks: false, mute: false }, version: 0 }));
});
const page = await context.newPage(); page.setDefaultTimeout(60000);
page.on("pageerror", error => report.errors.push(error.message));
page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
const ready = () => page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__?.camera && window.__PALACE_DEV__?.library.getState().ready);
const goto = async room => { await page.goto(base + "/" + room); await ready(); await page.waitForTimeout(1500); };
const pose = (position, target) => page.evaluate(({ position, target }) => {
  const c = window.__PALACE_DEBUG__.camera, s = window.__PALACE_DEV__.state.getState(); c.position.set(...position); c.lookAt(...target);
  s.update({ travelSequence: s.travelSequence + 1, returnView: { roomId: s.roomId, position: c.position.toArray(), quaternion: c.quaternion.toArray() } });
}, { position, target });

async function measure(label, seconds = 6, action) {
  await page.bringToFront();
  // 采样真实 RAF 间隔；按原场景资源计数，不以设定帧率或软件渲染宣称验收。
  const pending = page.evaluate(async seconds => {
    const start = performance.now(), frames = [];
    let previous = start, last;
    const peak = { calls: 0, triangles: 0, textures: 0, lights: 0, textureMB: 0 };
    await new Promise(resolve => {
      const tick = now => {
        frames.push(now - previous); previous = now;
        const d = window.__PALACE_DEBUG__, r = d.renderer, gl = r.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
        let lights = 0, bytes = 0;
        const maps = new Set();
        d.scene.traverse(object => {
          if (object.isLight) lights++;
          for (const material of (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean)) {
            for (const key of ["map", "normalMap", "bumpMap", "roughnessMap"]) {
              const texture = material[key];
              if (texture && !maps.has(texture.uuid)) { maps.add(texture.uuid); bytes += (texture.image?.width || 0) * (texture.image?.height || 0) * 4 * 4 / 3; }
            }
          }
        });
        last = { room: d.roomId, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          effectiveQuality: window.__PALACE_DEV__.state.getState().effectiveQuality, calls: r.info.render.calls, triangles: r.info.render.triangles,
          textures: r.info.memory.textures, lights, textureMB: bytes / 1024 / 1024, cache: d.textureStatus() };
        for (const key of Object.keys(peak)) peak[key] = Math.max(peak[key], last[key]);
        if (now - start >= seconds * 1000) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...frames].sort((a, b) => a - b), elapsedMs = frames.reduce((a, b) => a + b, 0);
    return { frames: frames.length, elapsedMs, fps: frames.length * 1000 / elapsedMs,
      medianMs: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.floor(sorted.length * .95)], p99Ms: sorted[Math.floor(sorted.length * .99)], maxMs: sorted.at(-1), peak, last };
  }, seconds);
  if (action) await action();
  const sample = { label, ...(await pending) }; report.samples.push(sample);
  assert.match(sample.last.renderer, /NVIDIA.*GTX 1650/i);
  console.log(label + ": " + sample.fps.toFixed(1) + " FPS / p95 " + sample.p95Ms.toFixed(1) + " ms / " + sample.peak.calls + " main-pass calls");
  await writeFile(path.join(out, "performance.json"), JSON.stringify(report, null, 2));
}

try {
  await goto("worlds"); await measure("worlds / preview thresholds");
  await goto("basketball"); await measure("court / resting composition");
  await pose([1.5, 1.65, 8.5], [1.5, .12, 6]);
  await page.getByRole("button", { name: "E · Pick up nearby ball", exact: true }).click();
  await page.getByRole("button", { name: "E · Dribble", exact: true }).click();
  await measure("court / real dribble and bounce audio");
  await page.getByRole("button", { name: "E · Hold ball", exact: true }).click();
  await pose([0, 1.65, -4.8], [0, 3.05, -12.1]);
  await measure("court / timed shot, net and feedback", 7, async () => {
    await page.getByRole("button", { name: "Hold / release · Shoot", exact: true }).hover();
    await page.mouse.down(); await page.waitForTimeout(895); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector(".practice-score strong")?.textContent?.replace(/\s/g, "") === "1/1");
  });
  if (process.env.PALACE_COURT_ONLY === "1") {
    // 第三轮沿用球场采样；公路骑行使用独立的新路线测量器，避免触发旧版骑行按钮。
    await goto("editorial");
    await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
    await page.locator(".editorial-strip > article").first().locator(".visual-work-image").focus();
    await measure("editorial / keyboard accordion");
    await page.locator(".editorial-strip > article").first().getByRole("button", { name: /ENTER WALLPAPER CINEMA/ }).click();
    await ready(); await page.waitForTimeout(1200);
    await measure("cinema / resting image");
    await measure("cinema / native image transitions", 8, async () => {
      for (let i = 0; i < 5; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(950); }
    });
  } else {
  await goto("cycling"); await measure("cycling / forest resting");
  await page.getByRole("button", { name: "Start / resume ride", exact: true }).click();
  await page.keyboard.down("w"); await measure("cycling / forest accelerating and wind", 8); await page.keyboard.up("w");
  await page.getByRole("button", { name: "Brake · Space", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector(".ride-speed strong")?.textContent) === 0);
  await page.evaluate(() => window.__PALACE_DEV__.state.getState().enterRoom("worlds")); await ready();
  await page.evaluate(() => localStorage.setItem("memory-palace:ride:v1", JSON.stringify({ distance: 163.3 })));
  await goto("cycling");
  await page.evaluate(() => {
    const c = window.__PALACE_DEBUG__.camera, s = window.__PALACE_DEV__.state.getState(); c.lookAt(53, .23, -13);
    s.update({ travelSequence: s.travelSequence + 1, returnView: { roomId: "cycling", position: c.position.toArray(), quaternion: c.quaternion.toArray() } });
  });
  await page.waitForTimeout(1500); await measure("cycling / lake-visible single 384px reflection", 8);
  await page.screenshot({ path: path.join(out, "lake-measurement.png") });
  await page.evaluate(() => window.__PALACE_DEV__.state.getState().update({ reducedMotion: true }));
  await page.getByRole("button", { name: "Start / resume ride", exact: true }).click();
  await measure("cycling / low-motion lake ride", 8);
  await page.getByRole("button", { name: "Brake · Space", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector(".ride-speed strong")?.textContent) === 0);
  await measure("worlds / mixed scene switching and resource peak", 16, async () => {
    for (const room of ["worlds", "basketball", "cycling", "music", "atrium", "worlds"]) {
      await page.evaluate(room => window.__PALACE_DEV__.state.getState().enterRoom(room), room); await ready(); await page.waitForTimeout(800);
    }
  });
  await page.waitForTimeout(1500); await measure("worlds / settled after repeated exits");
  }
  assert.deepEqual(report.errors, []);
  report.meetsMean45 = report.samples.every(sample => sample.fps >= 45);
  report.meetsP95Frame22ms = report.samples.every(sample => sample.p95Ms <= 1000 / 45);
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { await writeFile(path.join(out, "performance.json"), JSON.stringify(report, null, 2)); await browser.close(); }
