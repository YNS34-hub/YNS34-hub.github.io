import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.PALACE_URL || "http://127.0.0.1:5191", out = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/worlds-production");
await mkdir(out, { recursive: true });
const report = { sha: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(), base, checkedAt: new Date().toISOString(), scope: "Actual public production build, native UI and keys only. No application debug exports, injected player state or altered physics.", checks: [], errors: [], uploads: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--use-angle=d3d11"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addInitScript(() => { if (!localStorage.getItem("memory-palace:v3")) localStorage.setItem("memory-palace:v3", JSON.stringify({ state: { quality: "medium", tutorialDone: true, roomSoundtracks: false }, version: 0 })); });
const page = await context.newPage(); page.setDefaultTimeout(60000);
page.on("pageerror", error => report.errors.push(error.message));
page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
page.on("request", request => { if (request.method() === "POST") report.uploads.push(request.url()); });
page.on("response", response => { if (response.status() >= 400) report.errors.push(response.status() + " " + response.url()); });
const ready = () => page.locator(".world-ready canvas").waitFor();
const shot = name => page.screenshot({ path: path.join(out, name + ".png") });
const travel = async prefix => {
  await page.locator(".guide-button").click(); await page.getByRole("button", { name: new RegExp("^" + prefix + "\\s+") }).click();
  // 不把上个房间遗留的一帧 world-ready 当作新目的地就绪；真实控制只在资源准备结束后出现。
  if (prefix === "W1") await page.locator(".court-hud").waitFor();
  if (prefix === "W2") await page.locator(".road-status").waitFor();
  if (prefix === "W0") await page.locator(".room-caption").filter({ hasText: "WORLDS BEYOND" }).waitFor();
  await ready();
};
try {
  const catalog = await (await context.request.get(base + "/personal-media/manifest.json")).json();
  for (const key of ["wallpapers", "visuals", "music", "projects", "research"]) assert.deepEqual(catalog[key], []);
  for (const route of ["worlds", "basketball", "cycling"]) {
    const response = await context.request.get(base + "/" + route + "/"); assert.equal(response.status(), 200);
    assert.match(await response.text(), /id="static-collection"/);
  }
  report.checks.push("Clean public personal-media catalog and independently generated activity deep links");
  await page.goto(base + "/worlds/"); await ready(); await shot("worlds-public");
  assert.equal(await page.evaluate(() => !!window.__PALACE_DEV__ || !!window.__PALACE_DEBUG__), false);
  await travel("W1"); await page.getByRole("button", { name: "R · Recall ball", exact: true }).click();
  await page.getByRole("button", { name: "E · Pick up nearby ball", exact: true }).click();
  await page.getByRole("button", { name: "E · Dribble", exact: true }).click(); await page.waitForTimeout(850); await shot("dribble-public");
  await page.getByRole("button", { name: "E · Hold ball", exact: true }).click();
  await page.getByRole("button", { name: "Hold / release · Shoot", exact: true }).hover();
  await page.mouse.down(); await page.waitForTimeout(895); await page.mouse.up();
  await page.waitForFunction(() => /[01]\s*\/\s*1/.test(document.querySelector(".practice-score strong")?.textContent || ""));
  await page.getByRole("status").filter({ hasText: /MADE|MISSED/ }).waitFor(); await shot("shot-public");
  await page.getByRole("button", { name: "Arc assist on", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Arc assist off", exact: true }).getAttribute("aria-pressed"), "false");
  report.checks.push("Original Guide reaches court; native recall, pickup, dribble, timed shot and assist feedback");
  // 公开打包后的直接入口与资源缓存后的重入都必须可用，捕获旧环境清理覆盖新环境的生命周期回归。
  await travel("W0"); await travel("W1");
  await page.getByRole("button", { name: "Night lights", exact: true }).click(); await page.waitForTimeout(2600);
  await shot("court-night-public"); await page.reload(); await ready();
  assert.equal(await page.getByRole("button", { name: "Night lights", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Daylight", exact: true }).click(); await page.waitForTimeout(2600);
  report.checks.push("Cached court re-entry, day/night switching and lighting restoration after production refresh");
  await travel("W2");
  const progress = page.locator(".road-status");
  assert.equal(await progress.getAttribute("data-mounted"),"false");
  await page.keyboard.down("w");await page.waitForFunction(()=>!document.querySelector(".road-mount")?.disabled,{},{timeout:10000});await page.keyboard.up("w");
  await page.keyboard.press("e");await page.waitForFunction(()=>document.querySelector(".road-status")?.dataset.state!=="mounting"&&document.querySelector(".road-status")?.dataset.mounted==="true");
  const before=Number(await progress.getAttribute("data-distance"));
  await page.keyboard.down("w");await page.waitForFunction(()=>Number(document.querySelector(".road-status")?.dataset.speed)>6,{},{timeout:30000});await page.keyboard.up("w");
  assert.ok(Number(await progress.getAttribute("data-distance"))>before);
  await page.keyboard.down("s");await page.waitForFunction(()=>Number(document.querySelector(".road-status")?.dataset.speed)===0,{},{timeout:12000});await page.keyboard.up("s");
  await shot("cycling-public");
  await page.keyboard.press("p"); await page.getByRole("button", { name: "Save this view", exact: true }).waitFor();
  const stopped=await progress.getAttribute("data-distance");await page.keyboard.press("w");assert.equal(await progress.getAttribute("data-distance"),stopped);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Save this view", exact: true }).click();
  await (await download).saveAs(path.join(out, "native-scene-export.png"));
  await page.keyboard.press("Escape"); await progress.waitFor();
  const saved = await progress.getAttribute("data-distance");
  await page.reload(); await ready();
  assert.equal(await progress.getAttribute("data-distance"), saved);
  assert.equal(Number(await progress.getAttribute("data-speed")),0);assert.equal(await progress.getAttribute("data-mounted"),"false");
  await page.getByRole("button", { name: "Return to the Palace", exact: true }).click(); await ready();
  await page.locator(".room-caption").filter({ hasText: "WORLDS BEYOND" }).waitFor();
  report.checks.push("Guide cycling arrival honors genuine pedal input; brake, photo, local PNG, one-level Escape, refresh and return work without debug globals");
  await page.goto(base + "/museum/"); await ready();
  await page.getByRole("button", { name: "ENTER THE PALACE", exact: true }).click(); await page.locator(".room-caption").filter({ hasText: "THE ATRIUM" }).waitFor();
  await page.getByRole("button", { name: "LOOK FREELY", exact: true }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.pointerLockElement);
  assert.equal(await page.getByRole("dialog").count(), 0);
  report.checks.push("Legacy /museum entry and actual Pointer Lock / single Escape remain available");
  assert.deepEqual(report.errors, []); assert.deepEqual(report.uploads, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); await shot("failure").catch(() => {}); }
finally { await writeFile(path.join(out, "validation.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log("Public activity flows: " + report.checks.length + " checks; " + (report.passed ? "PASS" : "FAIL"));
