import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
const base = process.env.PALACE_URL || "http://127.0.0.1:5190",
  out = path.resolve(
    process.env.PALACE_ARTIFACTS || "qa-artifacts/quality-leap",
  );
await mkdir(path.join(out, "flows"), { recursive: true });
const report = {
  environment: "Installed Edge / real D3D11 GPU / 1920x1080 DPR1 medium",
  checks: [],
  skippedChecks: [],
  observations: [],
  errors: [],
};
const browser = await chromium.launch({
  executablePath:
    process.env.PALACE_BROWSER ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await context.addInitScript(() => {
  if (window.top !== window) return;
  if (!localStorage.getItem("memory-palace:v3"))
    localStorage.setItem(
      "memory-palace:v3",
      JSON.stringify({
        state: {
          quality: "medium",
          tutorialDone: true,
          reducedMotion: false,
          roomSoundtracks: false,
          mute: false,
        },
        version: 0,
      }),
    );
});
const page = await context.newPage();
page.setDefaultTimeout(35000);
page.on("pageerror", (e) => report.errors.push(e.message));
const audioTitle = process.env.PALACE_TEST_TRACK || "Palace Study — No. 01";
const roomList = JSON.parse(await readFile("content/rooms.json", "utf8"));
const ready = async () => {
  await page.waitForFunction(
    () =>
      !!window.__PALACE_DEBUG__?.camera &&
      document.querySelector(".world-ready"),
  );
};
const state = () =>
  page.evaluate(async () => {
    const { state: usePalaceStore } = window.__PALACE_DEV__;
    const s = usePalaceStore.getState();
    return {
      room: s.roomId,
      mode: s.mode,
      overlay: s.overlay,
      memoryReveal: s.memoryReveal,
      pendingDoor: s.pendingDoor,
    };
  });
const sameView = (actual, expected) => {
  for (const field of ["position", "quaternion"])
    actual[field].forEach((x, i) =>
      assert.ok(
        Math.abs(x - expected[field][i]) < 1e-6,
        "original " + field + " restored",
      ),
    );
};
const view = () =>
  page.evaluate(() => {
    const c = window.__PALACE_DEBUG__.camera;
    return {
      position: c.position.toArray(),
      quaternion: c.quaternion.toArray(),
    };
  });
async function pose(position, target) {
  await page.evaluate(
    async ({ position, target }) => {
      const { state: usePalaceStore } = window.__PALACE_DEV__;
      const s = usePalaceStore.getState(),
        c = window.__PALACE_DEBUG__.camera;
      c.position.set(...position);
      c.lookAt(...target);
      s.update({
        started: true,
        overlay: null,
        travelSequence: s.travelSequence + 1,
        returnView: {
          roomId: s.roomId,
          position,
          quaternion: c.quaternion.toArray(),
        },
      });
    },
    { position, target },
  );
  await page.waitForTimeout(250);
}
async function travel(room) {
  await page.locator(".guide-button").click();
  const definition = roomList.find((x) => x.id === room);
  // 新目的地的副标题可能包含旧房间名；以原生按钮的编号与标题前缀定位，不削弱返回检查。
  const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page
    .getByRole("button", { name: new RegExp("^" + escaped(definition.number) + "\\s+" + escaped(definition.title)) })
    .click();
  await page.waitForFunction(
    (id) => window.__PALACE_DEBUG__?.roomId === id,
    room,
  );
  await ready();
}
async function shot(name) {
  await page.screenshot({ path: path.join(out, "flows", `${name}.png`) });
}
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS " + name);
  await writeFile(
    path.join(out, "flows.json"),
    JSON.stringify(report, null, 2),
  );
}
async function collection() {
  await page.locator(".guide-button").click();
  await page.getByRole("button", { name: "Arrange / import works" }).click();
}
const allImages = () =>
  page.evaluate(async () => {
    const { library: useLibraryStore } = window.__PALACE_DEV__;
    const l = useLibraryStore.getState();
    return [
      ...l.wallpapers,
      ...l.personal.visuals,
      ...l.personal.projects,
      ...l.personal.research,
    ].map((x) => ({
      id: x.id,
      title: x.title,
      roomIds: x.roomIds,
      primary: x.primary,
      category: x.category,
      favorite: x.favorite,
    }));
  });
const inScene = (id) =>
  page.evaluate(
    (id) => !!window.__PALACE_DEBUG__?.scene.getObjectByName("work:" + id),
    id,
  );
const close = async () => {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
};
try {
  await page.goto(base + "/wallpapers");
  await ready();
  await check(
    "v1 IndexedDB records retain blob, favorite and ID after placement migration",
    async () => {
      const png = await readFile("public/media/generated/threshold.webp");
      await page.evaluate(
        async (bytes) => {
          const { writeLibraryRecord } = await import("/src/systems/idb.ts");
          await writeLibraryRecord({
            id: "qa-v1-kept",
            collection: "wallpapers",
            blob: new Blob([new Uint8Array(bytes)], { type: "image/webp" }),
            data: {
              id: "qa-v1-kept",
              title: "Legacy kept image",
              src: "",
              source: "Local file",
              category: "Private collection",
              description: "Browser QA fixture",
              tags: ["local"],
              date: "2026",
              favorite: true,
              imported: true,
            },
          });
        },
        [...png],
      );
      await page.reload();
      await ready();
      assert.ok(
        (await allImages()).find((x) => x.id === "qa-v1-kept" && x.favorite),
      );
    },
  );
  await check(
    "all main rooms enter, return, load real works and retain WASD control",
    async () => {
      for (const room of roomList.filter(
        (x) => !x.hidden && !["cinema", "atrium"].includes(x.id),
      )) {
        await travel(room.id);
        const before = await view();
        await page.keyboard.down("w");
        await page.waitForTimeout(180);
        await page.keyboard.up("w");
        const after = await view();
        assert.notDeepEqual(
          after.position,
          before.position,
          room.id + " has working movement",
        );
        await travel("atrium");
      }
    },
  );
  await check(
    "memory revelation uses a real collection image, stays in place and is interruptible",
    async () => {
      await pose([4.8, 1.65, 5.2], [0, 3.7, 0]);
      const before = await view();
      await page.getByRole("button", { name: /Reveal the collection/ }).click();
      assert.equal((await state()).memoryReveal, true);
      await page.waitForTimeout(1200);
      await shot("memory-revelation");
      sameView(await view(), before);
      await page.keyboard.press("Escape");
      assert.equal((await state()).memoryReveal, false);
    },
  );
  await check(
    "batch import targets Portraits, persists, renders its stable ID, and isolates failure",
    async () => {
      await travel("portraits");
      await collection();
      await page.getByLabel("Import files into a room").setInputFiles([
        {
          name: "QA portrait.webp",
          mimeType: "image/webp",
          buffer: await readFile("public/media/generated/threshold.webp"),
        },
        {
          name: "broken.png",
          mimeType: "image/png",
          buffer: Buffer.from("not an image"),
        },
      ]);
      assert.equal(
        await page.getByLabel("Target gallery").inputValue(),
        "portraits",
      );
      await page
        .getByRole("button", { name: "CONFIRM PLACEMENT", exact: true })
        .click();
      await page.getByRole("button", { name: "Retry this file" }).waitFor();
      await shot("image-placement");
      const imported = (await allImages()).find(
        (x) => x.title === "QA portrait",
      );
      assert.ok(imported);
      assert.deepEqual(imported.roomIds, ["portraits"]);
      assert.equal(imported.primary, true);
      await page.getByRole("button", { name: "SEE IN THE ROOM →" }).click();
      await ready();
      assert.equal((await state()).room, "portraits");
      assert.ok(await inScene(imported.id));
      await shot("portrait-placed");
      await page.reload();
      await ready();
      assert.ok(await inScene(imported.id));
      await collection();
      const card = page
        .locator(".visual-work")
        .filter({ hasText: "QA portrait" });
      await card.getByRole("button", { name: "ARRANGE WORK" }).click();
      await card.locator("[name=room]").selectOption("glass-life");
      await card.locator("[name=category]").selectOption("glass");
      await card.locator("[name=order]").fill("-2");
      await card.getByRole("button", { name: "SAVE ARRANGEMENT" }).click();
      await close();
      await travel("glass-life");
      assert.ok(await inScene(imported.id));
      await collection();
      const moved = page
        .locator(".visual-work")
        .filter({ hasText: "QA portrait" });
      await moved.getByRole("button", { name: "REMOVE", exact: true }).click();
      await page.locator(".removed-works summary").click();
      await page.getByRole("button", { name: "RESTORE QA portrait" }).click();
      await close();
      assert.ok(await inScene(imported.id));
    },
  );
  await check(
    "Cinema restores exact view from every source; ESC first closes metadata; Back returns",
    async () => {
      for (const room of [
        "wallpapers",
        "portraits",
        "my-collection",
        "corridor",
      ]) {
        await travel(room);
        const before = await view();
        await page.evaluate(async () => {
          const { library: useLibraryStore } = window.__PALACE_DEV__,
            { state: usePalaceStore } = window.__PALACE_DEV__;
          usePalaceStore
            .getState()
            .openCinema(useLibraryStore.getState().wallpapers[0]);
        });
        await ready();
        await page
          .getByRole("button", { name: "Image metadata", exact: true })
          .click();
        await page.keyboard.press("Escape");
        assert.equal((await state()).room, "cinema");
        assert.equal(await page.locator(".cinema-metadata").count(), 0);
        await shot("cinema");
        await page.keyboard.press("Escape");
        await ready();
        assert.equal((await state()).room, room);
        sameView(await view(), before);
        await page.evaluate(async () => {
          const { library: useLibraryStore } = window.__PALACE_DEV__,
            { state: usePalaceStore } = window.__PALACE_DEV__;
          usePalaceStore
            .getState()
            .openCinema(useLibraryStore.getState().wallpapers[0]);
        });
        await ready();
        await page.goBack();
        await ready();
        assert.equal((await state()).room, room);
        sameView(await view(), before);
      }
    },
  );
  await check(
    "modal suspends WASD; project viewing retains the room; exactly one web preview mounts on demand",
    async () => {
      await travel("liquid-web");
      const canEmbed = await page.evaluate(async () => {
        const { library: useLibraryStore } = window.__PALACE_DEV__,
          { state: usePalaceStore } = window.__PALACE_DEV__;
        const work = useLibraryStore
          .getState()
          .personal.projects.find((x) => x.projectUrl) ||
          useLibraryStore.getState().personal.projects.find((x) => x.github);
        if (!work) throw new Error("No real website reference is available");
        usePalaceStore.getState().focusItem({
          id: "qa-web",
          category: "project",
          title: work.title,
          year: "2026",
          description: "Collected website",
          subtitle: "Browser QA",
          tags: ["Website study"],
          status: "REFERENCE",
          cover: work.displaySrc || work.src,
          demo: work.projectUrl,
          github: work.github,
        });
        return !!work.projectUrl;
      });
      const before = await view();
      await page.keyboard.down("w");
      await page.waitForTimeout(400);
      await page.keyboard.up("w");
      sameView(await view(), before);
      assert.equal(await page.locator("iframe").count(), 0);
      if (canEmbed) {
        await page.getByRole("button", { name: "ACTIVATE THIS WEBSITE" }).click();
        assert.equal(await page.locator("iframe").count(), 1);
        await page.waitForTimeout(2500);
      } else {
        await page.getByRole("link", { name: "SOURCE", exact: true }).waitFor();
        report.skippedChecks.push("Live iframe: no private HTML in this build; actual public preview and SOURCE fallback verified");
      }
      await shot("work-view");
      await close();
      assert.equal(await page.locator("iframe").count(), 0);
      sameView(await view(), before);
    },
  );
  await check(
    "kept website references appear in My Collection and disappear when unkept",
    async () => {
      await travel("liquid-web");
      const id = await page.evaluate(async () => {
        const { websiteStudy } = await import("/src/content/websiteStudy.ts");
        const work = window.__PALACE_DEV__.library
          .getState()
          .personal.projects.find((x) => x.category === "liquid-web");
        window.__PALACE_DEV__.state.getState().focusItem(websiteStudy(work));
        return work.id;
      });
      await page
        .getByRole("button", { name: "KEEP THIS WORK", exact: true })
        .click();
      await close();
      await travel("my-collection");
      await page.waitForFunction(
        (id) =>
          !!window.__PALACE_DEBUG__.scene.getObjectByName("project:" + id),
        id,
      );
      await shot("kept-website-in-collection");
      await page.reload();
      await ready();
      assert.ok(
        await page.evaluate(
          (id) =>
            !!window.__PALACE_DEBUG__.scene.getObjectByName("project:" + id),
          id,
        ),
      );
      await page.evaluate(async (id) => {
        const { websiteStudy } = await import("/src/content/websiteStudy.ts");
        const work = window.__PALACE_DEV__.library
          .getState()
          .personal.projects.find((x) => x.id === id);
        window.__PALACE_DEV__.state.getState().focusItem(websiteStudy(work));
      }, id);
      await page
        .getByRole("button", { name: "KEPT IN MY COLLECTION", exact: true })
        .click();
      await close();
      await page.waitForFunction(
        (id) => !window.__PALACE_DEBUG__.scene.getObjectByName("project:" + id),
        id,
      );
    },
  );
  await check(
    "stateful corridor door changes after a real visit, with five bounded resident segments",
    async () => {
      await travel("corridor");
      await pose([0, 1.65, -55], [4.2, 2.25, -55]);
      const point = await page.evaluate(() => {
        const d = window.__PALACE_DEBUG__;
        const p = d.camera.position
          .clone()
          .set(4.15, 2.25, -55)
          .project(d.camera);
        return {
          x: ((p.x + 1) * innerWidth) / 2,
          y: ((1 - p.y) * innerHeight) / 2,
        };
      });
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () => window.__PALACE_DEBUG__?.roomId === "anomaly-mirror",
      );
      await ready();
      await shot("corridor-inner-door");
      await travel("corridor");
      assert.ok((await view()).position[2] < -50);
      await pose([0, 1.65, -55], [4.2, 2.25, -55]);
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () => window.__PALACE_DEBUG__?.roomId === "anomaly-impossible",
      );
      await ready();
      await shot("corridor-larger-interior");
      await travel("corridor");
      for (const z of [-55, -155, -355, -755]) {
        await pose([0, 1.65, z], [0, 2.3, z - 30]);
        assert.equal(
          await page.evaluate(
            () => window.__PALACE_DEBUG__.residentCorridorChunks,
          ),
          5,
        );
      }
    },
  );
  await check(
    "observatory bridge rails and Unfinished exit match their physical walking boundaries",
    async () => {
      await travel("cosmic");
      await pose([0, 1.65, -16], [0, 1.65, -40]);
      await page.keyboard.down("w");
      await page.waitForTimeout(800);
      await page.keyboard.up("w");
      const bridge = await view();
      assert.ok(bridge.position[2] < -17 && bridge.position[2] > -25.61);
      await page.keyboard.down("d");
      await page.waitForTimeout(2000);
      await page.keyboard.up("d");
      assert.ok((await view()).position[0] <= 3.701);
      await shot("observatory-bridge");
      await travel("unfinished");
      await pose([7.5, 1.65, 7.7], [10, 2.25, 11.3]);
      const point = await page.evaluate(() => {
        const d = window.__PALACE_DEBUG__;
        const p = d.camera.position
          .clone()
          .set(10, 2.25, 11.3)
          .project(d.camera);
        return {
          x: ((p.x + 1) * innerWidth) / 2,
          y: ((1 - p.y) * innerHeight) / 2,
        };
      });
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () => window.__PALACE_DEBUG__?.roomId === "atrium",
      );
      await ready();
    },
  );
  await check(
    "actual local audio drives measured frequency bands and settles after pause",
    async () => {
      await travel("music");
      await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
      const row = page.locator(".record-row").filter({ hasText: audioTitle });
      if (!process.env.PALACE_TEST_TRACK && (await row.count()) === 0) {
        await page.getByLabel("Import local audio files").setInputFiles({
          name: `${audioTitle}.wav`,
          mimeType: "audio/wav",
          buffer: await readFile("public/media/generated/palace-study.wav"),
        });
        await row.waitFor();
      }
      assert.equal(await row.count(), 1);
      await row.locator(".record-title").click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Pause music", exact: true })
        .waitFor();
      await shot("music-panel");
      await close();
      await page.waitForTimeout(2500);
      const playing = await page.evaluate(() => {
        const d = window.__PALACE_DEBUG__;
        return {
          signal: { ...d.audioSignal },
          fins: d.scene
            .getObjectByName("audio-fins")
            .children.map((x) => x.rotation.z),
        };
      });
      assert.ok(playing.signal.available);
      assert.ok(playing.signal.bass + playing.signal.mid > 0.01);
      await shot("music-playing");
      await page
        .locator(".now-playing-tag")
        .getByRole("button", { name: "Pause music", exact: true })
        .click();
      await page.waitForTimeout(2500);
      const paused = await page.evaluate(() => ({
        signal: { ...window.__PALACE_DEBUG__.audioSignal },
        fins: window.__PALACE_DEBUG__.scene
          .getObjectByName("audio-fins")
          .children.map((x) => x.rotation.z),
      }));
      assert.equal(paused.signal.available, false);
      assert.ok(paused.signal.bass < 0.002);
      assert.notDeepEqual(playing.fins, paused.fins);
      await shot("music-paused");
      report.observations.push({ playing, paused });
    },
  );
  await check(
    "local audio placement and room soundtrack metadata survive refresh",
    async () => {
      await travel("music");
      await page.getByRole("button", { name: /OPEN COLLECTION/ }).click();
      await page.getByLabel("Import files into a room").setInputFiles({
        name: "QA room soundtrack.wav",
        mimeType: "audio/wav",
        buffer: await readFile("public/media/generated/palace-study.wav"),
      });
      await page
        .getByRole("button", { name: "CONFIRM PLACEMENT", exact: true })
        .click();
      await page.getByRole("button", { name: "SEE IN THE ROOM →" }).click();
      await ready();
      await page.reload();
      await ready();
      const assigned = await page.evaluate(() =>
        window.__PALACE_DEV__.library
          .getState()
          .music.find((x) => x.title === "QA room soundtrack"),
      );
      assert.deepEqual(assigned.roomIds, ["music"]);
      assert.ok(assigned.src.startsWith("blob:"));
    },
  );
  await check(
    "accessible index Cinema returns to index without discarding navigation",
    async () => {
      await page.goto(base + "/wallpapers?view=index");
      await page
        .getByRole("navigation", { name: "Collection categories" })
        .getByRole("button", { name: /Wallpapers/ })
        .click();
      await page
        .locator(".visual-work")
        .first()
        .getByRole("button", { name: /ENTER WALLPAPER CINEMA/ })
        .click();
      await ready();
      await page.keyboard.press("Escape");
      assert.equal((await state()).mode, "index");
      assert.match(page.url(), /view=index/);
      assert.equal(await page.locator(".index-view").count(), 1);
      assert.match(
        await page.locator(".index-sidebar [aria-current=page]").innerText(),
        /Wallpapers/,
      );
    },
  );
  assert.deepEqual(report.errors, []);
  report.exitCode = 0;
} catch (error) {
  report.failure = error.stack;
  report.exitCode = 1;
  process.exitCode = 1;
  console.error(error.stack);
  await shot("failure").catch(() => {});
} finally {
  await writeFile(
    path.join(out, "flows.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
