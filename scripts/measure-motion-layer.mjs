import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

// 复用原实机测量器，仅给 BEFORE / AFTER 提供相同公开目录；不改实际页面、分析器或帧率。
const originalLaunch = chromium.launch.bind(chromium);
chromium.launch = async options => {
  const browser = await originalLaunch(options);
  const originalContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await originalContext(options);
    await context.route("**/personal-media/manifest.json", route => route.fulfill({ json: {
      wallpapers: [], visuals: [], music: [], projects: [], research: [],
    } }));
    return context;
  };
  return browser;
};
process.env.PALACE_PERF_LYRICS = "1";
await import("./measure-quality-leap.mjs");
const file = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/quality-leap", process.env.PALACE_PERFORMANCE_REPORT || "performance.json");
const report = JSON.parse(await readFile(file, "utf8"));
report.runnerHead = report.gitHead;
report.gitHead = process.env.PALACE_SOURCE_SHA || report.gitHead;
report.content = "Identical public catalog; original browser-local Palace Study audio and LRC fixture. Private content excluded.";
report.videoControllers = JSON.parse(execFileSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion | ConvertTo-Json -Compress"]).toString());
await writeFile(file, JSON.stringify(report, null, 2));
assert.equal(report.headed, true);
assert.ok(report.samples.length > 0);
for (const sample of report.samples) assert.match(sample.last.renderer, /NVIDIA.*GTX 1650/i, "Each performance sample must use the real GTX 1650, not a software renderer.");
assert.deepEqual(report.errors, []);
assert.ok(!report.failure, report.failure);
