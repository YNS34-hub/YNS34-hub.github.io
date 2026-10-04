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
