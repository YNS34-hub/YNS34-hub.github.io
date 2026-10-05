import { describe, it, expect } from "vitest";
import { pictureFit } from "../src/world/pictureFit";
import {
  corridorProfile,
  corridorClearWidth,
  imageLayout,
  orderedWorks,
} from "../src/world/spatialLayout";
import { bandEnergy } from "../src/audio/signal";
import {
  normalizeVisual,
  worksForRoom,
  selectPrimary,
} from "../src/systems/mediaPlacement";
describe("image geometry and focus crop", () => {
  it("contains a portrait without altering its ratio", () => {
    const x = pictureFit(2 / 3, 12, 7, "contain");
    expect(x.width / x.height).toBeCloseTo(2 / 3);
    expect(x.height).toBe(7);
    expect(x.uv).toEqual([0, 0, 1, 1]);
  });
  it("crops a wide image in UV space and clamps the subject focus", () => {
    const x = pictureFit(2, 4, 4, "cover", [0.9, 0.5]);
    expect(x.uv).toEqual([0.5, 0, 1, 1]);
    expect(x.width / x.height).toBe(1);
    const y = pictureFit(0.5, 4, 4, "cover", [0.5, 0]);
    expect(y.uv).toEqual([0, 0.5, 1, 1]);
  });
});
describe("bounded corridor with genuine cross-section changes", () => {
  it("returns the same profile at the same address", () => {
    expect(corridorProfile(-3)).toEqual(corridorProfile(-3));
    expect(
      new Set(
        Array.from({ length: 6 }, (_, i) => corridorProfile(-i).halfWidth),
      ).size,
    ).toBeGreaterThan(3);
  });
  it("preserves a continuous, usable throat at every segment boundary", () => {
    for (let c = -20; c < 20; c++) {
      expect(corridorClearWidth(c * 22)).toBe(2.65);
      expect(
        Math.abs(
          corridorClearWidth(c * 22 + 0.001) -
            corridorClearWidth(c * 22 - 0.001),
        ),
      ).toBeLessThan(0.003);
    }
  });
  it("reflects primary, order and removed state in spatial placement", () => {
    expect(
      orderedWorks([
        { id: "a", order: 0 },
        { id: "b", order: 5, primary: true },
        { id: "c", removed: true },
      ]).map((x) => x.id),
    ).toEqual(["b", "a"]);
    const w = { id: "portrait", width: 1000, height: 1600 } as Parameters<
      typeof imageLayout
    >[0][number];
    const p = imageLayout([w], true)[0];
    expect(p.width / p.height).toBe(0.625);
    expect(p.position[1] - p.height / 2).toBeCloseTo(0.9);
  });
});
it("audio frequency bands are derived from the measured bins, including silence", () => {
  expect(bandEnergy(new Uint8Array(512), 48000, 1024, 30, 250)).toBe(0);
  const data = new Uint8Array(512);
  data[3] = 255;
  expect(bandEnergy(data, 48000, 1024, 30, 250)).toBeGreaterThan(0);
  expect(bandEnergy(data, 48000, 1024, 4000, 12000)).toBe(0);
});
describe("backward compatible resource placement", () => {
  it("replaces only the primary reference in its destination, retaining other rooms and IDs", () => {
    const items = [
      { id: "old", src: "a", primary: true, roomIds: ["portraits"] },
      { id: "other", src: "b", primary: true, roomIds: ["glass-life"] },
    ].map((x) =>
      normalizeVisual({ ...x, mediaKind: "visual" } as Parameters<
        typeof normalizeVisual
      >[0]),
    );
    const selected = normalizeVisual({
      id: "new",
      src: "c",
      mediaKind: "visual",
      primary: true,
      roomIds: ["portraits"],
    } as Parameters<typeof normalizeVisual>[0]);
    const result = selectPrimary([...items, selected], selected);
    expect(result.map((x) => [x.id, x.primary])).toEqual([
      ["old", false],
      ["other", true],
      ["new", true],
    ]);
    expect(result[0].src).toBe("a");
  });
  it("retains v1 IDs, favorites and original provenance while assigning a default shelf", () => {
    const old = {
      id: "local-v1",
      src: "blob:original",
      title: "Kept work",
      favorite: true,
      source: "Local file",
      category: "Private collection",
    } as Parameters<typeof normalizeVisual>[0];
    const migrated = normalizeVisual(old);
    expect(migrated).toMatchObject({
      ...old,
      mediaKind: "wallpaper",
      order: 0,
    });
    expect(worksForRoom([migrated], "wallpapers")).toHaveLength(1);
    expect(worksForRoom([migrated], "portraits")).toHaveLength(0);
  });
  it("moves a reference into its explicitly assigned gallery without copying or changing authorship", () => {
    const work = normalizeVisual({
      id: "stable",
      src: "blob:original",
      title: "Portrait",
      source: "User-selected visual reference",
      mediaKind: "visual",
      category: "portrait",
      roomIds: ["portraits", "bad-address"],
      primary: true,
    } as Parameters<typeof normalizeVisual>[0]);
    expect(work.roomIds).toEqual(["portraits"]);
    expect(worksForRoom([work], "portraits-page-2")).toHaveLength(1);
    expect(worksForRoom([work], "wallpapers")).toHaveLength(0);
    expect(work.source).toBe("User-selected visual reference");
  });
});
