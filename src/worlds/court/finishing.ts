import { HOOPS, type Vec } from "../basketballPhysics";

export type FinishKind = "layup" | "dunk";
export interface FinishInput { held: boolean; position: Vec; direction: Vec; speed: number; hand: number; ball?: Vec }
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const ease = (t: number) => { const s = clamp(t); return s * s * (3 - 2 * s); };
export function finishEligibility(kind: FinishKind, input: FinishInput) {
  const hoop = HOOPS.reduce((closest, candidate) => Math.hypot(candidate.x - input.position.x, candidate.z - input.position.z) < Math.hypot(closest.x - input.position.x, closest.z - input.position.z) ? candidate : closest);
  const dx = hoop.x - input.position.x, dz = hoop.z - input.position.z, distance = Math.hypot(dx, dz);
  const facing = (dx * input.direction.x + dz * input.direction.z) / Math.max(.001, distance * Math.hypot(input.direction.x, input.direction.z));
  const behindBoard=input.position.z*Math.sign(hoop.z)>Math.abs(hoop.z)+.15;
  const reason = !input.held ? "Pick up the ball first" : distance > (kind === "dunk" ? 2.8 : 3.4) ? "Move closer to the rim" : behindBoard ? "Approach from the court side of the backboard" : facing < .55 ? "Face the rim" : kind === "dunk" && input.speed < 2.2 ? "Build a run-up · Enter / Shift + W" : "";
  return { allowed: !reason, reason, hoop, distance };
}
interface FinishPlan { kind: FinishKind; start: Vec; end: Vec; origin: Vec; velocity: Vec; duration: number; releaseAt: number; jump: number; hand: number; forward: Vec; right: Vec; gather: Vec }
export type FinishPhase = "gather" | "first-step" | "plant" | "rise" | "release" | "land" | "recover";
export interface FinishPose {
  position: Vec; jump: number; ball: Vec; kind: FinishKind; phase: FinishPhase; elapsed: number;
  leftFoot: Vec; rightFoot: Vec; torsoPitch: number; torsoTwist: number; guide: number; wrist: number;
  release?: { origin: Vec; velocity: Vec };
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function progress(t: number) {
  // 收球后的第一步较长，第二步缩短；最后的空中位移与落地继续，而不是吸到篮框下。
  if (t < .30) return .38 * ease(t / .30);
  if (t < .46) return .38 + .26 * ease((t - .30) / .16);
  if (t < .82) return .64 + .29 * ease((t - .46) / .36);
  return .93 + .07 * ease((t - .82) / .32);
}
export class FinishMotion {
  private plan: FinishPlan | null = null;
  private released = false;
  elapsed = 0;
  get active() { return !!this.plan; }
  start(kind: FinishKind, input: FinishInput) {
    const result = finishEligibility(kind, input); if (!result.allowed || this.active) return { ...result, allowed: false };
    const hoop = result.hoop, front = input.position.z >= hoop.z ? 1 : -1, hand = input.hand >= 0 ? 1 : -1;
    const origin = { x: hoop.x + (kind === "dunk" ? 0 : -hand * .20), y: kind === "dunk" ? 3.34 : 2.82, z: hoop.z + (kind === "dunk" ? 0 : front * .48) };
    const flight = .56;
    // 扣篮只把球向下释放，上篮用真实重力解出短弧；计分继续等待原 BallPhysics 的向下穿框事件。
    const velocity = kind === "dunk" ? { x: 0, y: -2.2, z: 0 } : { x: (hoop.x - origin.x) / flight, y: (hoop.y - origin.y + 9.81 * flight * flight / 2) / flight, z: (hoop.z - origin.z) / flight };
    const length = Math.max(.001, Math.hypot(input.direction.x, input.direction.z));
    const forward = { x: input.direction.x / length, y: 0, z: input.direction.z / length };
    const right = { x: -forward.z, y: 0, z: forward.x };
    const gather = input.ball && [input.ball.x,input.ball.y,input.ball.z].every(Number.isFinite) ? { ...input.ball } : { x: input.position.x + right.x * hand * .22 + forward.x * .36, y: 1.07, z: input.position.z + right.z * hand * .22 + forward.z * .36 };
    this.plan = { kind, start: { ...input.position }, end: { x: hoop.x - hand * (kind === "dunk" ? .20 : .32), y: input.position.y, z: hoop.z + front * (kind === "dunk" ? .23 : .85) }, origin, velocity, hand, duration: 1.48, releaseAt: kind === "dunk" ? .77 : .74, jump: kind === "dunk" ? 1.22 : .72, forward, right, gather };
    this.elapsed = 0; this.released = false; return result;
  }
  cancel() { this.plan = null; }
  advance(rawDelta: number, paused = false): FinishPose | null {
    const plan = this.plan; if (!plan) return null;
    if (!paused) this.elapsed += clamp(Number.isFinite(rawDelta) ? rawDelta : 0, 0, .06);
    const t = this.elapsed, move = progress(t), air = clamp((t - .46) / .62), rise = ease((t - .32) / (plan.releaseAt - .32));
    const position = { x: mix(plan.start.x, plan.end.x, move), y: plan.start.y, z: mix(plan.start.z, plan.end.z, move) };
    const crouch = -.085 * Math.sin(Math.PI * clamp(t / .46));
    const landing = -.09 * Math.sin(Math.PI * clamp((t - 1.08) / .30));
    const jump = t < .46 ? crouch : t < 1.08 ? Math.sin(Math.PI * air) * plan.jump : landing;
    const settle = ease((t - .88) / .48);
    const chest = { x: position.x + plan.right.x * plan.hand * .22 + plan.forward.x * .36, y: 1.23 + Math.max(0, jump) * .55, z: position.z + plan.right.z * plan.hand * .22 + plan.forward.z * .36 };
    const gather = ease(t / .16);
    chest.x = mix(plan.gather.x + position.x - plan.start.x, chest.x, gather);
    chest.y = mix(plan.gather.y, chest.y, gather);
    chest.z = mix(plan.gather.z + position.z - plan.start.z, chest.z, gather);
    const ball = { x: mix(mix(chest.x, plan.origin.x, rise), chest.x, settle), y: mix(mix(chest.y, plan.origin.y, rise), 1.16, settle), z: mix(mix(chest.z, plan.origin.z, rise), chest.z, settle) };
    const foot = (side: number): Vec => {
      let along = side === plan.hand ? -.18 : .13, height = .09;
      if (t < .46) {
        const stepStart = side === plan.hand ? 0 : .25, stepEnd = side === plan.hand ? .28 : .45;
        const step = clamp((t - stepStart) / (stepEnd - stepStart));
        const anchor = mix(progress(stepStart), progress(stepEnd), ease(step));
        const x = mix(plan.start.x, plan.end.x, anchor), z = mix(plan.start.z, plan.end.z, anchor);
        return { x: x + plan.right.x * side * .13 + plan.forward.x * .05, y: height + Math.sin(Math.PI * step) * .12, z: z + plan.right.z * side * .13 + plan.forward.z * .05 };
      }
      if (t < 1.08) { const knee = Math.sin(Math.PI * air); along = side === plan.hand ? .30 * knee : -.16 * knee; height += Math.max(0, jump) + (side === plan.hand ? .40 : .12) * knee; }
      return { x: position.x + plan.right.x * side * .14 + plan.forward.x * along, y: height, z: position.z + plan.right.z * side * .14 + plan.forward.z * along };
    };
    const phase: FinishPhase = t < .13 ? "gather" : t < .30 ? "first-step" : t < .46 ? "plant" : t < plan.releaseAt ? "rise" : t < .90 ? "release" : t < 1.24 ? "land" : "recover";
    const result: FinishPose = { position, jump, ball, kind: plan.kind, phase, elapsed: t, leftFoot: foot(-1), rightFoot: foot(1), torsoPitch: mix(-.16, .055, rise) * (1 - settle), torsoTwist: plan.hand * .11 * Math.sin(Math.PI * clamp((t - .18) / .85)), guide: 1 - ease((t - .48) / .24), wrist: ease((t - plan.releaseAt) / .10) * (1 - settle) };
    if (!paused && !this.released && t >= plan.releaseAt) { result.release = { origin: { ...plan.origin }, velocity: { ...plan.velocity } }; this.released = true; }
    if (!paused && t >= plan.duration) this.plan = null;
    return result;
  }
}
