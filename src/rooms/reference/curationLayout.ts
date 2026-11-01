import type { ArtPlacement, Vector } from "../../world/spatialLayout";

// 顺序由素材库和分页负责；布局不能重新排序后再用原数组索引绑定作品。
export function archiveLayout(items: { id: string; width?: number; height?: number }[]): ArtPlacement[] {
  const walls: Vector[] = [[-6, 3.8, -16.15], [-13.25, 3.8, -6], [13.25, 3.8, -6], [-13.25, 3.8, 6], [13.25, 3.8, 6]];
  return items.slice(0, 5).map((item, i) => {
    const ratio = (item.width || 0) / (item.height || 0);
    const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
    const width = Math.min(i === 0 ? 7.5 : 5.4, (i === 0 ? 5.4 : 4) * aspect);
    return { id: item.id, position: [...walls[i]], rotation: [0, i === 0 ? 0 : i % 2 ? Math.PI / 2 : -Math.PI / 2, 0], width, height: width / aspect };
  });
}
