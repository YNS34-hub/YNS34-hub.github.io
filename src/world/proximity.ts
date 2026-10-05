import type { Object3D } from "three";
interface Nearby {
  object: Object3D;
  title: string;
  radius: number;
}
export const proximity = new Map<string, Nearby>();
export function registerProximity(
  id: string,
  object: Object3D,
  title: string,
  radius: number,
) {
  proximity.set(id, { object, title, radius });
  return () => {
    proximity.delete(id);
  };
}
