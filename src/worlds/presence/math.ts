import { Vector3 } from "three";
import type { ViewMode } from "./state";

// 无帧内分配；完整第一人称保留原俯仰，第三人称以水平行进方向建立背后与上方的观看距离。
export function followPose(eye: Vector3, direction: Vector3, view: ViewMode, riding: boolean, position: Vector3, target: Vector3, detail=false) {
  const close=detail&&!riding&&view==='third';
  target.copy(eye).addScaledVector(direction, riding ? 3.2 : close?2.4:4);
  if (view === "first") { position.copy(eye); return; }
  const length = Math.max(.001, Math.hypot(direction.x, direction.z)), back = riding ? 3.4 : close?2.9:4.2;
  position.set(eye.x - direction.x / length * back, eye.y + (riding ? 1 : close?.72:1.15), eye.z - direction.z / length * back);
  // 轻微越肩位置能同时看见车架和前方道路；只影响观看相机，不更改逻辑车身或返回位置。
  if(riding){position.x-=direction.z/length*.55;position.z+=direction.x/length*.55;}
  // 第三人称也必须回应俯仰输入；只调整观看位置，不改变投篮朝向或身体坐标。
  target.y = eye.y + (riding ? -.32 : close?-.55:-.35) + direction.y * (riding ? 1.1 : close?1.1:3.4);
  position.y -= direction.y * 1.3;
}
export function pedalPoint(side: number, phase: number, output: Vector3) {
  return output.set(side * .108, .29 + side * Math.sin(phase) * .16, .08 + side * Math.cos(phase) * .16);
}
