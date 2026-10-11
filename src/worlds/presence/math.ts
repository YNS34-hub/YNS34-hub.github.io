import { Vector3 } from "three";
import type { ViewMode } from "./state";

// 无帧内分配；完整第一人称保留原俯仰，第三人称以水平行进方向建立背后与上方的观看距离。
export function followPose(eye: Vector3, direction: Vector3, view: ViewMode, riding: boolean, position: Vector3, target: Vector3) {
  target.copy(eye).addScaledVector(direction, riding ? 4 : 5);
  if (view === "first") { position.copy(eye); return; }
  const length = Math.max(.001, Math.hypot(direction.x, direction.z)), back = riding ? 4.4 : 5.6;
  position.set(eye.x - direction.x / length * back, eye.y + (riding ? 1.5 : 2.4), eye.z - direction.z / length * back);
  // 第三人称也必须回应俯仰输入；只调整观看位置，不改变投篮朝向或身体坐标。
  target.y = eye.y + (riding ? -.2 : .15) + direction.y * (riding ? 1.1 : 3.4);
  position.y -= direction.y * 1.3;
}
export function pedalPoint(side: number, phase: number, output: Vector3) {
  return output.set(side * .108, .29 + side * Math.sin(phase) * .16, .08 + side * Math.cos(phase) * .16);
}
