import { describe, expect, it } from "vitest";
import { referenceRoomLighting } from "../src/rooms/reference/referenceLighting";

describe("room-scoped architectural light", () => {
  it("leaves every unrelated room and existing media-page theme alone", () => {
    for (const room of ["glass-life", "private-gym", "basketball", "cycling", "alpine-ride", "corridor", "projects-page-2", "research-page-2", "wallpapers-page-2", "unknown"]) {
      expect(referenceRoomLighting(room)).toBeUndefined();
    }
  });
  it("keeps five curated rooms neutral, finite and inside the original radiance budget", () => {
    for (const room of ["atrium", "projects", "research", "music", "wallpapers"]) {
      const theme = referenceRoomLighting(room)!;
      expect(theme).toBeDefined();
      for (const value of [theme.keyIntensity, theme.environment, theme.hemisphere]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      expect(theme.environment).toBeLessThanOrEqual(.64);
      expect(theme.hemisphere).toBeLessThanOrEqual(.65);
      expect(theme.keyIntensity).toBeLessThanOrEqual(2.4);
      expect(theme.sky).toMatch(/^#[a-f0-9]{6}$/);
    }
  });
});
