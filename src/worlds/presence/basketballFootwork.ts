import type { ShotMotionPack } from '../court/motionPacks';

type Point = { x: number; y: number; z: number };
export type ShotFootworkPhase = 'load' | 'plant' | 'air' | 'land' | 'recover';
export interface ShotFootworkInput {
  charge: number; shotRemaining: number; releaseCharge: number; released?: boolean;
  jump: number; stance?: number; hand: number; pack: Readonly<ShotMotionPack>; yaw: number;
  origin: Readonly<Point>; position: Readonly<Point>; leftSeed: Readonly<Point>; rightSeed: Readonly<Point>;
  /** Freeze the current body position on the first grounded frame after flight. */
  landingOrigin?: Readonly<Point>;
  /** World ankle height with a flat sole on this court, rather than the camera's eye height. */
  floorY?: number;
}
export interface BasketballFootwork {
  left: Point; right: Point; leftToe: number; rightToe: number;
  leftPlanted: boolean; rightPlanted: boolean; phase: ShotFootworkPhase;
  weightShift: number; kneeLoad: number;
}

const finite = (v: number, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v: number) => Math.max(0, Math.min(1, finite(v)));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const quick = { width: .165, stagger: .10 };
const classic = { width: .180, stagger: .15 };
const high = { width: .195, stagger: .18 };

/** Allocate once for an avatar. Sampling below only writes these existing points. */
export function createBasketballFootwork(): BasketballFootwork {
  return { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 },
    leftToe: 0, rightToe: 0, leftPlanted: true, rightPlanted: true, phase: 'load', weightShift: 0, kneeLoad: 0 };
}

/** Grounded recovery starts at the last rendered ankle, avoiding stacked fades. */
export function shotFootSettleTarget(out: Point, seed: Readonly<Point>, seedBody: Readonly<Point>, body: Readonly<Point>, rest: Readonly<Point>, remaining: number, startRemaining: number): Point {
  const duration=Math.max(0,finite(startRemaining));
  const fade=duration>0?smooth(1-Math.max(0,finite(remaining))/duration):1;
  out.x=mix(finite(seed.x,finite(rest.x))+(finite(body.x)-finite(seedBody.x)),finite(rest.x),fade);
  out.y=mix(finite(seed.y,finite(rest.y,.112)),finite(rest.y,.112),fade);
  out.z=mix(finite(seed.z,finite(rest.z))+(finite(body.z)-finite(seedBody.z)),finite(rest.z),fade);
  return out;
}

/**
 * Author feet above the existing shot clock and ballistic body height. Plant and
 * landing anchors are world-space snapshots, so a stationary support foot does
 * not follow a changing camera. Neither ball physics nor the actor is modified.
 */
export function sampleShotFootwork(out: BasketballFootwork, input: ShotFootworkInput): BasketballFootwork {
  const duration = Math.max(.5, finite(input.pack.chargeDuration, 1.4));
  const launch = Math.sqrt(2 * 9.81 * Math.max(0, finite(input.pack.jump, .30)));
  const takeoff = Math.max(.05, .64 * duration - launch / 9.81);
  const ballisticLanding = takeoff + 2 * launch / 9.81;
  const released = input.released ?? input.shotRemaining > 0;
  const releaseTime = clamp(input.releaseCharge) * duration;
  const elapsed = released ? releaseTime + (.65 - Math.max(0, Math.min(.65, finite(input.shotRemaining)))) : clamp(input.charge) * duration;
  // An early key-up can release before the body takes off. It must not start a
  // second imaginary jump just because the charging clock would have done so.
  const aborted = released && releaseTime < takeoff;
  const landing = aborted ? releaseTime : ballisticLanding;
  const settleTime = Math.min(.20, takeoff * .44);
  const load = smooth((aborted ? releaseTime : elapsed) / settleTime);
  const style = duration < 1.2 ? quick : input.pack.releaseHeight >= 2.08 ? high : classic;
  const hand = finite(input.hand, 1) < 0 ? -1 : 1;
  const yaw = finite(input.yaw), cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const originX = finite(input.origin.x), originZ = finite(input.origin.z);
  const floorY = finite(input.floorY ?? .095, .095);
  const bodyX = finite(input.position.x, originX), bodyZ = finite(input.position.z, originZ);
  const landX = finite(input.landingOrigin?.x ?? originX, originX), landZ = finite(input.landingOrigin?.z ?? originZ, originZ);
  const inAir = !aborted && elapsed >= takeoff && elapsed < landing;
  const air = inAir ? clamp((elapsed - takeoff) / Math.max(.001, landing - takeoff)) : 0;
  const tuck = inAir ? Math.sin(Math.PI * air) : 0;
  const liftBlend = inAir ? smooth((elapsed - takeoff) / .07) : 0;
  const landBlend = inAir ? smooth((air - .70) / .30) : elapsed >= landing && !aborted ? 1 : 0;
  // The follow-through lasts .65 s regardless of the release charge. Spend the
  // available grounded time on the two real steps first, shortening the waiting
  // period before speeding those steps up; finish .03 s before the clock ends.
  const recoveryBudget = released ? Math.min(.40, Math.max(.03, releaseTime + .65 - landing - .03)) : .40;
  const recoveryStep = Math.min(.11, recoveryBudget / 2), recoveryWait = Math.max(0, recoveryBudget - recoveryStep * 2);
  const resetting = elapsed >= landing + recoveryWait;
  out.phase = inAir ? 'air' : resetting ? 'recover' : elapsed >= landing ? 'land' : load < 1 ? 'load' : 'plant';
  out.weightShift = hand * .012 * load * (inAir ? 1 - smooth(air / .30) : resetting ? 0 : 1);
  out.kneeLoad = clamp((Math.max(0, -finite(input.jump)) + Math.max(0, finite(input.stance ?? 0))) / Math.max(.10, finite(input.pack.crouch, .10)));

  for (let side = -1; side <= 1; side += 2) {
    const point = side < 0 ? out.left : out.right, seed = side < 0 ? input.leftSeed : input.rightSeed;
    const seedX = finite(seed.x, originX + side * .13), seedY = Math.max(floorY, finite(seed.y, floorY)), seedZ = finite(seed.z, originZ);
    const localX = side * style.width, localZ = (side === hand ? -1 : 1) * style.stagger * .5;
    const plantedX = mix(seedX, originX + cosine * localX + sine * localZ, load);
    const plantedY = mix(seedY, floorY, load);
    const plantedZ = mix(seedZ, originZ - sine * localX + cosine * localZ, load);
    let x = plantedX, y = plantedY, z = plantedZ, toe = 0, isPlanted = load === 1;
    if (inAir) {
      const airX = side * (style.width * (1 - .07 * tuck) + .016 * landBlend);
      const airZ = localZ * (1 - .5 * tuck) - .035 * landBlend;
      x = mix(plantedX, bodyX + cosine * airX + sine * airZ, liftBlend);
      z = mix(plantedZ, bodyZ - sine * airX + cosine * airZ, liftBlend);
      y = floorY + Math.max(0, finite(input.jump)) + tuck * (side === hand ? .035 : .025);
      toe = -.20 * tuck; isPlanted = false;
    } else if (elapsed >= landing) {
      if (!aborted) {
        const landLocalX = side * (style.width + .016), landLocalZ = localZ - .035;
        x = landX + cosine * landLocalX + sine * landLocalZ;
        z = landZ - sine * landLocalX + cosine * landLocalZ;
        y = floorY;
      }
      const step = clamp((elapsed - landing - recoveryWait - (side === hand ? recoveryStep : 0)) / recoveryStep);
      if (step > 0) {
        x = mix(x, seedX + landX - originX, smooth(step));
        z = mix(z, seedZ + landZ - originZ, smooth(step));
        y = mix(y, floorY, smooth(step)) + .040 * Math.sin(Math.PI * step);
      }
      isPlanted = (step === 0 || step === 1) && Math.abs(y - floorY) < 1e-8;
    }
    point.x = finite(x, seedX); point.y = Math.max(floorY, finite(y, floorY)); point.z = finite(z, seedZ);
    if (side < 0) { out.leftToe = toe; out.leftPlanted = isPlanted; }
    else { out.rightToe = toe; out.rightPlanted = isPlanted; }
  }
  return out;
}
