import { Vector3 } from "three";
export const walkTarget = new Vector3();
export let hasWalkTarget = false;
export function setWalkTarget(point: Vector3) {
  walkTarget.set(point.x, 1.65, point.z);
  hasWalkTarget = true;
}
export function clearWalkTarget() {
  hasWalkTarget = false;
}
