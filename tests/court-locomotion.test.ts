import { describe, expect, it } from 'vitest';
import { createCourtLocomotion, dribbleLegWindow, sampleCourtLocomotion } from '../src/worlds/presence/courtLocomotion';

const point = (x = 0, y = .112, z = 0) => ({ x, y, z });
const distance = (a: ReturnType<typeof point>, b: ReturnType<typeof point>) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (p: ReturnType<typeof point>) => [p.x, p.y, p.z].every(Number.isFinite);

describe('between-legs ball clearance window', () => {
  it('opens before the ball crosses the legs and closes at the next catch', () => {
    expect(dribbleLegWindow(0)).toBe(0);
    expect(dribbleLegWindow(1)).toBe(0);
    for (const phase of [.26, .44, .66]) expect(dribbleLegWindow(phase)).toBe(1);
    expect(dribbleLegWindow(.13)).toBeCloseTo(.5);
    expect(dribbleLegWindow(.83)).toBeCloseTo(.5);
  });

  it('uses a smooth, bounded opening and closing rather than a leg pose switch', () => {
    const delta = .00001;
    for (let phase = delta; phase < 1 - delta; phase += .001) {
      const value = dribbleLegWindow(phase), derivative = (dribbleLegWindow(phase + delta) - dribbleLegWindow(phase - delta)) / (2 * delta);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(Math.abs(derivative)).toBeLessThan(6);
    }
    for (const phase of [0, .26, .66, 1]) expect(Math.abs((dribbleLegWindow(phase + delta) - dribbleLegWindow(phase - delta)) / (2 * delta))).toBeLessThan(.001);
  });

  it('clamps out-of-cycle values and damaged phase values to a safe closed gap', () => {
    for (const phase of [-1, 2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(dribbleLegWindow(phase)).toBe(0);
  });
});

describe('court ankle clip continuity', () => {
  it('seeds the actual previous ankle rather than replacing it with the new clip target', () => {
    const previous = point(-.11, .16, -.21), state = createCourtLocomotion(previous);
    expect(state).toMatchObject(previous);
    expect(state.initialized).toBe(true);
    const next = sampleCourtLocomotion(state, point(-.1875, .16, -.21), .009);
    expect(next).toBe(state);
    expect(distance(next, previous)).toBeGreaterThan(0);
    expect(distance(next, previous)).toBeLessThanOrEqual(4.5 * .009 + 1e-12);
    expect(distance(next, point(-.1875, .16, -.21))).toBeGreaterThan(.025);
  });

  it('bounds the full three-dimensional articulation speed across abrupt clip changes', () => {
    const state = createCourtLocomotion(point());
    for (const dt of [.001, .009, 1 / 120, 1 / 60, 1 / 30, .05]) {
      const before = { ...state };
      sampleCourtLocomotion(state, point(12, 4, -15), dt);
      expect(distance(state, before)).toBeLessThanOrEqual(4.5 * dt + 1e-12);
      expect(finite(state)).toBe(true);
    }
  });

  it('preserves the same exponential response under different frame rates', () => {
    const target = point(.025, .15, -.025);
    const results = [30, 60, 120, 240].map(fps => {
      const state = createCourtLocomotion(point());
      for (let i = 0; i < fps / 2; i++) sampleCourtLocomotion(state, target, 1 / fps);
      return state;
    });
    for (const state of results) expect(distance(state, results[0])).toBeLessThan(1e-12);
  });

  it('converges to a stationary ankle rather than freezing it or keeping an offset', () => {
    const target = point(.32, .19, -.4), state = createCourtLocomotion(point());
    for (let i = 0; i < 240; i++) sampleCourtLocomotion(state, target, 1 / 120);
    expect(distance(state, target)).toBeLessThan(1e-10);
  });

  it('keeps left and right trajectories exactly mirrored', () => {
    const left = createCourtLocomotion(point(-.15)), right = createCourtLocomotion(point(.15));
    for (let i = 0; i < 200; i++) {
      const x = .15 + .2 * Math.sin(i * .08), y = .112 + Math.max(0, .18 * Math.sin(i * .08)), z = .32 * Math.cos(i * .08);
      sampleCourtLocomotion(left, point(-x, y, z), 1 / 120);
      sampleCourtLocomotion(right, point(x, y, z), 1 / 120);
      expect(left.x).toBeCloseTo(-right.x, 12);
      expect(left.y).toBeCloseTo(right.y, 12);
      expect(left.z).toBeCloseTo(right.z, 12);
    }
  });

  it('keeps actor translation out of the filtered ankle articulation', () => {
    const stationary = createCourtLocomotion(point(.12)), moving = createCourtLocomotion(point(.12));
    for (let i = 0; i < 120; i++) {
      const root = { x: i * .052, z: -i * .026 }, desired = point(.12, .112 + Math.abs(Math.sin(i * .1)) * .16, Math.cos(i * .1) * .2);
      const worldAnkle = point(root.x + desired.x, desired.y, root.z + desired.z);
      sampleCourtLocomotion(stationary, desired, 1 / 120);
      sampleCourtLocomotion(moving, point(worldAnkle.x - root.x, worldAnkle.y, worldAnkle.z - root.z), 1 / 120);
      expect(distance(moving, stationary)).toBeLessThan(1e-12);
    }
  });

  it('does not allocate a new output or mutate the requested ankle', () => {
    const desired = Object.freeze(point(.16, .2, -.14)), state = createCourtLocomotion(point());
    for (let i = 0; i < 120; i++) expect(sampleCourtLocomotion(state, desired, 1 / 120)).toBe(state);
    expect(desired).toEqual(point(.16, .2, -.14));
  });

  it('can seed a newly activated filter through an explicit reset', () => {
    const state = createCourtLocomotion(point(.3, .2, -.4)), actual = point(-.14, .155, .12);
    expect(sampleCourtLocomotion(state, actual, 0, true)).toBe(state);
    expect(state).toMatchObject(actual);
  });

  it('initializes an unseeded filter from the first actual ankle sample', () => {
    const state = createCourtLocomotion(), actual = point(.13, .17, -.18);
    expect(state.initialized).toBe(false);
    sampleCourtLocomotion(state, actual, 1 / 120);
    expect(state).toMatchObject(actual);
    expect(state.initialized).toBe(true);
  });
});

describe('court ankle input and ground boundaries', () => {
  for (const dt of [0, -.1, Number.NaN, Number.POSITIVE_INFINITY]) it(`keeps the ankle paused for invalid or non-positive dt ${dt}`, () => {
    const state = createCourtLocomotion(point(.13, .2, -.15)), before = { ...state };
    sampleCourtLocomotion(state, point(-.6, .6, .8), dt);
    expect(state).toEqual(before);
  });

  it('caps a resumed long frame so it does not jump across the whole gait', () => {
    const state = createCourtLocomotion(point()), before = { ...state };
    sampleCourtLocomotion(state, point(1, .6, -1), 10);
    expect(distance(state, before)).toBeLessThanOrEqual(4.5 * .05 + 1e-12);
  });

  it('clamps the ankle above the court while keeping the horizontal trajectory moving', () => {
    const floor = .35, state = createCourtLocomotion(point(.12, floor + .112, 0), floor);
    for (let i = 0; i < 100; i++) {
      sampleCourtLocomotion(state, point(-.12, -1, -.2), 1 / 120, false, floor);
      expect(state.y).toBeGreaterThanOrEqual(floor + .112);
    }
    expect(state.x).toBeCloseTo(-.12, 6);
    expect(state.z).toBeCloseTo(-.2, 6);
  });

  it('uses the court floor when seed height or floor height is damaged', () => {
    expect(createCourtLocomotion(point(Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY), Number.NaN)).toMatchObject(point());
    expect(createCourtLocomotion(point(.1, -5, -.1), .3).y).toBeCloseTo(.412, 12);
  });

  for (const desired of [null, undefined]) it(`holds the previous foot for missing desired value ${desired}`, () => {
    const state = createCourtLocomotion(point(.1, .2, -.1)), before = { ...state };
    sampleCourtLocomotion(state, desired, 1 / 60);
    expect(state).toEqual(before);
  });

  it('ignores each damaged requested component without poisoning the other axes', () => {
    const state = createCourtLocomotion(point(.1, .2, -.1));
    sampleCourtLocomotion(state, point(Number.NaN, Number.POSITIVE_INFINITY, -.2), 1 / 60);
    expect(finite(state)).toBe(true);
    expect(state.x).toBe(.1);
    expect(state.y).toBe(.2);
    expect(state.z).toBeLessThan(-.1);
  });

  it('repairs a damaged stored coordinate before computing a new step', () => {
    const state = createCourtLocomotion(point(.1, .2, -.1));
    state.x = Number.NaN; state.y = Number.NEGATIVE_INFINITY; state.z = Number.POSITIVE_INFINITY;
    sampleCourtLocomotion(state, point(.12, .15, -.2), 1 / 120);
    expect(finite(state)).toBe(true);
    expect(state.y).toBeGreaterThanOrEqual(.112);
  });
});
