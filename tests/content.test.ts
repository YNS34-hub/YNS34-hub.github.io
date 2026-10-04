import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  allContent,
  rooms,
  research,
  archive,
  music,
  wallpapers,
  reviewWorkflow,
} from "../src/content/catalog";

describe("the local museum catalog", () => {
  it("keeps every exhibit and room address stable and unique", () => {
    expect(new Set(allContent.map((item) => item.id)).size).toBe(
      allContent.length,
    );
    expect(new Set(rooms.map((room) => room.id)).size).toBe(rooms.length);
    for (const item of allContent) {
      expect(item.id).toMatch(/^[a-z0-9-]+$/);
      expect(item.description.length).toBeGreaterThan(40);
      expect(item.tags.length).toBeGreaterThan(0);
      expect(item.status.length).toBeGreaterThan(0);
    }
  });
  it("ships real project previews and a metadata-only listening shelf", () => {
    for (const asset of [
      ...music.flatMap((track) => [track.src, track.cover]),
      ...wallpapers.map((image) => image.src),
      ...allContent.map((item) => item.cover),
    ].filter(Boolean)) {
      expect(asset).toMatch(/^\//);
      expect(existsSync(resolve(process.cwd(), `public${asset}`))).toBe(true);
    }
    expect(music.every((track) => !track.src && track.artist === "梁博")).toBe(
      true,
    );
    expect(music.map((track) => track.title)).toEqual([
      "男孩",
      "出现又离开",
      "日落大道",
      "灵魂歌手",
    ]);
    expect(wallpapers).toEqual([]);
  });
  it("keeps private prototypes private and external authorship explicit", () => {
    const audit = research.find((item) => item.id === "reviewer-first-audit");
    expect(audit).toBeDefined();
    const echo = archive.find((item) => item.id === "echodate-ai");
    expect(audit?.github).toBeUndefined();
    expect(echo?.github).toBeUndefined();
    for (const item of archive.filter((item) => item.tags.includes("Fork"))) {
      expect(item.description).toMatch(/upstream|Original authorship/);
      expect(
        item.links?.some(
          (link) =>
            link.url.startsWith("https://github.com/") &&
            !link.url.includes("/YNS34-hub/"),
        ),
      ).toBe(true);
    }
    for (const item of research) expect(item.journal).toBeUndefined();
  });
  it("preserves the original five-step human-led review workflow and room guide", () => {
    expect(reviewWorkflow.map((step) => step.id)).toEqual([
      "question",
      "challenge",
      "verify",
      "refine",
      "human",
    ]);
    expect(reviewWorkflow[4].copy).toContain("researcher verifies");
    for (const id of [
      "atrium",
      "projects",
      "research",
      "music",
      "wallpapers",
      "experiments",
      "archive",
      "corridor",
      "cinema",
    ]) {
      expect(rooms.some((room) => room.id === id && !room.hidden)).toBe(true);
    }
    expect(rooms.find((room) => room.id === "memory")?.hidden).toBe(true);
  });
  it("builds discoverable deep routes without overriding legacy or fork authorship", async () => {
    const output = await mkdtemp(resolve(tmpdir(), "palace-routes-"));
    try {
      await writeFile(
        resolve(output, "index.html"),
        await readFile(resolve(process.cwd(), "index.html"), "utf8"),
      );
      await mkdir(resolve(output, "legacy"));
      await writeFile(
        resolve(output, "legacy/index.html"),
        "preserved-original",
      );
      await mkdir(resolve(output, "personal-media"));
      await writeFile(
        resolve(output, "personal-media/manifest.json"),
        JSON.stringify({
          wallpapers: [],
          visuals: [
            { id: "glass-1", category: "glass" },
            { id: "glass-2", category: "glass" },
            { id: "glass-3", category: "glass" },
            { id: "glass-4", category: "glass" },
            { id: "glass-5", category: "glass" },
            { id: "glass-6", category: "glass" },
          ],
          projects: [],
          research: [],
        }),
      );
      await promisify(execFile)(process.execPath, ["scripts/postbuild.mjs"], {
        cwd: process.cwd(),
        env: { ...process.env, PALACE_OUTPUT_DIR: output },
      });
      const deepPage = await readFile(
        resolve(output, "research/nonlinear-elliptic-problems/index.html"),
        "utf8",
      );
      expect(deepPage).toContain(
        "<title>Nonlinear Elliptic Problems — The Memory Palace</title>",
      );
      expect(deepPage).toContain("Graduate manuscript · in revision");
      expect(deepPage).toContain(
        "https://yns34-hub.github.io/research/nonlinear-elliptic-problems/",
      );
      expect(deepPage).toContain('id="static-collection"');
      const forkPage = await readFile(
        resolve(output, "archive/buzz-reference/index.html"),
        "utf8",
      );
      const creativeWork = forkPage.match(
        /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"CreativeWork".*?)<\/script>/,
      )?.[1];
      expect(creativeWork).toBeTruthy();
      expect(JSON.parse(creativeWork!).creator).toBeUndefined();
      expect(await readFile(resolve(output, "legacy/index.html"), "utf8")).toBe(
        "preserved-original",
      );
      expect(existsSync(resolve(output, "404.html"))).toBe(true);
      expect(existsSync(resolve(output, "glass-life-page-2/index.html"))).toBe(
        true,
      );
      expect(await readFile(resolve(output, "sitemap.xml"), "utf8")).toContain(
        "/music/",
      );
      expect(
        await readFile(resolve(output, "sitemap.xml"), "utf8"),
      ).not.toContain("/memory/");
      for (const room of rooms.filter((room) => room.hidden)) {
        const hiddenPage = await readFile(
          resolve(output, room.id, "index.html"),
          "utf8",
        );
        expect(hiddenPage).toContain(`https://yns34-hub.github.io/${room.id}/`);
        expect(hiddenPage).toContain('name="robots" content="noindex, follow"');
        expect(
          await readFile(resolve(output, "sitemap.xml"), "utf8"),
        ).not.toContain(`/${room.id}/`);
      }
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });
});
