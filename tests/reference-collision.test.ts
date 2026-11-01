import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import type { WallpaperItem } from "../src/content/types";
import { imageWallFootprints } from "../src/rooms/reference/imageWallFootprints";
import { imageLayout } from "../src/world/spatialLayout";
import { worksForRoom } from "../src/systems/mediaPlacement";
import { keepClear, tourWaypoint } from "../src/world/collision";

const images = Array.from({ length: 7 }, (_, i) => ({ id: `image-${i}`, title: `Image ${i}`, width: 1920, height: 1080, src: "fixture.webp", date: "2026", roomIds: ["wallpapers", "portraits", "editorial"], order: i } as WallpaperItem));
describe("wall mounted archive navigation", () => {
  it("can walk from the archive approach to the paging threshold without an obsolete central panel", () => {
    for (const room of ["wallpapers", "wallpapers-page-2"]) {
      const obstacles = imageWallFootprints(room, images);
      expect(obstacles).toEqual([]);
      const position = new Vector3(0, 1.65, -11), target = new Vector3(0, 1.65, -15.5), waypoint = new Vector3();
      for (let i = 0; i < 100; i++) {
        tourWaypoint(position, target, obstacles, waypoint);
        const step = waypoint.clone().sub(position).clampLength(0, .1);
        position.add(step); keepClear(position, room, obstacles);
      }
      expect(position.distanceTo(target)).toBeLessThan(.01);
      expect(position.x).toBe(0);
    }
  });
  it("preserves the original freestanding portrait and editorial walls including page selection", () => {
    for (const room of ["portraits", "portraits-page-2", "editorial", "editorial-page-2"]) {
      const base = room.split("-page-")[0], page = room.endsWith("-2") ? 1 : 0;
      const expected = imageLayout(worksForRoom(images, base).slice(page * 5, page * 5 + 5), true, base === "editorial").map(p => ({
        x: p.position[0], z: p.position[2] - .3,
        halfWidth: Math.abs(Math.cos(p.rotation[1])) * (p.width + .65) / 2 + .6,
        halfDepth: Math.abs(Math.sin(p.rotation[1])) * (p.width + .65) / 2 + .6,
      }));
      expect(expected.length).toBeGreaterThan(0);
      expect(imageWallFootprints(room, images)).toEqual(expected);
    }
    expect(imageWallFootprints("projects", images)).toEqual([]);
  });
});
