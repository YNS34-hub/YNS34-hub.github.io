/** Court-space X/Z are relative to the actor root; Y remains absolute world height. */
export type CourtFootPoint = { x: number; y: number; z: number };
export type CourtLocomotion = CourtFootPoint & { initialized: boolean };
export type CourtClipWeights={idle:number;walk:number;run:number};

export function createCourtTravel(){return {direction:1 as 1|-1,playback:1,initialized:false};}
/** Reverse the existing gait for backpedaling; retain its phase and ease joint velocity. */
export function advanceCourtTravel(out:ReturnType<typeof createCourtTravel>,velocity:{x:number;z:number},facing:{x:number;z:number},dt:number,authored=false){
 if(authored||!Number.isFinite(dt)||dt<=0)return out;
 const speed=Math.hypot(velocity.x,velocity.z),length=Math.hypot(facing.x,facing.z);
 if(!Number.isFinite(speed)||!Number.isFinite(length)||speed<=.3||length<1e-6)return out;
 const forward=(velocity.x*facing.x+velocity.z*facing.z)/(speed*length);
 // A dead band keeps pure strafes and tiny projection noise from flipping the gait.
 if(forward>.2)out.direction=1;else if(forward<-.2)out.direction=-1;
 if(!out.initialized){out.playback=out.direction;out.initialized=true;}
 else out.playback+=(out.direction-out.playback)*(1-Math.exp(-18*Math.min(.06,dt)));
 return out;
}

/** Blend the actual walk/run clips over a speed range instead of switching at 3.5m/s. */
export function sampleCourtClipWeights(out:CourtClipWeights,speed:number,authored=false):CourtClipWeights{
 const s=Number.isFinite(speed)?Math.max(0,speed):0;
 const ease=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
 const moving=authored?0:ease((s-.05)/.45),running=ease((s-2.6)/1.8);
 out.idle=1-moving;out.walk=moving*(1-running);out.run=moving*running;return out;
}

const ANKLE_CLEARANCE = .112;
const RESPONSE = 25;
const MAX_ARTICULATION_SPEED = 4.5;
const MAX_FRAME = .05;
const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

/** Open the leg gap before a between-legs bounce, then recover by the next catch. */
export function dribbleLegWindow(phase: number): number {
  const p = Math.min(1, Math.max(0, finiteOr(phase, 0)));
  const opening = Math.min(1, p / .26), closing = Math.max(0, (p - .66) / .34);
  return opening * opening * (3 - 2 * opening) * (1 - closing * closing * (3 - 2 * closing));
}

/** Open knees outward over the planted feet during the same low-ball window. */
export function sampleDribbleKneePole<T extends CourtFootPoint>(out: T, side: number, gap: number): T {
  const amount=Math.max(0,Math.min(1,finiteOr(gap,0)));
  const sign=Number.isFinite(side)&&side<0?-1:1;
  out.x=sign*(.24+amount*.12);out.y=.65;out.z=-.40;
  return out;
}

/** Seed with the previous rendered ankle when entering a new locomotion action. */
export function createCourtLocomotion(seed?: CourtFootPoint, floorHeight = 0): CourtLocomotion {
  const floor = finiteOr(floorHeight, 0) + ANKLE_CLEARANCE;
  return {
    x: seed ? finiteOr(seed.x, 0) : 0,
    y: seed ? Math.max(floor, finiteOr(seed.y, floor)) : floor,
    z: seed ? finiteOr(seed.z, 0) : 0,
    initialized: !!seed,
  };
}

/**
 * Blend walk/run clip discontinuities without filtering actor translation or ball motion.
 * The same persistent output is returned each frame. Reset only when seeding the actual
 * previous ankle; normal clip transitions must pass through the speed-bounded filter.
 */
export function sampleCourtLocomotion(
  out: CourtLocomotion,
  desired: CourtFootPoint | null | undefined,
  dt: number,
  reset = false,
  floorHeight = 0,
): CourtLocomotion {
  const floor = finiteOr(floorHeight, 0) + ANKLE_CLEARANCE;
  out.x = finiteOr(out.x, 0);
  out.y = Math.max(floor, finiteOr(out.y, floor));
  out.z = finiteOr(out.z, 0);
  if (!desired) return out;

  const x = finiteOr(desired.x, out.x), y = Math.max(floor, finiteOr(desired.y, out.y)), z = finiteOr(desired.z, out.z);
  if (reset || !out.initialized) {
    out.x = x; out.y = y; out.z = z; out.initialized = true;
    return out;
  }
  if (!Number.isFinite(dt) || dt <= 0) return out;

  const step = Math.min(dt, MAX_FRAME), alpha = -Math.expm1(-RESPONSE * step);
  const dx = x - out.x, dy = y - out.y, dz = z - out.z;
  const distance = Math.hypot(dx, dy, dz);
  const weight = distance > 0 ? Math.min(alpha, MAX_ARTICULATION_SPEED * step / distance) : 0;
  out.x += dx * weight;
  out.y = Math.max(floor, out.y + dy * weight);
  out.z += dz * weight;
  return out;
}
