// 只计算呈现，不推进播放器、导航或物理状态；快速切换和减少动态共享同一套边界。
export type ImageTransition = "related" | "landscape" | "portrait" | "room-tone";
export function imageTransition(previous: { category?: string; width?: number; height?: number } | undefined, next: { category?: string; width?: number; height?: number }): ImageTransition {
  if (!previous) return "room-tone";
  if (previous.category && previous.category === next.category) return "related";
  const portrait = (item: typeof next) => !!item.width && !!item.height && item.height > item.width;
  if (portrait(previous) && portrait(next)) return "portrait";
  if (previous.width && next.width && !portrait(previous) && !portrait(next)) return "landscape";
  return "room-tone";
}

export function nearbyRank(distance: number, dot: number, radius: number) {
  // 侧后方不抢占唯一的近距离提示，仍由原射线确认实际可见性。
  if (!Number.isFinite(distance) || !Number.isFinite(dot) || radius <= 0 || distance >= radius || dot < .65) return Infinity;
  return distance / radius + (1 - dot) * 2;
}

export function boundedProgress(progress: number, duration: number) {
  return Number.isFinite(progress) && Number.isFinite(duration) && duration > 0 ? Math.max(0, Math.min(1, progress / duration)) : 0;
}

export function dribblePresentation(phase: number, quiet = false) {
  const p = ((phase % 1) + 1) % 1;
  // 落地前后只压缩视觉球壳，碰撞半径和原抛物线完全不变。
  const contact = quiet ? 0 : Math.max(0, 1 - Math.min(p, 1 - p) / .075);
  return { y: 1 - contact * .045, xz: 1 + contact * .0225 };
}
