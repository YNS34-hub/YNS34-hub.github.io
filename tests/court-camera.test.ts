import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { limitCourtBoom } from "../src/worlds/presence/courtBoom";

describe("court follow-camera clearance", () => {
  for (const side of [-1, 1]) it(`keeps the ${side} backboard out of the player-to-camera segment`, () => {
    const eye = new Vector3(0, 1.65, side * 8), camera = new Vector3(0, 4.05, side * 13.6), originalEye = eye.clone();
    expect(limitCourtBoom(eye, camera)).toBe(true);
    expect(camera.z * side).toBeLessThan(12.5);
    expect(camera.y).toBeGreaterThan(eye.y);
    expect(eye.equals(originalEye)).toBe(true);
    expect(limitCourtBoom(eye, camera)).toBe(false);
  });
  it("constrains the smoothed camera even after the player has moved", () => {
    const eye = new Vector3(0, 1.65, 8.4), previous = new Vector3(0, 4.05, 14), target = new Vector3(0, 4.05, 14);
    limitCourtBoom(eye, target); previous.lerp(target, .16);
    expect(limitCourtBoom(eye, previous)).toBe(true); expect(previous.z).toBeLessThan(12.5);
  });
  it("preserves unobstructed side views and the first-person eye", () => {
    const eye = new Vector3(2, 1.65, 8), camera = new Vector3(2, 4.05, 13.6), saved = camera.clone();
    expect(limitCourtBoom(eye, camera)).toBe(false); expect(camera.equals(saved)).toBe(true);
    camera.copy(eye); expect(limitCourtBoom(eye, camera)).toBe(false); expect(camera.equals(eye)).toBe(true);
  });
  it("clears the support beam without producing a non-finite pose at a parallel segment", () => {
    const eye = new Vector3(0, 1.65, 12.8), camera = new Vector3(0, 3.2, 17);
    expect(limitCourtBoom(eye, camera)).toBe(true); expect(camera.z).toBeLessThan(15.04);
    expect(camera.toArray().every(Number.isFinite)).toBe(true);
  });
});
