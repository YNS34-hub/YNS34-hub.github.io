import { describe, expect, it } from 'vitest';
import { motionPacks } from '../src/worlds/court/motionPacks';
import { prepareShot, shotRecovery, shotFollowThroughTarget } from '../src/worlds/presence/shotPose';

const ids = ['quick', 'classic', 'high-release'] as const;
const delta = 1 / 120;

describe('shooting profiles use the released posture throughout flight', () => {
  for (const id of ids) {
    const profile = motionPacks.shot[id];
    it(`${id} raises the ball smoothly, jumps, and settles a late hold`, () => {
      let previous = prepareShot(0, profile);
      for (let c = .001; c <= 1; c += .001) {
        const pose = prepareShot(c, profile);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
        expect(Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z)).toBeLessThan(.02);
        expect(Math.abs(pose.jump - previous.jump)).toBeLessThan(.02);
        previous = pose;
      }
      const release = prepareShot(.64, profile);
      expect(release.y).toBeGreaterThan(1.9);
      expect(release.jump).toBeGreaterThan(.20);
      expect(prepareShot(1, profile).jump).toBe(0);
      expect(prepareShot(1, profile).verticalVelocity).toBe(0);
    });

    it(`${id} has gravity and matching vertical velocity during the airborne charge`, () => {
      const dc = .0001;
      for (const charge of [.57, .64, .70]) {
        const low = prepareShot(charge - dc, profile), mid = prepareShot(charge, profile), high = prepareShot(charge + dc, profile);
        const physicalDelta = dc * profile.chargeDuration;
        expect((high.jump - 2 * mid.jump + low.jump) / physicalDelta ** 2).toBeCloseTo(-9.81, 4);
        expect((high.jump - low.jump) / (2 * physicalDelta)).toBeCloseTo(mid.verticalVelocity, 6);
      }
    });

    for (const charge of [.10, .50, .64, .85, 1]) it(`${id} recovers charge ${charge} from its actual height and velocity without restarting the jump`, () => {
      const release = prepareShot(charge, profile);
      const start = shotRecovery(.65, release.jump, profile, release.verticalVelocity);
      expect(start.jump).toBeCloseTo(release.jump, 10);
      const next = shotRecovery(.65 - delta, release.jump, profile, release.verticalVelocity);
      expect(Math.abs(next.jump - release.jump)).toBeLessThan(.05);
      if (release.jump > 0 && prepareShot(charge + delta / profile.chargeDuration, profile).jump > 0) {
        const continuingFlight = prepareShot(charge + delta / profile.chargeDuration, profile);
        expect(next.jump).toBeCloseTo(continuingFlight.jump, 8);
      }
      expect(Math.abs(shotRecovery(0, release.jump, profile, release.verticalVelocity).jump)).toBeLessThan(.02);
    });

    it(`${id} carries a descending release into a smooth follow-through and grounded recovery`, () => {
      const height = .12, velocity = -1.1; for (const time of [.005, .02, .04]) expect(shotRecovery(.65 - time, height, profile, velocity).jump).toBeCloseTo(height + velocity * time - 4.905 * time * time, 10);
      expect(shotRecovery(.65, height, profile, velocity).jump).toBe(height);
      expect(shotRecovery(.65 - delta, height, profile, velocity).jump).toBeLessThan(height);
      let previous = shotRecovery(.65, height, profile, velocity);
      expect(previous.reach).toBe(1);
      expect(previous.wrist).toBe(0);
      for (let time = delta; time <= .65; time += delta) {
        const pose = shotRecovery(.65 - time, height, profile, velocity);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
        expect(Math.abs(pose.jump - previous.jump)).toBeLessThan(.05);
        for (const key of ['reach', 'guide', 'wrist'] as const) {
          expect(pose[key]).toBeGreaterThanOrEqual(0);
          expect(pose[key]).toBeLessThanOrEqual(1);
          expect(Math.abs(pose[key] - previous[key])).toBeLessThan(.20);
        }
        previous = pose;
      }
      const settled = shotRecovery(0, height, profile, velocity); expect(settled.jump).toBeCloseTo(0, 8); expect(settled).toMatchObject({ reach: 0, guide: 0, wrist: 0 });
    });
  }

  it('makes quick release earlier and high release visibly taller than classic', () => {
    const liftTime = (id: typeof ids[number]) => {
      const profile = motionPacks.shot[id];
      for (let c = 0; c <= 1; c += .001) if (prepareShot(c, profile).y > profile.releaseHeight - .02) return c * profile.chargeDuration;
      throw Error('Ball never reached the release height');
    };
    expect(liftTime('quick')).toBeLessThan(liftTime('classic'));
    expect(liftTime('classic')).toBeLessThan(liftTime('high-release'));
    const quick = prepareShot(.64, motionPacks.shot.quick), classic = prepareShot(.64, motionPacks.shot.classic), high = prepareShot(.64, motionPacks.shot['high-release']);
    expect(high.y).toBeGreaterThan(classic.y + .08);
    expect(high.jump).toBeGreaterThan(classic.jump + .02);
    expect(classic.jump).toBeGreaterThan(quick.jump + .04);
  });

  it('uses each profile wrist timing in the early follow-through', () => {
    const quick = shotRecovery(.61, .30, motionPacks.shot.quick), classic = shotRecovery(.61, .30, motionPacks.shot.classic), high = shotRecovery(.61, .30, motionPacks.shot['high-release']);
    expect(quick.wrist).toBeGreaterThan(classic.wrist + .05);
    expect(classic.wrist).toBeGreaterThan(high.wrist + .05);
  });
});



describe('follow-through remains attached to the released actor posture', () => {
  it('starts at the exact released hand including an early crouched release', () => {
    const out = { x: 0, y: 0, z: 0 }, hand = { x: .2, y: 1.3, z: -.35 }, body = { x: 0, y: 1.65, z: 0 };
    expect(shotFollowThroughTarget(out, hand, body, body, -.06, -.06, .08, .08)).toBe(out);
    expect(out).toEqual(hand);
  });

  it('follows horizontal and camera-height movement after release without a fixed world-space arm', () => {
    const out = { x: 0, y: 0, z: 0 };
    shotFollowThroughTarget(out, { x: 2, y: 2.7, z: 3 }, { x: 1, y: 1.65, z: 1 }, { x: 4, y: 1.8, z: -2 }, .3, .18, .05, .10);
    expect(out.x).toBe(5); expect(out.y).toBeCloseTo(2.68, 12); expect(out.z).toBe(0);
  });

  it('lands at the same body-relative height from ordinary and twice-higher release jumps', () => {
    const out = { x: 0, y: 0, z: 0 }, body = { x: 0, y: 1.65, z: 0 };
    shotFollowThroughTarget(out, { x: .1, y: 2.7, z: -.27 }, body, body, .3, 0, 0, 0);
    expect(out.y).toBeCloseTo(2.4, 12);
    shotFollowThroughTarget(out, { x: .1, y: 3.0, z: -.27 }, body, body, .6, 0, 0, 0);
    expect(out.y).toBeCloseTo(2.4, 12);
    expect(out.x).toBe(.1); expect(out.z).toBe(-.27);
  });

  it('carries a crouched early release into a straightened body with the correct stance sign', () => {
    const out = { x: 0, y: 0, z: 0 }, body = { x: 0, y: 1.65, z: 0 };
    shotFollowThroughTarget(out, { x: .2, y: 1.3, z: -.35 }, body, body, -.05, 0, .08, 0);
    expect(out.y).toBeCloseTo(1.43, 12);
    shotFollowThroughTarget(out, { x: .2, y: 1.3, z: -.35 }, body, body, 0, 0, 0, .12);
    expect(out.y).toBeCloseTo(1.18, 12);
  });

  it('is invariant to moving the entire release fixture to another world location', () => {
    const out = { x: 0, y: 0, z: 0 }, translated = { x: 0, y: 0, z: 0 };
    const hand = { x: 2, y: 2.7, z: 3 }, releaseBody = { x: 1, y: 1.65, z: 1 }, body = { x: 4, y: 1.65, z: -2 };
    shotFollowThroughTarget(out, hand, releaseBody, body, .3, 0, .05, .10);
    shotFollowThroughTarget(translated, { x: 12, y: -1.3, z: 9 }, { x: 11, y: -2.35, z: 7 }, { x: 14, y: -2.35, z: 4 }, .3, 0, .05, .10);
    expect(translated.x - out.x).toBe(10); expect(translated.y - out.y).toBeCloseTo(-4, 12); expect(translated.z - out.z).toBe(6);
  });

  it('uses the supplied output and leaves every release and actor input untouched', () => {
    const out = { x: 99, y: 99, z: 99 }, hand = Object.freeze({ x: 2, y: 2.7, z: 3 });
    const releaseBody = Object.freeze({ x: 1, y: 1.65, z: 1 }), body = Object.freeze({ x: 4, y: 1.65, z: -2 });
    for (let frame = 0; frame < 30; frame++) expect(shotFollowThroughTarget(out, hand, releaseBody, body, .3, .3 * (1 - frame / 29), 0, 0)).toBe(out);
    expect(hand).toEqual({ x: 2, y: 2.7, z: 3 }); expect(releaseBody).toEqual({ x: 1, y: 1.65, z: 1 }); expect(body).toEqual({ x: 4, y: 1.65, z: -2 });
  });

  it('keeps output finite when a damaged release sample contains nonfinite coordinates or heights', () => {
    const out = { x: 0, y: 0, z: 0 };
    shotFollowThroughTarget(out, { x: Number.NaN, y: 2.3, z: Number.POSITIVE_INFINITY }, { x: 1, y: Number.NaN, z: 3 }, { x: Number.POSITIVE_INFINITY, y: 1.65, z: Number.NEGATIVE_INFINITY }, Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NEGATIVE_INFINITY);
    expect(Object.values(out).every(Number.isFinite)).toBe(true);
  });

  it('does not emit infinity when individually finite coordinates overflow during translation', () => {
    const out = { x: 0, y: 0, z: 0 }, extreme = { x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE };
    shotFollowThroughTarget(out, extreme, { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE, z: -Number.MAX_VALUE }, extreme, Number.MAX_VALUE, Number.MAX_VALUE, 0, 0);
    expect(Object.values(out).every(Number.isFinite)).toBe(true);
  });
});
