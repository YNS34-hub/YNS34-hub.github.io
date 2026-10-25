import { CatmullRomCurve3, Vector3, Euler, type Camera } from "three";

export const route = new CatmullRomCurve3([
  [0, 1, 35], [5, 1.2, 5], [2, 1.7, -22], [13, 2.4, -42], [44, 3.7, -70],
  [82, 5.5, -82], [113, 8, -60], [125, 12, -28], [112, 14, 12], [81, 16, 34],
  [48, 20, 57], [23, 22, 78], [3, 20, 108], [-25, 10, 94], [-55, 5, 58],
  [-43, 2, 17], [-14, 1, 35],
].map(p => new Vector3(...p)), true, "centripetal");
route.arcLengthDivisions = 1200;
export const routeLength = route.getLength();
export const stopDistances = [.27, .52, .74].map(t => t * routeLength);
export function routePhase(t: number) {
  return t < .17 ? "FOREST ENTRY" : t < .39 ? "LAKE OPENING" : t < .63 ? "VALLEY GLOW" : t < .82 ? "THE OVERLOOK" : "HOME THROUGH THE TREES";
}
export function shortestHeading(previous: number, target: number) {
  return previous + Math.atan2(Math.sin(target - previous), Math.cos(target - previous));
}
export interface RideInput { pedal?: boolean; slow?: boolean; brake?: boolean; cruise?: boolean; blocked?: boolean }
export class RidePhysics {
  distance = 0; speed = 0; stopAt: number | null = null; atViewpoint = false;
  resume() { this.atViewpoint = false; }
  step(rawDelta: number, input: RideInput) {
    if (input.blocked) return;
    if (this.atViewpoint) { if (input.pedal) this.resume(); else return; }
    const dt = Math.max(0, Math.min(.06, Number.isFinite(rawDelta) ? rawDelta : 0));
    let target = input.brake ? 0 : input.slow ? 1.5 : input.pedal ? 9 : input.cruise ? 5.6 : 0;
    let remaining = Infinity;
    if (this.stopAt !== null) {
      remaining = Math.max(0, this.stopAt - this.distance);
      target = Math.min(target, Math.sqrt(remaining * 5));
    }
    const limit = (target < this.speed ? input.brake ? 6 : 3 : 1.65) * dt;
    this.speed += Math.max(-limit, Math.min(limit, target - this.speed));
    if (this.speed < .015) this.speed = 0;
    const travel = this.speed * dt;
    if (travel >= remaining || (remaining < .22 && this.speed < 1.2)) {
      // 只校正最后 22 cm；不会将骑手传送到远处观景点。
      this.distance = this.stopAt!; this.speed = 0; this.stopAt = null; this.atViewpoint = true;
    } else this.distance += travel;
    if (this.distance >= routeLength) this.distance %= routeLength;
  }
}
export function readRideDistance() {
  try {
    const value = JSON.parse(localStorage.getItem("memory-palace:ride:v1") || "null")?.distance;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < routeLength ? value : 0;
  } catch { return 0; }
}
export function saveRideDistance(distance: number) {
  try { localStorage.setItem("memory-palace:ride:v1", JSON.stringify({ distance })); } catch { /* 无存储权限仍可完整骑行。 */ }
}
export const cyclingView = { yaw: 0, baseYaw: 0, distance: 0, speed: 0 };
const look = new Euler(0, 0, 0, "YXZ");
export function applyCyclingLook(camera: Camera, userAngle: Euler) {
  look.copy(userAngle); look.y += cyclingView.yaw - cyclingView.baseYaw;
  camera.quaternion.setFromEuler(look);
}
