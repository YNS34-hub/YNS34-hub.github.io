import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/world-previews");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
const report = { source: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), modified: true, scope: "Actual original new-world renderings; public catalog only; museum controls hidden for spatial portal preview.", images: [], errors: [] };
try {
  for (const room of ["basketball", "cycling"]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
    await context.addInitScript(() => {
      localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 }));
      localStorage.setItem("memory-palace:ride:v1", JSON.stringify({ distance: 285 }));
    });
    const page = await context.newPage();
    page.on("pageerror", e => report.errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
    await page.goto((process.env.PALACE_URL || "http://127.0.0.1:5190") + "/" + room);
    await page.waitForFunction(() => document.querySelector(".world-ready") && window.__PALACE_DEBUG__);
    const pose = await page.evaluate(room => {
      const c = window.__PALACE_DEBUG__.camera, s = window.__PALACE_DEV__.state.getState();
      if (room === "basketball") { c.position.set(6.5, 1.65, 10); c.lookAt(0, 2.5, -10); }
      else c.lookAt(53, .23, -13);
      const view = { roomId: room, position: c.position.toArray(), quaternion: c.quaternion.toArray() };
      s.update({ returnView: view, travelSequence: s.travelSequence + 1 });
      return view;
    }, room);
    await page.addStyleTag({ content: ".hud,.activity-hud,.interaction-hint,.interaction-response{visibility:hidden!important}" });
    await page.waitForTimeout(2200);
    const file = (room === "basketball" ? "after-hours" : "golden-forest") + ".png";
    await page.screenshot({ path: path.join(out, file) }); report.images.push({ file, ...pose });
    console.log("Captured " + file); await context.close();
  }
  if (report.errors.length) throw new Error(report.errors.join("\n"));
} finally { await writeFile(path.join(out, "capture.json"), JSON.stringify(report, null, 2)); await browser.close(); }
