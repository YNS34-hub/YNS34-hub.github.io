import type { Camera } from "three";
import type { Footprint } from "../world/collision";

export const isWorldScene = (id: string) => id === "worlds" || id === "basketball" || id === "cycling";
export function worldBounds(id: string): [number, number, number, number] | undefined {
  if (id === "basketball") return [-11.5, 11.5, -17.4, 17.4];
  if (id === "worlds") return [-12, 12, -13, 15.6];
}
export function worldFootprints(id: string): Footprint[] | undefined {
  if (id === "basketball") return [
    ...[-1, 1].map(side => ({ x: 0, z: side * 14.8, halfWidth: .55, halfDepth: 1.6 })),
    ...[-1, 1].flatMap(side => [-5, 5].map(z => ({ x: side * 10.2, z, halfWidth: .85, halfDepth: 2.1 }))),
  ];
  if (id === "worlds") return [];
}
export function setWorldView(camera: Camera, roomId: string) {
  if (roomId === "basketball") { camera.position.set(2, 1.65, 9); camera.lookAt(0, 2.4, -12.1); }
  if (roomId === "worlds") { camera.position.set(0, 1.65, 12.5); camera.lookAt(0, 3.2, -10); }
}
