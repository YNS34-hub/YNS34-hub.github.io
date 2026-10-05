import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
const execute = promisify(execFile);
const fixtures: string[] = [];
afterEach(async () => {
  for (const root of fixtures.splice(0))
    await rm(root, { recursive: true, force: true });
});
describe("personal media registration", () => {
  it("keeps stable audio IDs, registers real LRC, uses safe delivery paths and excludes music and lyrics from public builds", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "palace-audio-"));
    fixtures.push(root);
    const dir = path.join(root, "personal-media/music");
    await mkdir(dir, { recursive: true });
    const wav = Buffer.alloc(44 + 800);
    wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(800, 40);
    const file = "私人,本地&音频.wav";
    await writeFile(path.join(dir, file), wav);
    await writeFile(path.join(dir, file.replace(".wav", ".lrc")), "[00:00.01]A local test line\n[00:00.03]Another local test line");
    const run = (args: string[] = []) => execute(process.execPath, ["scripts/register-personal-media.mjs", ...args], { env: { ...process.env, PALACE_MEDIA_ROOT: root } });
    const manifestPath = path.join(root, "public/personal-media/manifest.json");
    await run();
    const track = JSON.parse(await readFile(manifestPath, "utf8")).music[0];
    expect(track.id).toBe(`personal-music-${Buffer.from(file).toString("hex")}`);
    expect(track.year).toBe("");
    expect(track.src).toMatch(/^\/personal-media\/music\/audio\/[a-f0-9]{64}\.wav$/);
    expect(track.lyrics).toMatchObject({ synced: true, source: "Local LRC", lines: [{ time: 0.01, text: "A local test line" }, { time: 0.03, text: "Another local test line" }] });
    expect(await readFile(path.join(root, "public", track.src))).toEqual(wav);
    await run();
    expect(JSON.parse(await readFile(manifestPath, "utf8")).music[0].id).toBe(track.id);
    await run(["--public"]);
    expect(JSON.parse(await readFile(manifestPath, "utf8")).music).toEqual([]);
    expect(await readdir(path.join(root, "public/personal-media"))).toEqual(["manifest.json"]);
    expect(await readFile(path.join(dir, file))).toEqual(wav);
  });
  it("copies a real website alongside its preview and rejects paths outside the collection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "palace-site-"));
    fixtures.push(root);
    const dir = path.join(root, "personal-media/projects");
    await mkdir(path.join(dir, "nested"), { recursive: true });
    await writeFile(path.join(dir, "nested", "view.jpg"), "image");
    await writeFile(
      path.join(dir, "nested", "世界.html"),
      "<html>A personal website</html>",
    );
    await writeFile(path.join(dir, "escape.jpg"), "image");
    await writeFile(
      path.join(dir, "collection.json"),
      JSON.stringify({
        "nested/view.jpg": {
          projectFile: "nested/世界.html",
          github:
            "https://github.com/YNS34-hub/collection/blob/main/example.html",
        },
        "escape.jpg": {
          projectFile: "../../outside.html",
          github: "javascript:alert(1)",
        },
      }),
    );
    await execute(process.execPath, ["scripts/register-personal-media.mjs"], {
      env: { ...process.env, PALACE_MEDIA_ROOT: root },
    });
    const manifest = JSON.parse(
      await readFile(
        path.join(root, "public/personal-media/manifest.json"),
        "utf8",
      ),
    );
    expect(
      manifest.projects.find(
        (x: { fileName: string }) => x.fileName === "nested/view.jpg",
      ).projectUrl,
    ).toBe("/personal-media/projects/nested/%E4%B8%96%E7%95%8C.html");
    expect(
      manifest.projects.find(
        (x: { fileName: string }) => x.fileName === "escape.jpg",
      ).projectUrl,
    ).toBeUndefined();
    expect(
      manifest.projects.find(
        (x: { fileName: string }) => x.fileName === "escape.jpg",
      ).github,
    ).toBeUndefined();
    expect(
      await readFile(
        path.join(root, "public/personal-media/projects/nested/世界.html"),
        "utf8",
      ),
    ).toContain("personal website");
  });
  it("registers nested, uppercase and unicode files, keeps originals, removes stale copies, and excludes private files in a public release", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "palace-media-"));
    fixtures.push(root);
    const dir = path.join(root, "personal-media/chatgpt-images/玻璃");
    await mkdir(dir, { recursive: true });
    const original = Buffer.from("an original local image fixture");
    await writeFile(path.join(dir, "鲸.JPG"), original);
    await writeFile(
      path.join(root, "personal-media/chatgpt-images/collection.json"),
      "\uFEFF" +
        JSON.stringify([
          {
            file: "玻璃/鲸.JPG",
            title: "Glass life",
            category: "glass",
            year: "2026",
            favorite: true,
            primary: true,
            roomIds: ["glass-life", "bad"],
          },
        ]),
    );
    const run = (args: string[] = []) =>
      execute(
        process.execPath,
        ["scripts/register-personal-media.mjs", ...args],
        { env: { ...process.env, PALACE_MEDIA_ROOT: root } },
      );
    await run();
    let manifest = JSON.parse(
      await readFile(
        path.join(root, "public/personal-media/manifest.json"),
        "utf8",
      ),
    );
    expect(manifest.visuals[0]).toMatchObject({
      title: "Glass life",
      category: "glass",
      date: "2026",
      favorite: true,
      primary: true,
      roomIds: ["glass-life"],
      src: "/personal-media/chatgpt-images/%E7%8E%BB%E7%92%83/%E9%B2%B8.JPG",
    });
    expect(await readFile(path.join(dir, "鲸.JPG"))).toEqual(original);
    await writeFile(
      path.join(root, "public/personal-media/stale.png"),
      "stale",
    );
    await run(["--public"]);
    manifest = JSON.parse(
      await readFile(
        path.join(root, "public/personal-media/manifest.json"),
        "utf8",
      ),
    );
    expect(
      Object.values(manifest).every(
        (items) => Array.isArray(items) && items.length === 0,
      ),
    ).toBe(true);
    expect(await readdir(path.join(root, "public/personal-media"))).toEqual([
      "manifest.json",
    ]);
    expect(await readFile(path.join(dir, "鲸.JPG"))).toEqual(original);
    await run();
    expect(
      await readFile(
        path.join(root, "public/personal-media/chatgpt-images/玻璃/鲸.JPG"),
      ),
    ).toEqual(original);
  });
});
