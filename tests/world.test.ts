import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { allContent, rooms } from "../src/content/catalog";
import {
  corridorSeed,
  residentChunks,
  resolveRoomPlan,
} from "../src/world/roomPlan";
import {
  keepClear,
  roomBounds,
  roomFootprints,
  tourWaypoint,
} from "../src/world/collision";

describe("content-driven architecture and bounded streaming", () => {
  it("keeps the observatory deck edge closed and the viewing bridge continuous", () => {
    for (const room of ["cosmic", "imagined-worlds", "cosmic-page-2"]) {
      const center = new Vector3(0, 1.65, -23);
      keepClear(center, room);
      expect(center.z).toBe(-23);
      const edge = new Vector3(9, 1.65, -16.7);
      keepClear(edge, room);
      expect(edge.z).toBe(-16.5);
      const rail = new Vector3(3.8, 1.65, -23);
      keepClear(rail, room);
      expect(rail.x).toBeCloseTo(3.7);
      expect(rail.z).toBe(-23);
    }
  });
  it("keeps five resident segments across negative addresses and long-distance exploration", () => {
    expect(residentChunks(14)).toEqual([-2, -1, 0, 1, 2]);
    expect(residentChunks(-0.1)).toEqual([-3, -2, -1, 0, 1]);
    expect(residentChunks(-22000)).toEqual([-1002, -1001, -1000, -999, -998]);
    const before = [-1000, -11, -1, 0, 1, 14, 1000].map(corridorSeed);
    residentChunks(1000000);
    expect([-1000, -11, -1, 0, 1, 14, 1000].map(corridorSeed)).toEqual(before);
    expect(new Set(before).size).toBe(before.length);
  });
  it("uses content room type, special rule and stable work ID for individual rooms", () => {
    for (const item of allContent) {
      expect(resolveRoomPlan(`exhibit-${item.id}`)).toMatchObject({
        id: `exhibit-${item.id}`,
        item,
        type: item.roomType,
        rule: item.roomRule,
        title: item.title,
      });
    }
  });
  it("accepts a configured room without an architectural component or hardcoded switch", () => {
    const room = {
      id: "film-collection",
      number: "10",
      title: "FILM COLLECTION",
      subtitle: "A new collection.",
      type: "black-box" as const,
    };
    rooms.push(room);
    try {
      expect(resolveRoomPlan(room.id)).toMatchObject({
        ...room,
        dark: true,
        definition: room,
      });
    } finally {
      rooms.pop();
    }
  });
});

describe("accessible movement around architecture", () => {
  it("uses the rule of a configured room for bounds, including a work-specific impossible room", () => {
    const impossible = allContent.find(
      (item) => item.roomRule === "impossible",
    )!;
    expect(roomBounds(`exhibit-${impossible.id}`)).toEqual(
      roomBounds("anomaly-impossible"),
    );
    expect(roomBounds("anomaly-floating")).toEqual([-1.3, 1.3, -15.6, 15.6]);
  });
  it("keeps the eye out of furniture and preserves a usable door opening", () => {
    const fromBench = new Vector3(0, 3, -5);
    keepClear(fromBench, "music");
    expect(Math.abs(fromBench.z + 5)).toBeCloseTo(1.95, 6);
    expect(fromBench.y).toBe(1.65);
    const opening = new Vector3(0, 1.65, 11);
    keepClear(opening, "anomaly-impossible");
    expect(opening).toEqual(new Vector3(0, 1.65, 11));
    const wall = new Vector3(8, 1.65, 11);
    keepClear(wall, "anomaly-impossible");
    expect(Math.abs(wall.z - 11)).toBeCloseTo(0.68, 6);
  });
  it("keeps the tapered room walkable and the eye inside its narrowing walls", () => {
    for (const z of [14, 10, 4, -2, -8, -14, -15.6]) {
      for (const x of [-12, 12]) {
        const position = new Vector3(x, 1.65, z);
        keepClear(position, "anomaly-compressing");
        expect(Math.abs(position.x)).toBeLessThanOrEqual(9.45);
        const taper = Math.max(0, Math.min(1, (10 - z) / 24));
        expect(Math.abs(position.x)).toBeLessThanOrEqual(9.45 - taper * 7.3);
        expect(position.y).toBe(1.65);
      }
      const center = new Vector3(0, 1.65, z);
      keepClear(center, "anomaly-compressing");
      expect(center.z).toBe(z);
    }
  });
  it("leads touch exploration around the core to a destination behind it", () => {
    const position = new Vector3(0, 1.65, 10);
    const destination = new Vector3(0, 1.65, -10);
    const waypoint = new Vector3();
    const obstacles = roomFootprints("atrium");
    for (
      let i = 0;
      i < 1500 && position.distanceToSquared(destination) > 0.08;
      i++
    ) {
      tourWaypoint(position, destination, obstacles, waypoint);
      const direction = waypoint.sub(position).setY(0);
      position.addScaledVector(direction.normalize(), 0.04);
      keepClear(position, "atrium", obstacles);
      expect(Math.hypot(position.x, position.z)).toBeGreaterThanOrEqual(3.799);
    }
    expect(position.distanceTo(destination)).toBeLessThan(0.3);
  });
});
