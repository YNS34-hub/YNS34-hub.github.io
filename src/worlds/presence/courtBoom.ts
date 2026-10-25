import type { Vector3 } from "three";

// 对应现有篮板、斜撑和立柱的保守镜头包围盒；只约束渲染镜头，不改球场或身体碰撞。
const bounds = [-1, 1].flatMap(side => [
  [-1.09, 2.88, Math.min(side * 12.56, side * 12.88), 1.09, 4.31, Math.max(side * 12.56, side * 12.88)],
  [-.28, 2.05, Math.min(side * 12.8, side * 15.9), .28, 3.52, Math.max(side * 12.8, side * 15.9)],
  [-.34, 0, Math.min(side * 15.04, side * 15.76), .34, 3.14, Math.max(side * 15.04, side * 15.76)],
]);

export function limitCourtBoom(eye: Vector3, position: Vector3) {
  const length = eye.distanceTo(position);
  if (length < .001) return false;
  let nearest = 1;
  for (const box of bounds) {
    let enter = 0, exit = 1, inside = true;
    for (let axis = 0; axis < 3; axis++) {
      const origin = eye.getComponent(axis), delta = position.getComponent(axis) - origin;
      const low = box[axis], high = box[axis + 3];
      inside &&= origin >= low && origin <= high;
      if (Math.abs(delta) < .00001) { if (origin < low || origin > high) { exit = -1; break; } }
      else {
        const a = (low - origin) / delta, b = (high - origin) / delta;
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        if (enter > exit) break;
      }
    }
    if (!inside && enter <= exit && enter < nearest) nearest = Math.max(0, enter - .22 / length);
  }
  if (nearest >= 1) return false;
  position.lerpVectors(eye, position, nearest);
  return true;
}
