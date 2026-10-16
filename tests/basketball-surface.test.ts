import { describe, expect, it, vi } from "vitest";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import { basketballSurfaceSample, createBasketballSurface, makeBasketballTexels } from "../src/worlds/court/basketballSurface";
import { HOOPS } from "../src/worlds/basketballPhysics";
import { makeHoopHardwareGeometry, makeHoopNetGeometry } from "../src/worlds/CourtArchitecture";

describe("original basketball leather maps", () => {
  it("has identical wrap texels and stable pole values rather than a latitude seam", () => {
    const texels = makeBasketballTexels(128, 64);
    for (const map of [texels.color, texels.height, texels.roughness]) for (let y = 0; y < 64; y++) {
      const row = y * 128 * 4;
      expect(Array.from(map.slice(row, row + 4))).toEqual(Array.from(map.slice(row + 127 * 4, row + 128 * 4)));
    }
    for (const v of [0, 1]) for (const u of [.13, .48, .93]) {
      expect(basketballSurfaceSample(u, v)).toEqual(basketballSurfaceSample(0, v));
    }
    for (const v of [.12, .37, .58, .82]) expect(basketballSurfaceSample(0, v)).toEqual(basketballSurfaceSample(1, v));
  });
  it("recesses dark rubber channels into the leather and keeps grain outside them", () => {
    const seam = basketballSurfaceSample(.11, .5);
    const panelA = basketballSurfaceSample(.14, .31), panelB = basketballSurfaceSample(.144, .312);
    expect(seam.channel).toBeCloseTo(1); expect(panelA.channel).toBe(0);
    expect(seam.height).toBeLessThan(panelA.height - .25);
    expect(seam.color[0]).toBeLessThan(panelA.color[0] / 3);
    expect(Math.abs(panelA.height - panelB.height)).toBeGreaterThan(.01);
    expect(panelA.roughness).toBeGreaterThan(.7); expect(panelA.roughness).toBeLessThan(.96);
  });
  it("stores independent linear height and roughness information, deterministic and bounded", () => {
    const first = makeBasketballTexels(64, 32), second = makeBasketballTexels(64, 32);
    expect(first).toEqual(second); expect(first.height).not.toEqual(first.color); expect(first.roughness).not.toEqual(first.height);
    for (let i = 0; i < first.height.length; i += 4) {
      expect(first.height[i]).toBe(first.height[i + 1]); expect(first.height[i]).toBe(first.height[i + 2]);
      expect(first.roughness[i]).toBe(first.roughness[i + 1]); expect(first.roughness[i]).toBe(first.roughness[i + 2]);
      expect(first.height[i + 3]).toBe(255); expect(first.color[i + 3]).toBe(255);
    }
    expect(() => makeBasketballTexels(0, 16)).toThrow(RangeError);
    expect(() => makeBasketballTexels(2049, 16)).toThrow(RangeError);
  });
  it("owns only generated textures and disposes exactly once across replayed lifecycles", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    try {
      const first = createBasketballSurface(64, 32), next = createBasketballSurface(64, 32);
      const events = first.maps.map(map => { const disposed = vi.fn(); map.addEventListener("dispose", disposed); return disposed; });
      first.dispose(); first.dispose();
      expect(events.every(disposed => disposed.mock.calls.length === 1)).toBe(true);
      expect(next.maps.every(map => map.version === 1)).toBe(true);
      expect(first.color.colorSpace).toBe(SRGBColorSpace);
      expect(first.height.colorSpace).toBe(NoColorSpace); expect(first.roughness.colorSpace).toBe(NoColorSpace);
      expect(next.maps.every(map => map.wrapS === RepeatWrapping && map.image.data instanceof Uint8Array)).toBe(true);
      expect(fetch).not.toHaveBeenCalled(); next.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
  it("does not redefine ball or hoop physics", () => {
    expect(HOOPS).toEqual([{ x: 0, y: 3.05, z: -12.1 }, { x: 0, y: 3.05, z: 12.1 }]);
  });
  it("merges connected net knots and mirrored hardware without expanding the rim", () => {
    const net = makeHoopNetGeometry(), left = makeHoopHardwareGeometry(-1), right = makeHoopHardwareGeometry(1);
    try {
      net.computeBoundingBox(); left.computeBoundingBox(); right.computeBoundingBox();
      expect(net.boundingBox!.min.y).toBeGreaterThan(-.420); expect(net.boundingBox!.max.y).toBeLessThan(.004);
      for (const geometry of [net, left, right]) {
        const points = geometry.getAttribute("position");
        for (let i = 0; i < points.count; i++) expect([points.getX(i), points.getY(i), points.getZ(i)].every(Number.isFinite)).toBe(true);
        expect(geometry.index!.count / 3).toBeLessThan(6500);
        expect(geometry.groups).toHaveLength(0);
      }
      expect(left.boundingBox!.min.z).toBeCloseTo(-right.boundingBox!.max.z);
      expect(left.boundingBox!.max.z).toBeCloseTo(-right.boundingBox!.min.z);
    } finally { net.dispose(); left.dispose(); right.dispose(); }
  });
});
