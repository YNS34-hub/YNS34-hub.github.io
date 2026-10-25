export interface Dwell { id: string; seconds: number }

export function attentionSample(distance: number, dot: number, radius: number) {
  if (!Number.isFinite(distance) || radius <= 0 || distance >= radius)
    return { proximity: 0, gaze: false };
  return { proximity: Math.max(0, 1 - distance / radius), gaze: dot > 0.965 };
}

// 连续注视才积累时间；切换对象、遮挡、开面板都会重新开始，后台长帧不能直接越过门槛。
export function advanceDwell(previous: Dwell, id: string, dt: number): Dwell {
  return { id, seconds: id ? (previous.id === id ? previous.seconds : 0) + Math.min(0.12, Math.max(0, dt)) : 0 };
}
