import { Vector3 } from "three";

export type BikeStyle = "city" | "road";
export function gripPoint(style: BikeStyle, side: number, steer: number, result: Vector3) {
  result.set(side * (style === "city" ? .265 : .21), style === "city" ? .285 : .09, style === "city" ? -.02 : -.28);
  const x = result.x, z = result.z, angle = steer * .5;
  result.x = x * Math.cos(angle) + z * Math.sin(angle); result.z = z * Math.cos(angle) - x * Math.sin(angle);
  result.y += .90; result.z -= .39; return result;
}
export function riderPosture(style: BikeStyle, effort: number, brake: number, phase: number, comfort: boolean) {
  const active = Math.max(0, Math.min(1, effort)), braking = Math.max(0, Math.min(1, brake));
  return { spine: (style === "city" ? -.38 : -.75) - active * .025 + braking * .035,
    spine1: style === "city" ? -.045 : -.085, head: (style === "city" ? .37 : .69) + active * .018,
    hipShift: comfort ? 0 : Math.sin(phase) * .006 * active,
    ankle: comfort ? 0 : Math.sin(phase - .25) * .055 * active,
    eyeOffset: style === "city" ? .085 : 0 };
}
