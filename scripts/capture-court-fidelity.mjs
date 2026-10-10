import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/court-fidelity");
await mkdir(out, { recursive: true });
const report = { sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), quality: "medium", dpr: 1, scope: "Fixed camera staging; gameplay is verified separately through native input.", frames: [], errors: [] };
const poses = [
  ["entry", [2, 1.65, 9], [0, 2.4, -12.1]],
  ["matched-wide", [6.5, 1.65, 10], [0, 2.5, -10]],
  ["hoop", [2.5, 1.65, -9.3], [0, 3.4, -12.7]],
  ["surface", [3, 1.65, 0], [0, .05, -6]],
  ["sideline", [-7, 1.65, -1], [-15, 2, -8]],
  ["return", [-4, 1.65, 9], [0, 2.4, 17.2]],
];
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
try {
  for (const width of [1920, 2560].filter(w => !process.env.PALACE_CAPTURE_WIDTH || w === Number(process.env.PALACE_CAPTURE_WIDTH))) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 1440 }, deviceScaleFactor: 1 });
    await context.route("**/personal-media/manifest.json", r => r.fulfill({ json: { wallpapers: [], visuals: [], music: [], projects: [], research: [] } }));
    await context.addInitScript(() => localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })));
    const page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on("pageerror", e => report.errors.push(e.message)); page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
    await page.goto((process.env.PALACE_URL || "http://127.0.0.1:5190") + "/basketball/");
    await page.locator(".world-ready canvas").waitFor();
    const modes = process.env.PALACE_COURT_BEFORE === "1" ? ["baseline"] : ["day", "night"];
    for (const mode of modes) {
      if (mode !== "baseline") await page.getByRole("button", { name: mode === "day" ? "Daylight" : "Night lights", exact: true }).click();
      await page.waitForTimeout(3000);
      for (const [name, position, target] of poses.filter(p => !process.env.PALACE_CAPTURE_FRAMES || process.env.PALACE_CAPTURE_FRAMES.split(",").includes(p[0]))) {
        const view = await page.evaluate(({ position, target }) => {
          const c = window.__PALACE_DEBUG__.camera, s = window.__PALACE_DEV__.state.getState(); c.position.set(...position); c.lookAt(...target);
          const view = { roomId: s.roomId, position: c.position.toArray(), quaternion: c.quaternion.toArray() };
          s.update({ returnView: view, travelSequence: s.travelSequence + 1 }); return view;
        }, { position, target });
        await page.waitForTimeout(600);
        const file = `${width}-${mode}-${name}.png`; await page.screenshot({ path: path.join(out, file) });
        report.frames.push({ file, width, mode, name, view }); console.log(file);
      }
    }
    await context.close();
  }
  if (report.errors.length) throw new Error(report.errors.join("\n")); report.passed = true;
} catch (e) { report.failure = e.stack; console.error(e.stack); process.exitCode = 1; }
finally { await writeFile(path.join(out, "captures.json"), JSON.stringify(report, null, 2)); await browser.close(); }
