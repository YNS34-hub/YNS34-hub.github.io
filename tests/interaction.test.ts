import { describe, expect, it } from "vitest";
import { attentionSample, advanceDwell } from "../src/interaction/attention";

describe("visitor-driven attention", () => {
  it("separates proximity from gaze and never focuses a work behind the visitor", () => {
    expect(attentionSample(3, -1, 8)).toEqual({ proximity: 0.625, gaze: false });
    expect(attentionSample(20, 1, 8)).toEqual({ proximity: 0, gaze: false });
    expect(attentionSample(3, 0.99, 8).gaze).toBe(true);
  });
  it("requires continuous dwell and cancels immediately on a different work or blocked input", () => {
    let state = { id: "", seconds: 0 };
    for (let i = 0; i < 5; i++) state = advanceDwell(state, "a", 0.1);
    expect(state.seconds).toBeCloseTo(0.5);
    expect(advanceDwell(state, "b", 0.1).seconds).toBeCloseTo(0.1);
    expect(advanceDwell(state, "", 0.1)).toEqual({ id: "", seconds: 0 });
  });
  it("bounds suspended-tab time so a single long frame cannot trigger gaze", () => {
    expect(advanceDwell({ id: "", seconds: 0 }, "a", 20).seconds).toBe(0.12);
    expect(attentionSample(NaN, 1, 8)).toEqual({ proximity: 0, gaze: false });
  });
});
