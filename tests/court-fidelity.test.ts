import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from "three";
import { cloneTreeTextures } from "../src/worlds/court/assets";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("additive park court package", () => {
  it("preserves repeated glTF branch UVs and color spaces on owned texture clones", () => {
    const sources = Array.from({ length: 5 }, () => new Texture()), maps = cloneTreeTextures(sources);
    expect(maps[0]).not.toBe(sources[0]); expect(maps[0].wrapS).toBe(RepeatWrapping); expect(maps[0].wrapT).toBe(RepeatWrapping);
    expect(maps[0].flipY).toBe(false); expect(sources[0].flipY).toBe(true); expect(sources[0].wrapS).not.toBe(RepeatWrapping);
    expect(maps[0].colorSpace).toBe(SRGBColorSpace); expect(maps[1].colorSpace).toBe(NoColorSpace); expect(maps[3].colorSpace).toBe(NoColorSpace);
    expect(maps[4].flipY).toBe(true); expect(maps[4].colorSpace).toBe(SRGBColorSpace);
    maps.forEach(t => t.dispose()); sources.forEach(t => t.dispose());
  });
  it("restores the court's own lighting preference without clearing or rewriting the museum library", async () => {
    const values = new Map([["memory-palace:court-light:v1", "night"], ["existing-private-library", "preserve"]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v) });
    const { useCourtTime } = await import("../src/worlds/court/state");
    expect(useCourtTime.getState().time).toBe("night"); useCourtTime.getState().setTime("day");
    expect(values.get("memory-palace:court-light:v1")).toBe("day"); expect(values.get("existing-private-library")).toBe("preserve");
  });
  it("keeps switching usable when browser storage is unavailable", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw Error("Denied"); }, setItem: () => { throw Error("Denied"); } });
    const { useCourtTime } = await import("../src/worlds/court/state");
    expect(useCourtTime.getState().time).toBe("day"); useCourtTime.getState().setTime("night"); expect(useCourtTime.getState().time).toBe("night");
  });
  it("ships valid bounded metre-scale spectator geometry and locally resolvable textures", async () => {
    const root = new URL("../public/media/court/people/", import.meta.url);
    for (const name of await readdir(root)) {
      const folder = new URL(name + "/", root), data = JSON.parse(await readFile(new URL("pose.gltf", folder), "utf8")), bin = await readFile(new URL("pose.bin", folder));
      expect(bin.byteLength).toBe(data.buffers[0].byteLength);
      for (const view of data.bufferViews) expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(bin.byteLength);
      const position = data.accessors[data.meshes[0].primitives[0].attributes.POSITION];
      expect(position.min[1]).toBeCloseTo(0); expect(position.max[1]).toBeGreaterThan(1.5); expect(position.max[1]).toBeLessThan(2);
      let triangles = 0;
      for (const mesh of data.meshes) for (const p of mesh.primitives) triangles += data.accessors[p.indices].count / 3;
      expect(triangles).toBeLessThan(9000);
      for (const image of data.images) { expect(image.uri).toMatch(/^[a-z0-9_]+\.webp$/); expect((await readFile(new URL(image.uri, folder))).length).toBeGreaterThan(100); }
    }
  });
  it("contains attribution and no commercial music, private lists, original FBX or reference video", async () => {
    const root = new URL("../public/media/court/", import.meta.url);
    expect(await readFile(new URL("ROCKETBOX-LICENSE.md", root), "utf8")).toContain("Copyright (c) 2020 Microsoft");
    expect(await readFile(new URL("SOURCES.md", root), "utf8")).toContain("CC0");
    async function walk(dir: string): Promise<string[]> { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(e => e.isDirectory() ? walk(join(dir, e.name)) : [e.name]))).flat(); }
    for (const file of await walk(decodeURI(root.pathname).replace(/^\/([A-Za-z]:)/, "$1"))) {
      expect(file).not.toMatch(/\.(mp3|flac|m4a|wav|lrc|mp4|fbx|html)$/i); expect(file).not.toBe("collection.json");
    }
  });
});
