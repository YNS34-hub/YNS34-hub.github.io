import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// 保留原同机位脚本，固定两个版本的公开作品目录；静止截图中的计时不是性能验收。
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
await import("./capture-quality-leap.mjs");
const file = path.resolve(process.env.PALACE_ARTIFACTS || "qa-artifacts/quality-leap", (process.env.PALACE_PHASE || "before") + ".json");
const report = JSON.parse(await readFile(file, "utf8"));
report.runnerHead = report.sha;
report.sha = process.env.PALACE_SOURCE_SHA || report.sha;
report.scope = "Static visual regression only; headless timing values are diagnostics, not GTX 1650 performance evidence.";
report.content = "Identical public catalog. No private media or local collection is rendered.";
await writeFile(file, JSON.stringify(report, null, 2));
