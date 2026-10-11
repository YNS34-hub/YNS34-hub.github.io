import { HOOPS, type Vec } from "../basketballPhysics";

export type FinishKind = "layup" | "dunk";
export interface FinishInput { held: boolean; position: Vec; direction: Vec; speed: number; hand: number }
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const ease = (t: number) => { const s = clamp(t); return s * s * (3 - 2 * s); };
export function finishEligibility(kind: FinishKind, input: FinishInput) {
  const hoop = HOOPS.reduce((closest, candidate) => Math.hypot(candidate.x - input.position.x, candidate.z - input.position.z) < Math.hypot(closest.x - input.position.x, closest.z - input.position.z) ? candidate : closest);
  const dx = hoop.x - input.position.x, dz = hoop.z - input.position.z, distance = Math.hypot(dx, dz);
  const facing = (dx * input.direction.x + dz * input.direction.z) / Math.max(.001, distance * Math.hypot(input.direction.x, input.direction.z));
  const behindBoard=input.position.z*Math.sign(hoop.z)>Math.abs(hoop.z)+.15;
  const reason = !input.held ? "Pick up the ball first" : distance > (kind === "dunk" ? 2.8 : 3.4) ? "Move closer to the rim" : behindBoard ? "Approach from the court side of the backboard" : facing < .55 ? "Face the rim" : kind === "dunk" && input.speed < 2.2 ? "Build a run-up · Shift + W" : "";
  return { allowed: !reason, reason, hoop, distance };
}
interface FinishPlan { kind: FinishKind; start: Vec; end: Vec; origin: Vec; velocity: Vec; duration: number; releaseAt: number; jump: number; hand: number }
export interface FinishPose { position: Vec; jump: number; ball: Vec; kind: FinishKind; release?: { origin: Vec; velocity: Vec } }
export class FinishMotion {
  private plan: FinishPlan | null = null;
  private released = false;
  elapsed = 0;
  get active() { return !!this.plan; }
  start(kind: FinishKind, input: FinishInput) {
    const result = finishEligibility(kind, input); if (!result.allowed || this.active) return { ...result, allowed: false };
    const hoop = result.hoop, front = input.position.z >= hoop.z ? 1 : -1, hand = input.hand >= 0 ? 1 : -1;
    const origin = { x: hoop.x + (kind === "dunk" ? 0 : -hand * .20), y: kind === "dunk" ? 3.34 : 2.74, z: hoop.z + (kind === "dunk" ? 0 : front * .65) };
    const flight = .56;
    // 扣篮只把球向下释放，上篮用真实重力解出短弧；计分继续等待原 BallPhysics 的向下穿框事件。
    const velocity = kind === "dunk" ? { x: 0, y: -2.2, z: 0 } : { x: (hoop.x - origin.x) / flight, y: (hoop.y - origin.y + 9.81 * flight * flight / 2) / flight, z: (hoop.z - origin.z) / flight };
    this.plan = { kind, start: { ...input.position }, end: { x: hoop.x - hand * (kind === "dunk" ? .20 : .32), y: input.position.y, z: hoop.z + front * (kind === "dunk" ? .20 : .85) }, origin, velocity, hand, duration: kind === "dunk" ? 1.2 : 1.08, releaseAt: kind === "dunk" ? .62 : .48, jump: kind === "dunk" ? 1.22 : .72 };
    this.elapsed = 0; this.released = false; return result;
  }
  cancel() { this.plan = null; }
  advance(rawDelta: number, paused = false): FinishPose | null {
    const plan = this.plan; if (!plan) return null;
    if (!paused) this.elapsed += clamp(Number.isFinite(rawDelta) ? rawDelta : 0, 0, .06);
    const t = this.elapsed, move = ease((t - .10) / (plan.releaseAt - .10)), flight = clamp((t - .16) / .92);
    const position = { x: plan.start.x + (plan.end.x - plan.start.x) * move, y: plan.start.y, z: plan.start.z + (plan.end.z - plan.start.z) * move };
    const rise = ease((t - .18) / (plan.releaseAt - .18));
    const ball = { x: position.x + plan.hand * .30 * (1 - rise) + (plan.origin.x - position.x) * rise, y: 1.08 + (plan.origin.y - 1.08) * rise, z: position.z + (plan.origin.z - position.z) * rise };
    const result: FinishPose = { position, jump: Math.sin(Math.PI * flight) * plan.jump, ball, kind: plan.kind };
    if (!paused && !this.released && t >= plan.releaseAt) { result.release = { origin: { ...plan.origin }, velocity: { ...plan.velocity } }; this.released = true; }
    if (!paused && t >= plan.duration) this.plan = null;
    return result;
  }
}
