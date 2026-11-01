import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { keepClear, roomFootprints } from "../src/world/collision";
import { studyDesk, studyChairs, studyFurnitureFootprints } from "../src/rooms/reference/studyPlan";

describe("reading furniture and shared movement bounds", () => {
  it("uses human desk scale and includes clearance for the real tabletop and both chairs", () => {
    expect(studyDesk.height).toBeGreaterThan(.7);
    expect(studyDesk.height).toBeLessThan(.85);
    const furniture = studyFurnitureFootprints();
    expect(furniture).toHaveLength(4);
    expect(furniture[0].halfWidth).toBeGreaterThan(studyDesk.width / 2);
    expect(furniture[0].halfDepth).toBeGreaterThan(studyDesk.depth / 2);
    for (const chair of studyChairs) expect(furniture.some(bounds => bounds.x === chair.x && bounds.z === chair.z)).toBe(true);
    expect(roomFootprints("research")).toEqual([{ x: -3.4, z: -4, halfWidth: 3.8, halfDepth: 3.8 }, ...furniture]);
  });
  it("keeps native movement outside each new solid object while leaving the existing route and pages clear", () => {
    for (const bounds of studyFurnitureFootprints()) {
      const eye = new Vector3(bounds.x, 1.65, bounds.z);
      keepClear(eye, "research");
      expect(Math.abs(eye.x - bounds.x) >= bounds.halfWidth - 1e-6 || Math.abs(eye.z - bounds.z) >= bounds.halfDepth - 1e-6).toBe(true);
    }
    for (const z of [13, 8, 4, 0, -5, -12, -15]) {
      const eye = new Vector3(1.2, 1.65, z); keepClear(eye, "research");
      expect(eye.toArray()).toEqual([1.2, 1.65, z]);
    }
    expect(roomFootprints("research-page-2")).toEqual([]);
    expect(roomFootprints("music")).toHaveLength(2);
  });
});
