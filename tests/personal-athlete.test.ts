import { describe, expect, it } from "vitest";
import { FinishMotion } from "../src/worlds/court/finishing";
import { isPrimaryShotKey, isCourtTurboKey, primaryCourtAction } from "../src/worlds/court/controls";
import { prepareShot, shotRecovery } from "../src/worlds/presence/shotPose";
import { BallPhysics } from "../src/worlds/basketballPhysics";

const input = { held: true, position: { x: -.35, y: 1.65, z: -9.7 }, direction: { x: 0, y: .1, z: -1 }, speed: 5, hand: 1 };
describe("personal basketball control and footwork", () => {
  it("supports both 5 locations and both Enter locations without borrowing music keys", () => {
    for (const key of ["Digit5", "Numpad5"]) expect(isPrimaryShotKey(key)).toBe(true);
    for (const key of ["Enter", "NumpadEnter", "ShiftLeft", "ShiftRight"]) expect(isCourtTurboKey(key)).toBe(true);
    expect(isPrimaryShotKey("Space")).toBe(false); expect(isCourtTurboKey("KeyE")).toBe(false);
  });
  it("selects a layup near the rim, running dunk with turbo, and jump shot outside / behind the board", () => {
    expect(primaryCourtAction(input, false)).toBe("layup"); expect(primaryCourtAction(input, true)).toBe("dunk");
    expect(primaryCourtAction({ ...input, position: { x: 0, y: 1.65, z: 0 } }, true)).toBe("shoot");
    expect(primaryCourtAction({ ...input, position: { x: 0, y: 1.65, z: -14 } }, true)).toBe("shoot");
    expect(primaryCourtAction({ ...input, direction: { x: 0, y: 0, z: 1 } }, false)).toBe("shoot");
  });
  it("stages gather, two distinct contacts, airborne extension and grounded recovery", () => {
    const motion = new FinishMotion(); motion.start("layup", input);
    const phases = new Set<string>(); let lift = 0, raisedKnee = false, lastJump = 0;
    for (let t = 0; t < 1.5; t += 1 / 120) {
      const pose = motion.advance(1 / 120); if (!pose) continue;
      phases.add(pose.phase); lift = Math.max(lift, pose.jump); lastJump = pose.jump;
      if (pose.phase === "rise" && pose.rightFoot.y > pose.leftFoot.y + .10) raisedKnee = true;
      expect([pose.position.x, pose.ball.y, pose.jump, pose.leftFoot.y, pose.rightFoot.y].every(Number.isFinite)).toBe(true);
    }
    expect([...phases]).toEqual(["gather", "first-step", "plant", "rise", "release", "land", "recover"]);
    expect(lift).toBeGreaterThan(.69); expect(raisedKnee).toBe(true); expect(lastJump).toBeCloseTo(0);
  });
  it("begins gathering at the actual held / dribbling ball position without snapping it to the chest", () => {
    const ball = { x:input.position.x+.31,y:.40,z:input.position.z-.40 }, motion = new FinishMotion();
    motion.start("layup",{...input,ball}); const initial=motion.advance(0,true)!.ball;
    expect(initial.x).toBeCloseTo(ball.x,10); expect(initial.y).toBeCloseTo(ball.y,10); expect(initial.z).toBeCloseTo(ball.z,10);
    const next=motion.advance(1/120)!; expect(Math.abs(next.ball.y-ball.y)).toBeLessThan(.02);
    expect(Math.hypot(next.ball.x-ball.x,next.ball.z-ball.z)).toBeLessThan(.02);
  });
  for (const kind of ["layup", "dunk"] as const) it(`${kind} still releases only once and lets actual gravity / rim crossing score`, () => {
    const motion = new FinishMotion(), ball = new BallPhysics(); motion.start(kind, input); ball.pickup(); let count = 0;
    for (let t = 0; t < 3; t += 1 / 120) { const p = motion.advance(1 / 120); if (p?.release) { count++; ball.launch(p.release.origin, p.release.velocity); expect(ball.stats.made).toBe(0); } ball.step(1 / 120); }
    expect(count).toBe(1); expect(ball.stats.shots).toBe(1); expect(ball.stats.made).toBe(1);
  });
  it("settles late holds and pause / recovery rather than hovering indefinitely", () => {
    expect(prepareShot(.64).jump).toBeGreaterThan(.28); expect(prepareShot(1).jump).toBeCloseTo(0);
    expect(shotRecovery(0, .3).jump).toBeCloseTo(0); expect(shotRecovery(.65, .3).jump).toBeCloseTo(.3);
    const m = new FinishMotion(); m.start("dunk", input); m.advance(.06); const before = m.advance(0, true);
    for (let i = 0; i < 20; i++) expect(m.advance(.06, true)).toEqual(before);
    m.cancel(); expect(m.advance(.06)).toBeNull();
  });
});
