import { describe, expect, it } from "vitest";
import { RidePhysics, route, routePhase, stopDistances, shortestHeading } from "../src/worlds/cyclingRoute";
import { roadRibbon, groundHeight } from "../src/worlds/cyclingGeometry";

describe("comfortable route-following cycling", () => {
  it("keeps the continuous road front-facing and terrain below the rider's route", () => {
    const road = roadRibbon(4.7);
    const normals = road.getAttribute("normal");
    for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeGreaterThan(.87);
    for (let i = 0; i < 350; i++) {
      const p = route.getPointAt(i / 350);
      expect(groundHeight(p.x, p.z)).toBeLessThan(p.y - .12);
    }
    road.dispose();
  });
  it("accelerates, coasts, brakes and pauses without moving behind a menu", () => {
    const ride = new RidePhysics();
    for (let i = 0; i < 240; i++) ride.step(1 / 60, { pedal: true });
    expect(ride.speed).toBeGreaterThan(5); expect(ride.distance).toBeGreaterThan(8);
    const distance = ride.distance; ride.step(.06, { blocked: true });
    expect(ride.distance).toBe(distance);
    for (let i = 0; i < 120; i++) ride.step(1 / 60, { brake: true });
    expect(ride.speed).toBe(0);
    const stopped = ride.distance; ride.step(.06, { brake: true }); expect(ride.distance).toBe(stopped);
  });
  it("follows a continuous closed route with bounded grade and no endpoint jump", () => {
    expect(route.getPointAt(0).distanceTo(route.getPointAt(1))).toBeLessThan(.001);
    for (let i = 0; i < 200; i++) {
      const a = route.getPointAt(i / 200), b = route.getPointAt((i + 1) / 200);
      expect(a.distanceTo(b)).toBeLessThan(5);
      expect(Math.abs(route.getTangentAt(i / 200).y)).toBeLessThan(.45);
    }
  });
  it("brakes at the requested real viewpoint and does not teleport to it", () => {
    const ride = new RidePhysics(); ride.speed = 7; ride.distance = stopDistances[0] - 20;
    ride.stopAt = stopDistances[0];
    const before = ride.distance;
    ride.step(.016, { cruise: true }); expect(ride.distance - before).toBeLessThan(.2);
    for (let i = 0; i < 600; i++) ride.step(1 / 60, { cruise: true });
    expect(ride.speed).toBe(0); expect(Math.abs(ride.distance - stopDistances[0])).toBeLessThan(1.5);
  });
  it("bounds background-tab time, wraps continuously and reports spatial phases", () => {
    const ride = new RidePhysics(); ride.speed = 7; ride.distance = route.getLength() - .1;
    ride.step(60, { cruise: true });
    expect(ride.distance).toBeGreaterThan(0); expect(ride.distance).toBeLessThan(1);
    expect(routePhase(0)).toBe("FOREST ENTRY"); expect(routePhase(.3)).toBe("LAKE OPENING");
    expect(shortestHeading(3.13, -3.13) - 3.13).toBeLessThan(.05);
  });
});
