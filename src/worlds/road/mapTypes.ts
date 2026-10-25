import type { Vector3 } from "three";

// 两张地图共享原骑行器与物理规则，只有地理、章节和存档命名空间不同。
export interface RideMap {
  id: "cycling" | "alpine-ride";
  title: string;
  subtitle: string;
  sceneName: string;
  saveKey: string;
  length: number;
  sample: (distance: number, point: Vector3, tangent: Vector3) => void;
  ground: (x: number, z: number) => number;
  chapter: (distance: number) => string;
  forest: (progress: number) => number;
  water: (x: number, z: number) => number;
  stops: { distance: number; title: string }[];
  sectors: (distance: number) => number[];
}
