import { describe, expect, it } from "vitest";
import { BallPhysics, HOOPS, shotVelocity } from "../src/worlds/basketballPhysics";

const aim = { x: 0, y: 0.15, z: -1 };
describe("bounded basketball practice physics", () => {
  it("scores a downward clean release once and keeps a finite real trajectory", () => {
    const ball = new BallPhysics();
    const from = { x: 0, y: 1.5, z: -5 };
    ball.launch(from, shotVelocity(from, aim, 0.64, true));
    let made = 0, bounce = 0;
    for (let i = 0; i < 600; i++) {
      const events = ball.step(1 / 120);
      made += events.filter(e => e === "made").length;
      bounce += events.filter(e => e === "bounce").length;
      expect(Number.isFinite(ball.position.y)).toBe(true);
      expect(ball.position.y).toBeGreaterThanOrEqual(0.119);
    }
    expect(made).toBe(1); expect(bounce).toBeGreaterThan(0);
    expect(ball.stats).toMatchObject({ shots: 1, made: 1, streak: 1 });
  });
  it("never scores an upward crossing or a ball outside the inner rim", () => {
    for (const x of [0, 0.5]) {
      const ball = new BallPhysics();
      ball.launch({ x, y: HOOPS[0].y - 0.3, z: HOOPS[0].z }, { x: 0, y: 3, z: 0 });
      expect(ball.step(0.06)).not.toContain("made");
    }
  });
  it("misses exactly once, resets streak and can recall without resetting scores", () => {
    const ball = new BallPhysics();
    ball.stats.streak = 3;
    ball.launch({ x: 5, y: 1, z: 0 }, { x: 1, y: 0, z: 1 });
    let misses = 0;
    for (let i = 0; i < 400; i++) misses += ball.step(1 / 120).filter(e => e === "missed").length;
    expect(misses).toBe(1); expect(ball.stats.streak).toBe(0);
    ball.recall({ x: 2, y: 0.12, z: 4 });
    expect(ball.stats.shots).toBe(1); expect(ball.mode).toBe("ground");
  });
  it("responds to the actual backboard and rim with contact events", () => {
    const board = new BallPhysics();
    board.launch({ x: 0.5, y: 3.6, z: -12.2 }, { x: 0, y: 0, z: -4 });
    const events: string[] = [];
    for (let i = 0; i < 30; i++) events.push(...board.step(1 / 120));
    expect(events).toContain("backboard"); expect(board.velocity.z).toBeGreaterThan(0);
    const rim = new BallPhysics();
    rim.launch({ x: 0.22, y: 3.3, z: HOOPS[0].z }, { x: 0, y: -2, z: 0 });
    const hits: string[] = [];
    for (let i = 0; i < 15; i++) hits.push(...rim.step(1 / 120));
    expect(hits).toContain("rim");
  });
  it("clamps long frames and keeps walls/floor closed without unbounded substeps", () => {
    const ball = new BallPhysics();
    ball.launch({ x: 11, y: 2, z: 17 }, { x: 100, y: -100, z: 100 });
    ball.step(60);
    expect(ball.position.x).toBeLessThanOrEqual(11.7);
    expect(ball.position.z).toBeLessThanOrEqual(17.7);
    expect(ball.position.y).toBeGreaterThanOrEqual(0.119);
    expect(ball.elapsed).toBeLessThanOrEqual(0.11);
  });
});
