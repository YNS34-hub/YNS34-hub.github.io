import { Color, Vector3 } from "three";
export const imageAtmospheres = new Map<
  string,
  { position: Vector3; color: Color }
>();
/** Mounted images own their entries. Sampling does not update React or Zustand. */
export function nearestImageAtmosphere(position: Vector3) {
  let nearest = 13;
  let color: Color | undefined;
  for (const entry of imageAtmospheres.values()) {
    const distance = position.distanceTo(entry.position);
    if (distance < nearest) {
      nearest = distance;
      color = entry.color;
    }
  }
  return color;
}
