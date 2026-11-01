import { describe, expect, it } from "vitest";
import { MeshStandardMaterial, Texture } from "three";
import { archiveLayout } from "../src/rooms/reference/curationLayout";
import { createGalleryFinish } from "../src/rooms/reference/galleryFinish";

describe("reference gallery curation", () => {
  it("keeps input identity/order and aspect, with aligned wall mounts and a clear paging doorway", () => {
    const input = [
      { id: "hero", width: 1920, height: 1080 },
      { id: "portrait", width: 900, height: 1600 },
      { id: "wide", width: 2400, height: 1000 },
      { id: "square", width: 1200, height: 1200 },
      { id: "last", width: 1600, height: 1000 },
    ];
    const result = archiveLayout(input);
    expect(result.map(work => work.id)).toEqual(input.map(work => work.id));
    for (let i = 0; i < result.length; i++) {
      const work = result[i];
      expect(work.width / work.height).toBeCloseTo(input[i].width / input[i].height);
      expect(work.position[1] - work.height / 2).toBeGreaterThan(.8);
      expect(work.position[1]).toBe(result[0].position[1]);
      expect(work.width).toBeLessThanOrEqual(7.5);
      expect(work.height).toBeLessThanOrEqual(5.4);
      if (i === 0) expect(work.position[0] + work.width / 2).toBeLessThan(-2);
      else expect(Math.abs(work.position[0])).toBeGreaterThan(13);
    }
    for (const pair of [[1, 3], [2, 4]]) {
      const a = result[pair[0]], b = result[pair[1]];
      expect(Math.abs(a.position[2] - b.position[2]) - (a.width + b.width) / 2).toBeGreaterThan(1);
    }
    expect(input[0].width).toBe(1920);
  });
  it("bounds each page and handles unknown or invalid metadata without NaN geometry", () => {
    const works = Array.from({ length: 9 }, (_, i) => ({ id: String(i), width: i ? -1 : Infinity, height: i ? 0 : NaN }));
    expect(archiveLayout([])).toEqual([]);
    const result = archiveLayout(works);
    expect(result).toHaveLength(5);
    expect(result.every(work => [...work.position, ...work.rotation, work.width, work.height].every(Number.isFinite))).toBe(true);
  });
  it("owns only a finish clone and preserves the original floor material and texture", () => {
    const sourceTexture = new Texture(), wood = new Texture();
    const source = new MeshStandardMaterial({ color: "#778899", bumpMap: sourceTexture, roughness: .38 });
    const original = source.clone();
    const finish = createGalleryFinish(source, wood);
    expect(finish).not.toBe(source);
    expect(finish.map).toBe(wood);
    expect(finish.roughness).toBeGreaterThan(.65);
    expect(source.color).toEqual(original.color);
    expect(source.roughness).toBe(original.roughness);
    expect(source.map).toBe(null);
    expect(source.bumpMap).toBe(sourceTexture);
    let sourceDisposed = false, textureDisposed = false;
    source.addEventListener("dispose", () => { sourceDisposed = true; });
    wood.addEventListener("dispose", () => { textureDisposed = true; });
    finish.dispose();
    expect(sourceDisposed).toBe(false);
    expect(textureDisposed).toBe(false);
    source.dispose(); original.dispose(); sourceTexture.dispose(); wood.dispose();
  });
});
