export interface Vec { x: number; y: number; z: number }
export const BALL_RADIUS = 0.12;
export const HOOPS: Vec[] = [{ x: 0, y: 3.05, z: -12.1 }, { x: 0, y: 3.05, z: 12.1 }];
const GRAVITY = 9.81, FIXED_STEP = 1 / 120, RIM_RADIUS = 0.225, RIM_TUBE = 0.009;
export type BallEvent = "bounce" | "rim" | "backboard" | "made" | "missed";
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function shotVelocity(origin: Vec, aim: Vec, charge: number, assist: boolean): Vec {
  const hoop = HOOPS[aim.z > 0 ? 1 : 0];
  const dx = hoop.x - origin.x, dz = hoop.z - origin.z, distance = Math.hypot(dx, dz);
  const alignment = (dx * aim.x + dz * aim.z) / Math.max(0.001, distance * Math.hypot(aim.x, aim.z));
  if (assist && alignment > 0.975 && aim.y > -0.2 && aim.y < 0.8) {
    const time = 1.0 + Math.min(22, distance) * 0.06;
    const releaseError = clamp(charge, 0, 1) - 0.64;
    const error = Math.sign(releaseError) * Math.max(0, Math.abs(releaseError) - .055);
    // 辅助只在真正朝向篮筐时给出抛物线；松手时机改变落点，不自动把所有球判为命中。
    return { x: dx / time + error * distance * 0.25, y: (hoop.y - origin.y + GRAVITY * time * time / 2) / time + error * 2.3, z: dz / time };
  }
  const speed = 4.5 + clamp(charge, 0, 1) * 10;
  const length = Math.max(0.001, Math.hypot(aim.x, aim.y, aim.z));
  return { x: aim.x / length * speed, y: aim.y / length * speed + 3.5, z: aim.z / length * speed };
}

export class BallPhysics {
  position: Vec = { x: 1.5, y: BALL_RADIUS, z: 6 };
  velocity: Vec = { x: 0, y: 0, z: 0 };
  mode: "ground" | "held" | "flight" = "ground";
  stats = { shots: 0, made: 0, streak: 0 };
  elapsed = 0;
  private resolved = true;
  private accumulator = 0;
  private contactAt = { rim: -100, backboard: -100 };
  launch(origin: Vec, velocity: Vec) {
    Object.assign(this.position, origin); Object.assign(this.velocity, velocity);
    this.mode = "flight"; this.stats.shots++; this.elapsed = 0; this.resolved = false;
    this.accumulator = 0; this.contactAt = { rim: -100, backboard: -100 };
  }
  pickup() { if (!this.resolved) this.stats.streak = 0; this.mode = "held"; this.velocity = { x: 0, y: 0, z: 0 }; this.resolved = true; }
  recall(position: Vec) {
    // 召回不重置计分；尚未落地的尝试按一次未中结束，避免刷掉失败记录。
    if (!this.resolved) { this.resolved = true; this.stats.streak = 0; }
    Object.assign(this.position, { x: clamp(position.x, -11.7, 11.7), y: BALL_RADIUS, z: clamp(position.z, -17.7, 17.7) }); this.velocity = { x: 0, y: 0, z: 0 }; this.mode = "ground";
  }
  step(rawDelta: number): BallEvent[] {
    const events: BallEvent[] = [];
    if (this.mode === "held") return events;
    this.accumulator += clamp(Number.isFinite(rawDelta) ? rawDelta : 0, 0, 0.1);
    // 固定步长最多 12 次；切换页签或低帧率不会让物理产生无界追帧。
    while (this.accumulator + 1e-9 >= FIXED_STEP) {
      this.accumulator -= FIXED_STEP; this.elapsed += FIXED_STEP;
      const p = this.position, v = this.velocity;
      const oldY = p.y, oldX = p.x, oldZ = p.z;
      p.x += v.x * FIXED_STEP; p.y += v.y * FIXED_STEP - GRAVITY * FIXED_STEP * FIXED_STEP / 2; p.z += v.z * FIXED_STEP;
      v.y -= GRAVITY * FIXED_STEP;
      for (const hoop of HOOPS) {
        const boardZ = Math.sign(hoop.z) * 12.72;
        const boardSide = Math.sign(hoop.z);
        if (Math.abs(p.x) < 0.9 + BALL_RADIUS && p.y > 2.8 && p.y < 4.18 &&
          (oldZ - boardZ) * boardSide < -BALL_RADIUS && (p.z - boardZ) * boardSide >= -BALL_RADIUS) {
          p.z = boardZ - boardSide * (BALL_RADIUS + 0.003); v.z = -v.z * 0.68;
          if (this.elapsed - this.contactAt.backboard > 0.12) { events.push("backboard"); this.contactAt.backboard = this.elapsed; }
        }
        const dx = p.x - hoop.x, dz = p.z - hoop.z, radial = Math.hypot(dx, dz);
        const ringX = hoop.x + (radial > 1e-6 ? dx / radial : 1) * RIM_RADIUS;
        const ringZ = hoop.z + (radial > 1e-6 ? dz / radial : 0) * RIM_RADIUS;
        let nx = p.x - ringX, ny = p.y - hoop.y, nz = p.z - ringZ;
        const contactDistance = Math.hypot(nx, ny, nz), sum = BALL_RADIUS + RIM_TUBE;
        if (contactDistance < sum && contactDistance > 1e-6) {
          nx /= contactDistance; ny /= contactDistance; nz /= contactDistance;
          p.x = ringX + nx * sum; p.y = hoop.y + ny * sum; p.z = ringZ + nz * sum;
          const impact = v.x * nx + v.y * ny + v.z * nz;
          if (impact < 0) { v.x -= 1.64 * impact * nx; v.y -= 1.64 * impact * ny; v.z -= 1.64 * impact * nz; }
          if (this.elapsed - this.contactAt.rim > 0.12) { events.push("rim"); this.contactAt.rim = this.elapsed; }
        }
        if (!this.resolved && oldY > hoop.y && p.y <= hoop.y && v.y < 0) {
          const mix = (oldY - hoop.y) / (oldY - p.y);
          const crossX = oldX + (p.x - oldX) * mix, crossZ = oldZ + (p.z - oldZ) * mix;
          if (Math.hypot(crossX - hoop.x, crossZ - hoop.z) < RIM_RADIUS - BALL_RADIUS - 0.005) {
            this.resolved = true; this.stats.made++; this.stats.streak++;
            events.push("made"); v.x *= 0.45; v.z *= 0.45;
          }
        }
      }
      if (p.y <= BALL_RADIUS) {
        const impact = Math.abs(v.y);
        p.y = BALL_RADIUS; v.y = impact > 0.8 ? impact * 0.65 : 0;
        v.x *= 0.87; v.z *= 0.87;
        if (impact > 0.8) events.push("bounce");
        if (!this.resolved && this.elapsed > 0.12) {
          this.resolved = true; this.stats.streak = 0; events.push("missed");
        }
        if (Math.hypot(v.x, v.z) < 0.03 && v.y === 0) { v.x = v.z = 0; this.mode = "ground"; }
      }
      for (const axis of ["x", "z"] as const) {
        const bound = axis === "x" ? 11.7 : 17.7;
        if (Math.abs(p[axis]) > bound) { p[axis] = clamp(p[axis], -bound, bound); v[axis] *= -0.62; }
      }
    }
    return events;
  }
}
