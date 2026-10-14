import { HOOPS, type Vec } from "../basketballPhysics";
import {motionPacks,normalizePacks,type MotionPackSelection,type FinishMotionPack,type HandMotionPack} from "./motionPacks";

export type FinishKind = "layup" | "dunk";
export interface FinishInput { held: boolean; position: Vec; direction: Vec; speed: number; hand: number; ball?: Vec; feet?:{left:Vec;right:Vec};stance?:number;packs?:MotionPackSelection }
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const ease = (t: number) => { const s = clamp(t); return s * s * (3 - 2 * s); };
export function finishEligibility(kind: FinishKind, input: FinishInput) {
  const hoop = HOOPS.reduce((closest, candidate) => Math.hypot(candidate.x - input.position.x, candidate.z - input.position.z) < Math.hypot(closest.x - input.position.x, closest.z - input.position.z) ? candidate : closest);
  const dx = hoop.x - input.position.x, dz = hoop.z - input.position.z, distance = Math.hypot(dx, dz);
  const facing = (dx * input.direction.x + dz * input.direction.z) / Math.max(.001, distance * Math.hypot(input.direction.x, input.direction.z));
  const behindBoard=input.position.z*Math.sign(hoop.z)>Math.abs(hoop.z)+.15;
  const reason = !input.held ? "Pick up the ball first" : distance > (kind === "dunk" ? 2.8 : 3.4) ? "Move closer to the rim" : behindBoard ? "Approach from the court side of the backboard" : facing < .55 ? "Face the rim" : kind === "dunk" && input.speed < 2.2 ? "Build a run-up · Enter + W" : "";
  return { allowed: !reason, reason, hoop, distance };
}
interface FinishPlan { kind: FinishKind; start: Vec; end: Vec; origin: Vec; velocity: Vec; duration: number; releaseAt: number; jump: number; hand: number; forward: Vec; right: Vec; gather: Vec; feet:{left:Vec;right:Vec};style:FinishMotionPack;hands:HandMotionPack;package:string;stance:number }
export type FinishPhase = "gather" | "first-step" | "plant" | "rise" | "release" | "land" | "recover";
export interface FinishPose {
  position: Vec; jump: number; ball: Vec; kind: FinishKind; phase: FinishPhase; elapsed: number;
  leftFoot: Vec; rightFoot: Vec; torsoPitch: number; torsoTwist: number; guide: number; wrist: number;
  twoHands:number;package:string;handSpread:number;stance:number;
  release?: { origin: Vec; velocity: Vec };
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const travelTimes=[0,.30,.40,.82,1.2,1.48],travelValues=[0,.37,.56,.91,.99,1],travelSlopes=[1.15,1.35,1.3,.52,.06,0];
function progress(t: number) {
  // 分段 Hermite 保留同一边界速度，收球 / 两步 / 空中不会在每个关键帧停住再启动。
  const times=travelTimes,values=travelValues,slopes=travelSlopes;
  const time=clamp(t,0,1.48);let i=0;while(i<times.length-2&&time>times[i+1])i++;
  const span=times[i+1]-times[i],s=(time-times[i])/span,s2=s*s,s3=s2*s;
  return (2*s3-3*s2+1)*values[i]+(s3-2*s2+s)*span*slopes[i]+(-2*s3+3*s2)*values[i+1]+(s3-s2)*span*slopes[i+1];
}
export class FinishMotion {
  private plan: FinishPlan | null = null;
  private released = false;
  elapsed = 0;
  get active() { return !!this.plan; }
  start(kind: FinishKind, input: FinishInput) {
    const result = finishEligibility(kind, input); if (!result.allowed || this.active) return { ...result, allowed: false };
    const hoop = result.hoop, front = input.position.z >= hoop.z ? 1 : -1, hand = input.hand >= 0 ? 1 : -1;
    const packs=input.packs?normalizePacks(input.packs):null;
    const style:FinishMotionPack=packs?{...(kind==="layup"?motionPacks.layup[packs.layup]:motionPacks.dunk[packs.dunk])}:{...motionPacks.layup.standard,releaseAt:kind==="dunk"?.77:.74,jump:kind==="dunk"?.82:.72,offset:kind==="dunk"?0:.20,originY:kind==="dunk"?3.34:2.82};
    const hands={...motionPacks.hands[packs?.hands??"natural"]};
    const length = Math.max(.001, Math.hypot(input.direction.x, input.direction.z));
    const forward = { x: input.direction.x / length, y: 0, z: input.direction.z / length };
    const right = { x: -forward.z, y: 0, z: forward.x };
    const bodyOffset=packs&&style.twoHands?0:kind==="dunk"?.20:.32;
    const origin = { x: hoop.x -hand*style.offset*(packs?right.x:1), y: style.originY, z: hoop.z + (kind === "dunk" ? 0 : front * .48)-(packs?right.z*hand*style.offset:0) };
    const flight = .56;
    // 扣篮只把球向下释放，上篮用真实重力解出短弧；计分继续等待原 BallPhysics 的向下穿框事件。
    const velocity = kind === "dunk" ? { x: 0, y: -2.2, z: 0 } : { x: (hoop.x - origin.x) / flight, y: (hoop.y - origin.y + 9.81 * flight * flight / 2) / flight, z: (hoop.z - origin.z) / flight };
    const gather = input.ball && [input.ball.x,input.ball.y,input.ball.z].every(Number.isFinite) ? { ...input.ball } : { x: input.position.x + right.x * hand * .22 + forward.x * .36, y: 1.07, z: input.position.z + right.z * hand * .22 + forward.z * .36 };
    const seedFoot=(side:number)=>{
      const source=side>0?input.feet?.right:input.feet?.left;
      return source&&[source.x,source.y,source.z].every(Number.isFinite)&&Math.hypot(source.x-input.position.x,source.z-input.position.z)<1
        ?{...source}:{x:input.position.x+right.x*side*.13,y:.09,z:input.position.z+right.z*side*.13};
    };
    this.plan = { kind, start: { ...input.position }, end: { x: hoop.x - hand *bodyOffset*(packs?right.x:1), y: input.position.y, z: hoop.z + front * (packs?kind==="dunk"?.08:.40:kind==="dunk"?.23:.85)-(packs?right.z*hand*bodyOffset:0) }, origin, velocity, hand, duration: 1.48, releaseAt: style.releaseAt, jump: style.jump, forward, right, gather,feet:{left:seedFoot(-1),right:seedFoot(1)},style,hands,package:packs?.[kind]??"legacy",stance:packs?Math.max(0,Math.min(.36,input.stance??.08)):0 };
    this.elapsed = 0; this.released = false; return result;
  }
  cancel() { this.plan = null; }
  advance(rawDelta: number, paused = false): FinishPose | null {
    const plan = this.plan; if (!plan) return null;
    if (!paused) this.elapsed += clamp(Number.isFinite(rawDelta) ? rawDelta : 0, 0, .06);
    const t = this.elapsed, move = progress(t),flight=2*Math.sqrt(2*plan.jump/9.81),landAt=.40+flight,air=clamp((t-.40)/flight),rise=ease((t-.40)/(plan.releaseAt-.40));
    const lateral=plan.style.lateral*plan.hand*Math.sin(Math.PI*clamp(t/.40));
    const position = { x: mix(plan.start.x, plan.end.x, move)+plan.right.x*lateral, y: plan.start.y, z: mix(plan.start.z, plan.end.z, move)+plan.right.z*lateral };
    const crouch = -.095 * Math.sin(Math.PI * clamp(t / .40));
    const landing = -.09 * Math.sin(Math.PI * clamp((t-landAt)/.20));
    // 身体空中轨迹使用真实重力，扣篮不再以 .62 秒凭空弹高 1.22 m；原球物理仍独立负责计分。
    const jump = t < .40 ? crouch : t < landAt ? 4*plan.jump*air*(1-air) : landing;
    const settle = ease((t - Math.max(.88,plan.releaseAt+.04)) / .48);
    const chest = { x: position.x + plan.right.x * plan.hand * plan.hands.holdX + plan.forward.x * -plan.hands.holdZ, y: plan.hands.holdY+.16 + Math.max(0, jump) * .55, z: position.z + plan.right.z * plan.hand * plan.hands.holdX + plan.forward.z * -plan.hands.holdZ };
    const gather = ease(t / plan.hands.gatherTime);
    chest.x = mix(plan.gather.x + position.x - plan.start.x, chest.x, gather);
    chest.y = mix(plan.gather.y, chest.y, gather);
    chest.z = mix(plan.gather.z + position.z - plan.start.z, chest.z, gather);
    const ball = { x: mix(mix(chest.x, plan.origin.x, rise), chest.x, settle), y: mix(mix(chest.y, plan.origin.y, rise), 1.16, settle), z: mix(mix(chest.z, plan.origin.z, rise), chest.z, settle) };
    const foot = (side: number): Vec => {
      let along = side === plan.hand ? -.18 : .13, height = .09;
      if (t < .40) {
        const stepStart = side === plan.hand ? 0 : .22, stepEnd = side === plan.hand ? .27 : .40;
        const step = clamp((t - stepStart) / (stepEnd - stepStart));
        const seed=side>0?plan.feet.right:plan.feet.left,anchor=progress(plan.kind==="dunk"?.40:stepEnd),eased=ease(step);
        const x=mix(plan.start.x,plan.end.x,anchor)+plan.right.x*side*.13,z=mix(plan.start.z,plan.end.z,anchor)+plan.right.z*side*.13;
        return {x:mix(seed.x,x,eased),y:mix(seed.y,height,eased)+Math.sin(Math.PI*step)*.16,z:mix(seed.z,z,eased)};
      }
      if (t < landAt) {
        const knee=Math.sin(Math.PI*air);
        along=plan.kind==="layup"?(side===plan.hand?.30:-.16)*knee:-.18*knee;
        height+=Math.max(0,jump)+(plan.kind==="layup"?(side===plan.hand?.40:.12):.16)*knee;
        const lift=ease((t-.40)/.13),anchor=progress(side===plan.hand&&plan.kind==="layup"?.27:.40);
        const startX=mix(plan.start.x,plan.end.x,anchor)+plan.right.x*side*.13,startZ=mix(plan.start.z,plan.end.z,anchor)+plan.right.z*side*.13;
        return {x:mix(startX,position.x+plan.right.x*side*.14+plan.forward.x*along,lift),y:height,z:mix(startZ,position.z+plan.right.z*side*.14+plan.forward.z*along,lift)};
      }
      return { x: position.x + plan.right.x * side * .14 + plan.forward.x * along, y: height, z: position.z + plan.right.z * side * .14 + plan.forward.z * along };
    };
    const phase: FinishPhase = t < .13 ? "gather" : t < .30 ? "first-step" : t < .40 ? "plant" : t < plan.releaseAt ? "rise" : t < .90 ? "release" : t < 1.35 ? "land" : "recover";
    const result: FinishPose = { position, jump, ball, kind: plan.kind, phase, elapsed: t, leftFoot: foot(-1), rightFoot: foot(1), torsoPitch: mix(-.23,.07,rise)*(1-settle), torsoTwist: plan.hand*plan.style.twist*Math.sin(Math.PI*clamp((t-.18)/.85)), guide:plan.style.twoHands?1-ease((t-plan.releaseAt-.055)/.25):1-ease((t-.50)/.23),twoHands:plan.style.twoHands?gather*(1-ease((t-plan.releaseAt-.055)/.25)):0,package:plan.package,handSpread:plan.hands.spread,stance:plan.stance*(1-ease((t-.16)/.24)), wrist: ease((t-plan.releaseAt)/.10)*(1-settle) };
    if (!paused && !this.released && t >= plan.releaseAt) { result.release = { origin: { ...plan.origin }, velocity: { ...plan.velocity } }; this.released = true; }
    if (!paused && t >= plan.duration) this.plan = null;
    return result;
  }
}
