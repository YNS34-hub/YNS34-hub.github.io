import type { WallpaperItem } from "../content/types";
export type Vector = [number, number, number];
export interface ArtPlacement {
  id: string;
  position: Vector;
  rotation: Vector;
  width: number;
  height: number;
}
export function orderedWorks<
  T extends {
    id: string;
    primary?: boolean;
    order?: number;
    removed?: boolean;
  },
>(items: T[]): T[] {
  return items
    .filter((x) => !x.removed)
    .slice()
    .sort(
      (a, b) =>
        Number(!!b.primary) - Number(!!a.primary) ||
        (a.order || 0) - (b.order || 0) ||
        a.id.localeCompare(b.id),
    );
}
/** A dominant view and staggered freestanding planes. Frame size follows the work's actual proportions. */
export function imageLayout(
  items: WallpaperItem[],
  intimate = false,
  editorial = false,
): ArtPlacement[] {
  return orderedWorks(items)
    .slice(0, 5)
    .map((work, i) => {
      const aspect =
        work.width && work.height ? work.width / work.height : 16 / 9;
      const limitW = i === 0 ? (intimate ? 7 : 18) : intimate ? 4.8 : 7,
        limitH = i === 0 ? (intimate ? 5.4 : 9.5) : intimate ? 5.2 : 6;
      const width = Math.min(limitW, limitH * aspect),
        height = width / aspect;
      const positions: Vector[] = intimate
        ? [
            [0, height / 2 + 0.9, -9],
            [-7, height / 2 + 0.9, 1],
            [7, height / 2 + 0.9, -2],
            [-6, height / 2 + 0.9, -7],
            [7, height / 2 + 0.9, 6],
          ]
        : [
            [0, height / 2 + 0.75, -12],
            [-9, height / 2 + 0.75, 3],
            [9, height / 2 + 0.75, -1],
            [-9, height / 2 + 0.75, -9],
            [9, height / 2 + 0.75, 8],
          ];
      return {
        id: work.id,
        position: editorial
          ? ([
              [-2.8, height / 2 + 0.9, -10.5],
              [-8, height / 2 + 0.9, 3],
              [7.5, height / 2 + 0.9, -4],
              [-7, height / 2 + 0.9, -5],
              [6.5, height / 2 + 0.9, 8],
            ][i] as Vector)
          : positions[i],
        rotation: [0, i === 0 ? 0 : i % 2 ? 0.42 : -0.42, 0],
        width,
        height,
      };
    });
}
export function corridorProfile(chunk: number) {
  const phase = ((-chunk % 6) + 6) % 6;
  return {
    phase,
    halfWidth: [3.65, 2.65, 5.7, 4.2, 3.65, 6.4][phase],
    height: [7.2, 4.5, 13.4, 9.2, 6.2, 11.2][phase],
    wellX: phase === 3 ? 2.1 : 0,
    nicheSide: chunk % 2 === 0 ? -1 : 1,
  };
}
export function corridorClearWidth(z: number) {
  const chunk = Math.floor(z / 22),
    local = z - chunk * 22,
    profile = corridorProfile(chunk);
  // A short common throat joins different cross-sections without a step or pinch.
  const fade = Math.max(0, Math.min(1, Math.min(local, 22 - local) / 3));
  return 2.65 + (profile.halfWidth - 2.65) * fade;
}
