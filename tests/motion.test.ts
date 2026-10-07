import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { measuredEnergy, motionTime, revealProgress, settleMotion } from "../src/motion/tokens";

describe("additive motion envelopes", () => {
  it("keeps silence at zero and only maps measured input", () => {
    expect(measuredEnergy(0)).toBe(0);
    expect(measuredEnergy(1)).toBe(1);
    expect(measuredEnergy(NaN)).toBe(0);
    expect(measuredEnergy(-1)).toBe(0);
    expect(measuredEnergy(5)).toBe(1);
    for (let i = 1; i < 100; i++) expect(measuredEnergy(i / 100)).toBeGreaterThan(measuredEnergy((i - 1) / 100));
  });
  it("has equivalent envelopes at 60 and 144 FPS", () => {
    const sample = (fps: number) => {
      let x = 0;
      for (let i = 0; i < fps; i++) x = settleMotion(x, 0.7, 1 / fps);
      return x;
    };
    expect(sample(60)).toBeCloseTo(sample(144), 12);
  });
  it("attacks sooner than it releases without overshoot", () => {
    expect(settleMotion(0, 1, 0.1)).toBeGreaterThan(1 - settleMotion(1, 0, 0.1));
    let x = 1;
    for (let i = 0; i < 180; i++) { x = settleMotion(x, 0, 1 / 60); expect(x).toBeGreaterThanOrEqual(0); }
    expect(x).toBeLessThan(0.003);
  });
  it("does not jump after a hidden tab or invalid frame interval", () => {
    expect(settleMotion(0, 1, 10)).toBe(settleMotion(0, 1, 0.1));
    expect(settleMotion(0.4, 1, NaN)).toBe(0.4);
    expect(settleMotion(0.4, 1, -1)).toBe(0.4);
  });
  it("finishes at the original resting value, even on rapid completion", () => {
    expect(revealProgress(-1, 0.36)).toBe(0);
    expect(revealProgress(0.36, 0.36)).toBe(1);
    expect(revealProgress(10, 0.36)).toBe(1);
    expect(revealProgress(0.18, 0.36)).toBeGreaterThan(0.5);
  });
  it("keeps compositor and scene timing tokens consistent", () => {
    const css = readFileSync("src/ui/motion.css", "utf8");
    for (const [key, value] of Object.entries(motionTime)) expect(css).toContain("--motion-" + key + ": " + value + "ms");
  });
});
