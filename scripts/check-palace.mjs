import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PALACE_URL || "http://127.0.0.1:5173";
const output = process.env.PALACE_ARTIFACTS || path.resolve("qa-artifacts");
const rooms = JSON.parse(
  await readFile(path.join(root, "content/rooms.json"), "utf8"),
);
const projects = JSON.parse(
  await readFile(path.join(root, "content/projects.json"), "utf8"),
);
const report = {
  base,
  checkedAt: new Date().toISOString(),
  checks: [],
  skippedChecks: [],
  errors: [],
  externalRequests: [],
  screenshots: [],
  frameTimings: null,
};
await mkdir(output, { recursive: true });

// Verify actual generated pages rather than accepting the preview server's SPA
// fallback as evidence that GitHub Pages has a working deep link.
if (process.env.PALACE_VERIFY_DIST === "1") {
  const dist = path.join(root, "dist");
  const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
  const routes = [
    ...sitemap.matchAll(/<loc>https:\/\/yns34-hub\.github\.io([^<]*)<\/loc>/g),
  ].map((match) => match[1]);
  assert.ok(
    routes.length >= 20,
    "build must generate independent room and exhibit pages",
  );
  const assets = new Set();
  const hiddenRoutes = rooms
    .filter((room) => room.hidden)
    .map((room) => `/${room.id}/`);
  for (const route of [...routes, ...hiddenRoutes]) {
    const html = await readFile(path.join(dist, route, "index.html"), "utf8");
    assert.match(html, /id="static-collection"/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<link rel="canonical"/);
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, `${route} should serve its static HTML`);
    assert.equal(
      await response.text(),
      html,
      `${route} must serve the generated file, not an unrelated fallback`,
    );
    for (const match of html.matchAll(
      /(?:src|href)="(\/(?:assets|media)\/[^"?#]+)(?:[?#][^"]*)?"/g,
    ))
      assets.add(match[1]);
  }
  const fallback = await readFile(path.join(dist, "404.html"), "utf8");
  assert.equal(
    fallback,
    await readFile(path.join(dist, "index.html"), "utf8"),
    "unknown static routes retain a working application shell",
  );
  await readFile(path.join(dist, ".nojekyll"));
  for (const route of [
    "/legacy/",
    "/Benjamin/",
    "/douyin/",
    "/douyin-mindazhiguang/",
  ]) {
    const html = await readFile(path.join(dist, route, "index.html"), "utf8");
    assert.doesNotMatch(
      html,
      /id="static-collection"/,
      `${route} must preserve its original document`,
    );
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route);
    assert.equal(
      await response.text(),
      html,
      `${route} preserved document served`,
    );
  }
  for (const file of await readdir(path.join(dist, "assets"), { recursive: true, withFileTypes: true })) {
    if (file.isFile()) assets.add("/" + path.relative(dist, path.join(file.parentPath, file.name)).split(path.sep).join("/"));
  }
  for (const collection of [
    "projects",
    "research",
    "experiments",
    "archive",
    "music",
    "wallpapers",
  ]) {
    const items = JSON.parse(
      await readFile(path.join(root, "content", `${collection}.json`), "utf8"),
    );
    for (const item of items)
      for (const field of ["cover", "src", "video"]) {
        if (typeof item[field] === "string" && item[field].startsWith("/"))
          assets.add(item[field]);
      }
  }
  for (const asset of assets) {
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200, `built asset ${asset}`);
    assert.doesNotMatch(
      response.headers.get("content-type") || "",
      /text\/html/,
      `asset ${asset} must not silently fall back to HTML`,
    );
  }
  report.staticArtifacts = {
    generatedRoutes: routes.length + hiddenRoutes.length,
    indexedRoutes: routes.length,
    hiddenRoutes: hiddenRoutes.length,
    checkedAssets: assets.size,
    legacyRoutes: 4,
    fallback: "404.html equals application shell",
  };
  report.checks.push(
    "production files have static deep links, SEO text, local assets, fallback and preserved legacy pages",
  );
  console.log(
    `PASS production files: ${routes.length + hiddenRoutes.length} static routes (${hiddenRoutes.length} hidden), ${assets.size} assets, 4 legacy routes and 404 fallback`,
  );
}
if (process.env.PALACE_STATIC_ONLY === "1") {
  await writeFile(
    path.join(output, "palace-static-report.json"),
    JSON.stringify(report, null, 2),
  );
  process.exit(0);
}
const browser = await chromium.launch({
  executablePath:
    process.env.PALACE_BROWSER ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  if (!localStorage.getItem("memory-palace:v3"))
    localStorage.setItem(
      "memory-palace:v3",
      JSON.stringify({ state: { quality: "low" }, version: 0 }),
    );
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
function observe(target) {
  target.on("pageerror", (error) => report.errors.push(error.message));
  target.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });
  target.on("response", (response) => {
    if (response.status() >= 400)
      report.errors.push(`${response.status()} ${response.url()}`);
  });
  target.on("request", (request) => {
    const url = request.url();
    if (
      /^https?:/.test(url) &&
      !url.startsWith(base) &&
      !report.externalRequests.includes(url)
    )
      report.externalRequests.push(url);
  });
}
observe(page);
async function check(name, action) {
  if ((await action()) === "skip") {
    report.skippedChecks.push(name);
    console.log(`SKIP ${name}`);
    return;
  }
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
async function shot(name, target = page) {
  const filename = path.join(output, `palace-${name}.png`);
  await target.screenshot({ path: filename, fullPage: false });
  report.screenshots.push(filename);
}
async function category(name) {
  await page
    .getByRole("navigation", { name: "Collection categories" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
async function travel(id) {
  await page.locator(".guide-button").click();
  const room = rooms.find((value) => value.id === id);
  // 新区域的说明会引用旧房间名；以真实编号和标题定位同一入口。
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByRole("button", { name: new RegExp("^" + escaped(room.number) + "\\s+" + escaped(room.title)) }).click();
  // 骑行使用更轻的地面入口标题；保留真实可见标题的断言，不能等待其已隐藏的旧 HUD 副本。
  if(id==="cycling")await page.locator(".road-entry-copy h2").filter({hasText:room.title}).waitFor();
  else await page.locator(".room-caption").filter({ hasText: room.title }).waitFor();
  await page.waitForTimeout(450);
}
async function slider(locator, value) {
  await locator.evaluate((element, requested) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(element, String(requested));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
async function persisted() {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("memory-palace:v3") || "{}").state || {},
  );
}
try {
  if (process.env.PALACE_VERIFY_DIST === "1")
    await check(
      "static project remains readable without JavaScript or WebGL",
      async () => {
        const readableContext = await browser.newContext({
          javaScriptEnabled: false,
        });
        const readable = await readableContext.newPage();
        observe(readable);
        try {
          await readable.goto(`${base}/projects/${projects[0].id}/`);
          await readable
            .getByRole("heading", { name: projects[0].title, exact: true })
            .waitFor();
          assert.ok(
            (await readable.locator("article").innerText()).includes(
              projects[0].description,
            ),
          );
          assert.equal(await readable.locator("canvas").count(), 0);
          assert.match(await readable.title(), /The Memory Palace/);
        } finally {
          await readableContext.close();
        }
      },
    );
  await check(
    "initial desktop architecture renders at medium quality before entering",
    async () => {
      await page.goto(`${base}/?view=index`);
      await page
        .getByRole("heading", { name: "Projects.", exact: true })
        .waitFor();
      await page.evaluate(() =>
        localStorage.setItem(
          "memory-palace:v3",
          JSON.stringify({ state: { quality: "medium" }, version: 0 }),
        ),
      );
      const sculpture = page.waitForResponse(
        (response) =>
          response.url().endsWith("/assets/memory-glass.glb") &&
          response.status() < 400,
      );
      await page.goto(base);
      await page
        .getByRole("button", { name: "ENTER THE PALACE", exact: true })
        .waitFor();
      await sculpture;
      await page.waitForTimeout(2500);
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            let frames = 0;
            const tick = () => {
              if (++frames >= 6) resolve();
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      await shot("production-initial-medium");
      // The interaction suite uses the conservative tier in software-rendered CI.
      await page.goto(`${base}/?view=index`);
      await page
        .getByRole("heading", { name: "Projects.", exact: true })
        .waitFor();
      await page.evaluate(() =>
        localStorage.setItem(
          "memory-palace:v3",
          JSON.stringify({ state: { quality: "low" }, version: 0 }),
        ),
      );
    },
  );
  await check(
    "2D index is independently accessible, searchable and focus links reload",
    async () => {
      await page.goto(`${base}/?view=index`);
      await page
        .getByRole("heading", { name: "Projects.", exact: true })
        .waitFor();
      await shot("index");
      const search = page.getByRole("searchbox", { name: "Search collection" });
      await search.fill(projects[0].title);
      assert.equal(await page.locator(".index-item").count(), 1);
      await page.locator(".index-item").first().click();
      await page.getByRole("dialog", { name: projects[0].title }).waitFor();
      assert.match(page.url(), new RegExp(`/projects/${projects[0].id}`));
      await page.reload();
      await page.getByRole("dialog", { name: projects[0].title }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(new URL(page.url()).pathname, "/projects");
      assert.equal(new URL(page.url()).searchParams.get("view"), "index");
      await category("Research");
      await page
        .getByRole("heading", { name: "Research.", exact: true })
        .waitFor();
    },
  );
  await check(
    "local audio import, metadata edits, legal NetEase links and playback survive navigation",
    async () => {
      await category("Music");
      assert.equal(
        await page
          .getByRole("button", { name: "Pause music", exact: true })
          .count(),
        0,
      );
      await page.getByLabel("Import local audio files").setInputFiles({
        name: "QA_private_song.wav",
        mimeType: "audio/wav",
        buffer: await readFile(
          path.join(root, "public/media/generated/palace-study.wav"),
        ),
      });
      const row = page
        .locator(".record-row")
        .filter({ hasText: "QA private song" });
      await row.waitFor();
      await row
        .getByRole("button", { name: "Edit QA private song", exact: true })
        .click();
      await page.getByLabel("Import local album art").setInputFiles({
        name: "QA_album.webp",
        mimeType: "image/webp",
        buffer: await readFile(
          path.join(root, "public/media/generated/nocturne.webp"),
        ),
      });
      await page
        .getByRole("img", { name: "Current album artwork", exact: true })
        .waitFor();
      await page
        .locator('.metadata-form input[name="title"]')
        .fill("A private memory");
      await page
        .locator('.metadata-form input[name="artist"]')
        .fill("QA collection");
      await page
        .getByRole("button", { name: "SAVE NOTES →", exact: true })
        .click();
      await page
        .locator(".record-row")
        .filter({ hasText: "A private memory" })
        .getByRole("button", { name: /A private memory.*QA collection/ })
        .click();
      await page
        .getByRole("button", { name: "Pause music", exact: true })
        .waitFor();
      await page.waitForFunction(
        () =>
          Number(
            document.querySelector('input[aria-label="Track progress"]')?.value,
          ) > 0.2,
      );
      await slider(page.getByRole("slider", { name: "Music volume" }), 0.34);
      await page
        .getByRole("combobox", { name: "Crossfade duration" })
        .selectOption("5");
      await category("Research");
      await page.waitForTimeout(700);
      await category("Music");
      await page
        .getByRole("button", { name: "Pause music", exact: true })
        .waitFor();
      assert.ok(
        Number(
          await page
            .getByRole("slider", { name: "Track progress" })
            .inputValue(),
        ) > 0.2,
      );
      await page.getByRole("button", { name: /NETEASE LINK/ }).click();
      await page
        .locator('.collection-form input[name="url"]')
        .fill("https://music.163.com/#/song?id=123456");
      await page
        .locator('.collection-form input[name="title"]')
        .fill("An official share");
      await page
        .getByRole("button", { name: "SAVE TO COLLECTION →", exact: true })
        .click();
      const official = page
        .locator(".record-row")
        .filter({ hasText: "An official share" });
      await official.waitFor();
      assert.equal(
        await official
          .getByRole("link", { name: "Open An official share on NetEase" })
          .getAttribute("href"),
        "https://music.163.com/#/song?id=123456",
      );
      assert.match(await official.innerText(), /OFFICIAL LINK/);
      await shot("music-index");
      await page.reload();
      await category("Music");
      await page
        .locator(".record-row")
        .filter({ hasText: "A private memory" })
        .waitFor();
      await page
        .locator(".record-row")
        .filter({ hasText: "An official share" })
        .waitFor();
      await page.locator(".record-sleeve img").waitFor();
      assert.match(
        await page.locator(".record-sleeve img").getAttribute("src"),
        /^blob:/,
        "private imported album artwork should restore from IndexedDB",
      );
      await page.waitForFunction(() => {
        const img = document.querySelector(".record-sleeve img");
        return img?.complete && img.naturalWidth > 0;
      });
      assert.equal(
        await page
          .getByRole("button", { name: "Pause music", exact: true })
          .count(),
        0,
        "refresh must not autoplay",
      );
      assert.equal(
        await page.getByRole("slider", { name: "Music volume" }).inputValue(),
        "0.34",
      );
      assert.equal(
        await page
          .getByRole("combobox", { name: "Crossfade duration" })
          .inputValue(),
        "5",
      );
      assert.ok(
        Number(
          await page
            .getByRole("slider", { name: "Track progress" })
            .inputValue(),
        ) > 0.2,
        "refresh should restore the last playback position without autoplay",
      );
      await page
        .getByRole("button", { name: "Play music", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Pause music", exact: true })
        .waitFor();
      assert.match(
        await page.locator(".record-information h3").innerText(),
        /A private memory/,
      );
      await page
        .getByRole("button", { name: "Pause music", exact: true })
        .click();
    },
  );
  await check(
    "private images persist, full original is viewable, and image cinema enters 3D",
    async () => {
      await category("Wallpapers");
      await page.getByLabel("Import files into a room").setInputFiles({
        name: "QA_private_image.webp",
        mimeType: "image/webp",
        buffer: await readFile(
          path.join(root, "public/media/generated/threshold.webp"),
        ),
      });
      await page.getByLabel("Target gallery").selectOption("wallpapers");
      await page.locator(".import-drafts input").fill("QA private image");
      await page
        .getByRole("button", { name: "CONFIRM PLACEMENT", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "View QA private image fullscreen",
          exact: true,
        })
        .waitFor();
      await page.reload();
      await category("Wallpapers");
      assert.equal(
        await page
          .getByRole("link", { name: "Download QA private image", exact: true })
          .getAttribute("download"),
        "QA_private_image.webp",
        "private image download retains its original filename and format",
      );
      await page
        .getByRole("button", {
          name: "View QA private image fullscreen",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog", { name: "QA private image", exact: true })
        .waitFor();
      await shot("image-fullscreen");
      await page
        .getByRole("button", { name: "Close fullscreen image", exact: true })
        .click();
      await page
        .locator(".visual-work")
        .filter({ hasText: "QA private image" })
        .getByRole("button", { name: /ENTER WALLPAPER CINEMA/ })
        .click();
      await page.locator("canvas").waitFor();
      await page
        .locator(".room-caption")
        .filter({ hasText: "WALLPAPER CINEMA" })
        .waitFor();
      assert.equal(new URL(page.url()).pathname, "/cinema");
      assert.equal(new URL(page.url()).searchParams.has("view"), false);
      await page.waitForTimeout(1500);
      await shot("cinema");
      await travel("wallpapers");
      await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
      await page
        .getByRole("dialog", { name: "Visual collection", exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: "View QA private image fullscreen",
          exact: true,
        })
        .click();
      const fullscreen = page.getByRole("dialog", {
        name: "QA private image",
        exact: true,
      });
      await fullscreen.waitFor();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await fullscreen
          .getByRole("button", { name: "ENTER CINEMA →", exact: true })
          .evaluate((button) => button === document.activeElement),
        true,
        "fullscreen traps backward keyboard focus",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await fullscreen
          .getByRole("button", { name: "Close fullscreen image", exact: true })
          .evaluate((button) => button === document.activeElement),
        true,
        "fullscreen traps forward keyboard focus",
      );
      await page.keyboard.press("Escape");
      await fullscreen.waitFor({ state: "hidden" });
      await page
        .getByRole("dialog", { name: "Visual collection", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("dialog", { name: "Visual collection", exact: true })
        .waitFor({ state: "hidden" });
    },
  );
  await check(
    "all main gallery rooms are reachable through the museum guide",
    async () => {
      for (const room of rooms.filter(
        (value) => !value.hidden && value.id !== "cinema",
      )) {
        await travel(room.id);
        assert.equal(
          new URL(page.url()).pathname,
          room.id === "atrium" ? "/" : `/${room.id}`,
        );
        await shot(room.id);
      }
      await travel("atrium");
      await page
        .locator(".room-caption")
        .filter({ hasText: "THE ATRIUM" })
        .waitFor();
      const remembered = await persisted();
      for (const id of [
        "atrium",
        "projects",
        "research",
        "music",
        "wallpapers",
        "experiments",
        "archive",
        "corridor",
      ])
        assert.ok(remembered.visits[id] > 0, `${id} visit persisted`);
    },
  );
  await check(
    "desktop exploration, bookmarks and comfort settings survive reload",
    async () => {
      await page.locator(".guide-button").click();
      await page
        .getByRole("button", { name: "Bookmark room", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Experience settings", exact: true })
        .click();
      await page.getByLabel("Rendering quality").selectOption("low");
      await page.getByLabel("Reduce motion").check();
      await page
        .getByRole("checkbox", { name: "Mute all sound", exact: true })
        .check();
      await slider(page.getByLabel("Mouse sensitivity"), 0.42);
      await page
        .getByRole("dialog", { name: "Experience settings" })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await page.keyboard.down("w");
      await page.waitForTimeout(1600);
      await page.keyboard.up("w");
      await page.keyboard.down("d");
      await page.waitForTimeout(800);
      await page.keyboard.up("d");
      const state = await persisted();
      assert.ok(state.bookmarks.includes("atrium"));
      assert.equal(state.quality, "low");
      assert.equal(state.reducedMotion, true);
      assert.equal(state.mute, true);
      assert.equal(state.sensitivity, 0.42);
      const debug = await page.evaluate(() => {
        const debug = window.__PALACE_DEBUG__;
        return debug
          ? { position: debug.camera.position.toArray(), roomId: debug.roomId }
          : null;
      });
      if (debug?.position) {
        assert.ok(debug.position.every(Number.isFinite));
        assert.ok(
          Math.abs(debug.position[0]) < 40 && Math.abs(debug.position[2]) < 80,
        );
      }
      await page.reload();
      await page
        .getByRole("button", { name: "ENTER THE PALACE", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "ENTER THE PALACE", exact: true })
        .click();
      await page.locator(".guide-button").click();
      await page
        .getByRole("button", { name: "Unbookmark room", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Experience settings", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Rendering quality").inputValue(),
        "low",
      );
      assert.equal(await page.getByLabel("Reduce motion").isChecked(), true);
      await page.keyboard.press("Escape");
      await shot("explore");
    },
  );
  await check(
    "first-person controls move smoothly and corridor walls contain the visitor",
    async () => {
      await travel("corridor");
      const available = await page.evaluate(() => !!window.__PALACE_DEBUG__);
      if (!available) {
        report.movementDiagnostics =
          "Production build: private developer camera diagnostics omitted. Exact movement/collision and resident-chunk assertions are covered by development browser QA and unit tests.";
        return "skip";
      }
      const start = await page.evaluate(() =>
        window.__PALACE_DEBUG__.camera.position.toArray(),
      );
      await page.keyboard.down("w");
      await page.waitForTimeout(1400);
      await page.keyboard.up("w");
      const moved = await page.evaluate(() =>
        window.__PALACE_DEBUG__.camera.position.toArray(),
      );
      assert.ok(moved[2] < start[2] - 0.1, "W must advance through the room");
      await page.evaluate(() => {
        window.__PALACE_DEBUG__.camera.position.x = 3.075;
      });
      await page.keyboard.down("d");
      await page.waitForTimeout(500);
      await page.keyboard.up("d");
      const boundary = await page.evaluate(() =>
        window.__PALACE_DEBUG__.camera.position.toArray(),
      );
      assert.ok(
        boundary[0] <= 3.351 && boundary[0] > 3.34,
        "walk collision must stop at the corridor wall",
      );
      assert.equal(boundary[1], 1.65);
      const chunkCount = await page.evaluate(
        () => window.__PALACE_DEBUG__.residentCorridorChunks,
      );
      assert.equal(chunkCount, 5);
      report.movementDiagnostics = {
        start,
        moved,
        boundary,
        residentCorridorChunks: chunkCount,
      };
    },
  );
  await check(
    "procedural and project direct links load, browser back restores the room",
    async () => {
      await page.goto(`${base}/anomaly-floating`);
      await page.locator("canvas").waitFor();
      await page.waitForTimeout(800);
      await shot("floating");
      await page.goto(`${base}/exhibit-${projects[0].id}/`);
      await page.locator("canvas").waitFor();
      await page.locator(".room-caption").waitFor();
      assert.equal(new URL(page.url()).pathname, `/exhibit-${projects[0].id}/`);
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "a dedicated exhibit link should enter its room rather than immediately opening a modal",
      );
      await page.waitForTimeout(500);
      await shot("dedicated-exhibit");
      await page.goto(`${base}/projects/${projects[0].id}`);
      await page.getByRole("dialog", { name: projects[0].title }).waitFor();
      await page.reload();
      await page.getByRole("dialog", { name: projects[0].title }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(new URL(page.url()).pathname, "/projects");
      await travel("music");
      await travel("research");
      await page.goBack();
      await page
        .locator(".room-caption")
        .filter({ hasText: "LISTENING ROOM" })
        .waitFor();
    },
  );
  report.frameTimings = await page.evaluate(async () => {
    const samples = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      let frames = 0;
      const tick = (now) => {
        samples.push(now - previous);
        previous = now;
        if (++frames >= 75) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    samples.sort((a, b) => a - b);
    return {
      renderer:
        "headless installed Edge / D3D11; functional timing sample only",
      room: "Listening room",
      medianMs: Math.round(samples[37] * 10) / 10,
      p95Ms: Math.round(samples[71] * 10) / 10,
    };
  });
  // Keep just one WebGL context active while checking a small touch device.
  await page.goto(`${base}/?view=index`);
  await category("Projects");
  await page.getByRole("heading", { name: "Projects.", exact: true }).waitFor();
  await check(
    "mobile tour and collection index work without horizontal overflow",
    async () => {
      const mobileContext = await browser.newContext({
        ...devices["iPhone 13"],
        reducedMotion: "reduce",
      });
      const mobile = await mobileContext.newPage();
      mobile.setDefaultTimeout(60000);
      observe(mobile);
      await mobile.goto(base);
      await mobile
        .getByRole("button", { name: "ENTER THE PALACE", exact: true })
        .waitFor();
      await mobile.waitForTimeout(1400);
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await shot("mobile-initial", mobile);
      await mobile
        .getByRole("button", { name: "ENTER THE PALACE", exact: true })
        .click();
      await mobile
        .locator(".room-caption")
        .filter({ hasText: "THE ATRIUM" })
        .waitFor();
      await mobile.waitForTimeout(500);
      await shot("mobile-atrium", mobile);
      await mobile.locator(".guide-button").click();
      await mobile.getByRole("dialog", { name: "Museum guide" }).waitFor();
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await shot("mobile-guide", mobile);
      await mobile
        .locator(".guide-footer")
        .getByRole("button", { name: /2D COLLECTION INDEX/ })
        .click();
      await mobile
        .getByRole("heading", { name: "Projects.", exact: true })
        .waitFor();
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await shot("mobile-index", mobile);
      await mobileContext.close();
    },
  );
  assert.deepEqual(
    report.errors,
    [],
    "browser console and page errors must be empty",
  );
  assert.equal(
    report.externalRequests.filter(
      (url) => !url.startsWith("https://api.github.com/"),
    ).length,
    0,
    "gallery assets and imports should stay local",
  );
  console.log(
    `PASS ${report.checks.length} browser scenarios; no console or runtime errors`,
  );
} catch (error) {
  report.failure = error.stack || String(error);
  await shot("failure").catch(() => undefined);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(output, "palace-browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
