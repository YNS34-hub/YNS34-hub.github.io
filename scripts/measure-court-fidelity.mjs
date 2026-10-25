import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/court-performance"), base = process.env.PALACE_URL || "http://127.0.0.1:5190";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: false, args: ["--use-angle=d3d11", "--window-position=0,0", "--window-size=1920,1080"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.route("**/personal-media/manifest.json", r => r.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
const page = await context.newPage(); page.setDefaultTimeout(90000);
const report = { sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), when: new Date().toISOString(), browser: browser.version(), headed: true, viewport: [1920, 1080], dpr: 1, quality: "medium", build: "Vite development; actual NVIDIA renderer must be verified. Native play is measured; pose staging is declared.", scope: "RAF wall intervals, not GPU timer queries. Renderer.info draw/triangle counts cover the main pass, not all shadow/transmission passes. Texture storage is a material/sampler estimate, not total VRAM. Short desktop samples only.", samples: [], errors: [] };
page.on("pageerror", e => report.errors.push(e.message)); page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
async function measure(label, seconds = 8) {
  await page.bringToFront();
  const data = await page.evaluate(async seconds => {
    const d = window.__PALACE_DEBUG__, r = d.renderer, gl = r.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"), renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const frames = [], peak = { calls: 0, triangles: 0, textures: 0 }, start = performance.now(); let previous = start;
    await new Promise(resolve => { const tick = now => { frames.push(now - previous); previous = now; peak.calls = Math.max(peak.calls, r.info.render.calls); peak.triangles = Math.max(peak.triangles, r.info.render.triangles); peak.textures = Math.max(peak.textures, r.info.memory.textures); if (now - start >= seconds * 1000) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    let lights = 0, activeLights = 0, shadows = 0, bytes = 0; const maps = new Set();
    d.scene.traverse(o => {
      if (o.isLight) { lights++; if (o.intensity > .01) activeLights++; if (o.castShadow && o.intensity > .01) shadows++; }
      for (const m of (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean)) for (const t of [...["map", "normalMap", "bumpMap", "roughnessMap", "metalnessMap", "alphaMap"].map(k => m[k]), ...(m.userData?.courtTextures || [])]) {
        const key = t && [t.source.uuid, t.colorSpace, t.wrapS, t.wrapT, t.anisotropy].join(":");
        if (t && !maps.has(key)) { maps.add(key); bytes += (t.image?.width || 0) * (t.image?.height || 0) * 4 * 4 / 3; }
      }
    });
    const sorted = [...frames].sort((a, b) => a - b), elapsed = frames.reduce((a, b) => a + b, 0), sky = d.scene.background;
    return { fps: frames.length * 1000 / elapsed, frames: frames.length, medianMs: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: sorted.at(-1), peak, renderer, room: d.roomId, effectiveQuality: window.__PALACE_DEV__.state.getState().effectiveQuality, lights, activeLights, shadows, materialMiB: bytes / 1024 / 1024, backgroundMiB: sky?.isTexture ? (sky.image?.width || 0) * (sky.image?.height || 0) * 4 * 4 / 3 / 1024 / 1024 : 0 };
  }, seconds);
  assert.match(data.renderer, /NVIDIA.*GTX 1650/i); report.samples.push({ label, ...data }); await writeFile(path.join(out, "performance.json"), JSON.stringify(report, null, 2));
  console.log(label + ": " + data.fps.toFixed(1) + " FPS / p95 " + data.p95Ms.toFixed(1) + " / max " + data.maxMs.toFixed(1));
}
async function pose(position, target) { await page.evaluate(({ position, target }) => { const d = window.__PALACE_DEBUG__, s = window.__PALACE_DEV__.state.getState(); d.camera.position.set(...position); d.camera.lookAt(...target); s.update({ returnView: { roomId: s.roomId, position: d.camera.position.toArray(), quaternion: d.camera.quaternion.toArray() }, travelSequence: s.travelSequence + 1 }); }, { position, target }); }
try {
  const began = Date.now(); await page.goto(base + "/basketball/"); await page.locator(".world-ready canvas").waitFor(); report.readyMs = Date.now() - began;
  for (const mode of ["day", "night"]) {
    await page.getByRole("button", { name: mode === "day" ? "Daylight" : "Night lights", exact: true }).click(); await page.waitForTimeout(2400);
    for (const [name, position, target] of [["entry", [2, 1.65, 9], [0, 2.4, -12.1]], ["sideline", [-7, 1.65, -1], [-15, 2, -8]], ["hoop", [2.5, 1.65, -9.3], [0, 3.4, -12.7]]]) {
      await pose(position, target); await page.waitForTimeout(400); await measure(mode + " / " + name);
    }
    await pose([0, 1.65, -4.8], [0, 3.05, -12.1]);
    await page.getByRole("button", { name: "R · Recall ball", exact: true }).click(); await page.getByRole("button", { name: "E · Pick up nearby ball", exact: true }).click(); await page.waitForTimeout(250);
    await page.getByRole("button", { name: "E · Dribble", exact: true }).click(); await page.keyboard.down("a"); await measure(mode + " / native dribble and walk", 6); await page.keyboard.up("a"); await page.getByRole("button", { name: "E · Hold ball", exact: true }).click();
    await pose([0, 1.65, -4.8], [0, 3.05, -12.1]); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Hold / release · Shoot", exact: true }).hover(); await page.mouse.down(); await page.waitForTimeout(895); await page.mouse.up(); await measure(mode + " / native shot", 6);
    await page.screenshot({ path: path.join(out, mode + ".png") });
  }
  await page.getByRole("button", { name: "Daylight", exact: true }).click(); await measure("night to day / transition");
  await page.goto(base + "/worlds/"); await page.locator(".world-ready canvas").waitFor(); await page.waitForTimeout(1000); await measure("worlds / after court");
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (e) { report.failure = e.stack; process.exitCode = 1; console.error(e.stack); }
finally { await writeFile(path.join(out, "performance.json"), JSON.stringify(report, null, 2)); await browser.close(); }
