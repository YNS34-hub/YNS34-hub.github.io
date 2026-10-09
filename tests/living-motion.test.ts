import { describe, expect, it } from "vitest";
import { boundedProgress, dribblePresentation, imageTransition, nearbyRank, impactStrength } from "../src/motion/choreography";

describe("living-world presentation boundaries", () => {
  it("keeps contact feedback bounded and proportional to actual impact speed", () => {
    expect(impactStrength(0)).toBe(0);
    expect(impactStrength(2)).toBeLessThan(impactStrength(8));
    expect(impactStrength(-8)).toBe(impactStrength(8));
    expect(impactStrength(200)).toBe(1);
    expect(impactStrength(NaN)).toBe(0);
  });
  it("never exposes progress outside its track or divides by missing duration", () => {
    expect(boundedProgress(30, 60)).toBe(.5);
    expect(boundedProgress(80, 60)).toBe(1);
    expect(boundedProgress(-2, 60)).toBe(0);
    expect(boundedProgress(4, 0)).toBe(0);
    expect(boundedProgress(NaN, 60)).toBe(0);
  });
  it("prioritizes deliberate forward proximity without selecting hidden-side works", () => {
    expect(nearbyRank(2, -1, 10)).toBe(Infinity);
    expect(nearbyRank(10, 1, 10)).toBe(Infinity);
    expect(nearbyRank(3, .99, 10)).toBeLessThan(nearbyRank(3, .7, 10));
    expect(nearbyRank(NaN, 1, 10)).toBe(Infinity);
  });
  it("chooses honest two-dimensional image transitions", () => {
    const portrait = { width: 100, height: 150, category: "portrait" };
    expect(imageTransition(undefined, portrait)).toBe("room-tone");
    expect(imageTransition(portrait, { ...portrait })).toBe("related");
    expect(imageTransition(portrait, { ...portrait, category: "editorial" })).toBe("portrait");
    expect(imageTransition(portrait, { width: 200, height: 100 })).toBe("room-tone");
    expect(imageTransition({ width: 200, height: 100 }, { width: 150, height: 100 })).toBe("landscape");
  });
  it("settles the ball at its original size and respects comfort", () => {
    expect(dribblePresentation(.5)).toEqual({ y: 1, xz: 1 });
    expect(dribblePresentation(0).y).toBeCloseTo(.955);
    expect(dribblePresentation(1)).toEqual(dribblePresentation(0));
    expect(dribblePresentation(0, true)).toEqual({ y: 1, xz: 1 });
  });
});
