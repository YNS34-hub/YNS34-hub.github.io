import type { WallpaperItem } from "../../content/types";
import type { Footprint } from "../../world/collision";
import { worksForRoom } from "../../systems/mediaPlacement";
import { imageLayout } from "../../world/spatialLayout";

export function imageWallFootprints(roomId: string, photos: WallpaperItem[]): Footprint[] {
  const base = roomId.split("-page-")[0];
  // 档案画作现在贴墙，位于既有房间边界外；不能再生成旧中央独立展板的碰撞体。
  if (!["portraits", "editorial"].includes(base)) return [];
  const page = Math.max(0, (Number(roomId.split("-page-")[1]) || 1) - 1);
  return imageLayout(worksForRoom(photos, base).slice(page * 5, page * 5 + 5), true, base === "editorial").map(p => ({
    x: p.position[0], z: p.position[2] - .3,
    halfWidth: Math.abs(Math.cos(p.rotation[1])) * (p.width + .65) / 2 + .6,
    halfDepth: Math.abs(Math.sin(p.rotation[1])) * (p.width + .65) / 2 + .6,
  }));
}
