import { describe, expect, it } from 'vitest';
import { motionPacks } from '../src/worlds/court/motionPacks';
import { prepareShot, shotRecovery } from '../src/worlds/presence/shotPose';
import { createBasketballFootwork, sampleShotFootwork, type ShotFootworkInput } from '../src/worlds/presence/basketballFootwork';

const ids = ['quick', 'classic', 'high-release'] as const;
const floor = .095;
const base: ShotFootworkInput = {
  charge: 0, shotRemaining: 0, releaseCharge: .64, released: false, jump: 0,
  hand: 1, pack: motionPacks.shot.classic, yaw: 0,
  origin: { x: 0, y: 1.65, z: 0 }, position: { x: 0, y: 1.65, z: 0 },
  leftSeed: { x: -.13, y: floor, z: .025 }, rightSeed: { x: .13, y: floor, z: -.025 },
};
const copy = (input: ShotFootworkInput) => ({ ...input, origin: { ...input.origin }, position: { ...input.position }, leftSeed: { ...input.leftSeed }, rightSeed: { ...input.rightSeed } });
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const times = (input: ShotFootworkInput) => {
  const launch = Math.sqrt(2 * 9.81 * input.pack.jump);
  const takeoff = .64 * input.pack.chargeDuration - launch / 9.81;
  return { takeoff, landing: takeoff + 2 * launch / 9.81, launch };
};
function atTime(input: ShotFootworkInput, elapsed: number, release = false) {
  const { takeoff, landing, launch } = times(input);
  const airTime = Math.max(0, elapsed - takeoff);
  const jump = elapsed < takeoff || elapsed >= landing ? 0 : launch * airTime - 4.905 * airTime * airTime;
  return sampleShotFootwork(createBasketballFootwork(), { ...input, charge: elapsed / input.pack.chargeDuration, released: release,
    shotRemaining: release ? .65 - (elapsed - input.releaseCharge * input.pack.chargeDuration) : 0, jump });
}

describe('authored jump-shot footwork follows the same charging and released motion', () => {
  for (const id of ids) {
    const input = { ...base, pack: motionPacks.shot[id] };
    it(`${id} begins at the real feet and keeps planted loading targets still`, () => {
      const out = createBasketballFootwork();
      expect(sampleShotFootwork(out, input)).toBe(out);
      expect(out.left).toEqual(input.leftSeed); expect(out.right).toEqual(input.rightSeed);
      const { takeoff } = times(input);
      const first = atTime(input, takeoff * .65), last = atTime(input, takeoff - .001);
      expect(first.leftPlanted && first.rightPlanted).toBe(true);
      expect(last.leftPlanted && last.rightPlanted).toBe(true);
      expect(distance(first.left, last.left)).toBeLessThan(1e-9);
      expect(distance(first.right, last.right)).toBeLessThan(1e-9);
      expect(first.right.z).toBeLessThan(first.left.z);
      expect(first.left.y).toBe(floor); expect(first.right.y).toBe(floor);
    });

    it(`${id} has no target switch at release and both feet follow the actual airborne body`, () => {
      const elapsed = input.releaseCharge * input.pack.chargeDuration;
      const before = atTime(input, elapsed), after = atTime(input, elapsed, true);
      expect(after.left).toEqual(before.left); expect(after.right).toEqual(before.right);
      const apex = atTime(input, .64 * input.pack.chargeDuration, true);
      expect(apex.phase).toBe('air');
      expect(apex.left.y).toBeGreaterThan(floor + input.pack.jump);
      expect(apex.right.y).toBeGreaterThan(floor + input.pack.jump);
      expect(apex.leftPlanted || apex.rightPlanted).toBe(false);
      expect(apex.leftToe).toBeLessThan(0); expect(apex.rightToe).toBeLessThan(0);
    });

    it(`${id} meets the floor continuously, then resets one foot at a time without dragging`, () => {
      const { landing } = times(input), dt = 1 / 120;
      const prior = atTime(input, landing - dt, true), land = atTime(input, landing, true);
      expect(distance(prior.left, land.left)).toBeLessThan(.045);
      expect(distance(prior.right, land.right)).toBeLessThan(.045);
      const grounded = atTime(input, landing + .10, true);
      expect(grounded.leftPlanted && grounded.rightPlanted).toBe(true);
      expect(grounded.left).toEqual(land.left); expect(grounded.right).toEqual(land.right);
      const budget = Math.min(.40, Math.max(.03, input.releaseCharge * input.pack.chargeDuration + .65 - landing - .03));
      const step = Math.min(.11, budget / 2), wait = Math.max(0, budget - step * 2);
      const leftReset = atTime(input, landing + wait + step * .5, true), rightReset = atTime(input, landing + wait + step * 1.5, true);
      expect(leftReset.leftPlanted && leftReset.rightPlanted).toBe(false);
      expect(rightReset.leftPlanted && rightReset.rightPlanted).toBe(false);
      for (const pose of [leftReset, rightReset]) {
        expect(pose.left.y).toBeGreaterThanOrEqual(floor); expect(pose.right.y).toBeGreaterThanOrEqual(floor);
        expect(Math.max(pose.left.y, pose.right.y)).toBeGreaterThan(floor + .02);
      }
    });

    it(`${id} mirrors the stance with the shooting hand and preserves world transforms`, () => {
      const elapsed = times(input).takeoff * .7, pose = atTime(input, elapsed);
      const mirror = atTime({ ...input, hand: -1, leftSeed: { x: -input.rightSeed.x, y: floor, z: input.rightSeed.z }, rightSeed: { x: -input.leftSeed.x, y: floor, z: input.leftSeed.z } }, elapsed);
      expect(mirror.left.x).toBeCloseTo(-pose.right.x, 10); expect(mirror.left.z).toBeCloseTo(pose.right.z, 10);
      expect(mirror.right.x).toBeCloseTo(-pose.left.x, 10); expect(mirror.right.z).toBeCloseTo(pose.left.z, 10);
      const turned = atTime({ ...input, yaw: Math.PI / 2, origin: { x: 5, y: 1.65, z: 8 }, position: { x: 5, y: 1.65, z: 8 } }, elapsed);
      expect(turned.left.x - 5).toBeCloseTo(pose.left.z, 10); expect(turned.left.z - 8).toBeCloseTo(-pose.left.x, 10);
      expect(turned.right.x - 5).toBeCloseTo(pose.right.z, 10); expect(turned.right.z - 8).toBeCloseTo(-pose.right.x, 10);
    });
  }

  it('uses visibly different quick, classic and high-release loading widths and stagger', () => {
    const poses = ids.map(id => atTime({ ...base, pack: motionPacks.shot[id] }, times({ ...base, pack: motionPacks.shot[id] }).takeoff * .7));
    expect(poses[1].right.x - poses[0].right.x).toBeGreaterThan(.009);
    expect(poses[2].right.x - poses[1].right.x).toBeGreaterThan(.009);
    expect(poses[0].right.z - poses[1].right.z).toBeGreaterThan(.015);
    expect(poses[1].right.z - poses[2].right.z).toBeGreaterThan(.009);
  });

  it('keeps an early release before takeoff grounded and continuous', () => {
    const input = { ...base, charge: .10, releaseCharge: .10 };
    const before = sampleShotFootwork(createBasketballFootwork(), input);
    const after = sampleShotFootwork(createBasketballFootwork(), { ...input, released: true, shotRemaining: .65 });
    expect(after.left).toEqual(before.left); expect(after.right).toEqual(before.right);
    for (const remaining of [.60, .55, .30, 0]) {
      const pose = sampleShotFootwork(createBasketballFootwork(), { ...input, released: true, shotRemaining: remaining, jump: -.03 });
      expect(pose.phase).not.toBe('air');
      expect(pose.left.y).toBeGreaterThanOrEqual(floor); expect(pose.right.y).toBeGreaterThanOrEqual(floor);
    }
  });

  it('uses a frozen landing anchor while the actor moves after contact', () => {
    const input = { ...base, landingOrigin: { x: .2, y: 1.65, z: -.3 } }, time = times(base).landing + .10;
    const a = atTime(input, time, true), b = atTime({ ...input, position: { x: .45, y: 1.65, z: -.55 } }, time, true);
    expect(a.left).toEqual(b.left); expect(a.right).toEqual(b.right);
  });

  it('preserves a mid-stride seed through an early release and lowers it without a reset snap', () => {
    const input = { ...base, charge: .10, releaseCharge: .10, leftSeed: { x: -.17, y: .24, z: .08 } };
    const charging = sampleShotFootwork(createBasketballFootwork(), input);
    let previous = sampleShotFootwork(createBasketballFootwork(), { ...input, released: true, shotRemaining: .65 });
    expect(previous.left).toEqual(charging.left);
    expect(previous.leftPlanted).toBe(false);
    for (let t = 1 / 120; t <= .65; t += 1 / 120) {
      const pose = sampleShotFootwork(createBasketballFootwork(), { ...input, released: true, shotRemaining: .65 - t });
      expect(distance(previous.left, pose.left)).toBeLessThan(.025);
      previous = pose;
    }
    expect(previous.left.y).toBeCloseTo(floor, 10);
  });

  it('keeps all loading, airborne and landing targets continuous at a genuine 120 Hz timestep', () => {
    for (const id of ids) for (const hand of [-1, 1]) {
      const input = { ...base, hand, pack: motionPacks.shot[id] }, releaseTime = .64 * input.pack.chargeDuration;
      let previous = atTime(input, 0);
      for (let t = 1 / 120; t <= releaseTime + .65; t += 1 / 120) {
        const pose = atTime(input, t, t >= releaseTime);
        expect(distance(previous.left, pose.left)).toBeLessThan(.035);
        expect(distance(previous.right, pose.right)).toBeLessThan(.035);
        previous = pose;
      }
    }
  });

  it('reuses persistent point objects, preserves frozen input and clamps damaged samples', () => {
    const input = copy(base), snapshot = JSON.stringify(input), out = createBasketballFootwork(), left = out.left, right = out.right;
    for (const charge of [0, .15, .40, .64, 1]) expect(sampleShotFootwork(out, { ...input, charge })).toBe(out);
    expect(out.left).toBe(left); expect(out.right).toBe(right); expect(JSON.stringify(input)).toBe(snapshot);
    sampleShotFootwork(out, { ...input, charge: Number.NaN, yaw: Number.NaN, jump: Number.POSITIVE_INFINITY, hand: Number.NaN,
      leftSeed: { x: Number.NaN, y: Number.NaN, z: Number.NaN }, rightSeed: { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NaN } });
    for (const p of [out.left, out.right]) expect(Object.values(p).every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(out.leftToe) && Number.isFinite(out.rightToe)).toBe(true);
  });

  for (const id of ids) for (const charge of [.46, .50, .55, .64, .75, 1]) for (const hand of [-1, 1]) {
    it(`${id}/${hand} finishes actual charge ${charge} before the released clock expires`, () => {
      const input = { ...base, hand, charge, releaseCharge: charge, pack: motionPacks.shot[id] };
      const release = prepareShot(charge, input.pack), before = sampleShotFootwork(createBasketballFootwork(), { ...input, jump: release.jump });
      let previous = sampleShotFootwork(createBasketballFootwork(), { ...input, jump: release.jump, released: true, shotRemaining: .65 });
      expect(previous.left).toEqual(before.left); expect(previous.right).toEqual(before.right);
      for (let frame = 1; frame <= 78; frame++) {
        const remaining = .65 - frame / 120;
        const body = shotRecovery(remaining, release.jump, input.pack, release.verticalVelocity);
        const pose = sampleShotFootwork(createBasketballFootwork(), { ...input, jump: body.jump, released: true, shotRemaining: remaining });
        expect(distance(previous.left, pose.left)).toBeLessThan(.035);
        expect(distance(previous.right, pose.right)).toBeLessThan(.035);
        if (charge * input.pack.chargeDuration < times(input).takeoff) expect(pose.phase).not.toBe('air');
        previous = pose;
      }
      expect(distance(previous.left, { ...input.leftSeed, y: floor })).toBeLessThan(.005);
      expect(distance(previous.right, { ...input.rightSeed, y: floor })).toBeLessThan(.005);
      expect(previous.leftPlanted && previous.rightPlanted).toBe(true);
      const marginBody = shotRecovery(.03, release.jump, input.pack, release.verticalVelocity);
      const margin = sampleShotFootwork(createBasketballFootwork(), { ...input, jump: marginBody.jump, released: true, shotRemaining: .03 });
      expect(distance(margin.left, { ...input.leftSeed, y: floor })).toBeLessThan(.005);
      expect(distance(margin.right, { ...input.rightSeed, y: floor })).toBeLessThan(.005);
    });
  }
});
