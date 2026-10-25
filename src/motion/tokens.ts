// 动效只管理呈现时间，不拥有导航、音频或收藏状态；与 motion.css 的时长保持一致。
export const motionTime = Object.freeze({
  feedback: 120,
  copy: 260,
  enter: 360,
  exit: 180,
  hero: 600,
  lyric: 640,
  threshold: 420,
  layout: 480,
  scene: 820,
  cinematic: 1200,
});
export const motionEase = Object.freeze({
  enter: "cubic-bezier(0.16, 1, 0.3, 1)",
  settle: "cubic-bezier(0.22, 0.68, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  cinematic: "cubic-bezier(0.65, 0, 0.35, 1)",
});

// 限制暂停后台后的大 dt；指数包络在不同帧率下有相同的响应时间，不制造节拍。
export function settleMotion(current: number, target: number, dt: number, attack = 0.18, release = 0.5) {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  const tau = target > current ? attack : release;
  return current + (target - current) * (1 - Math.exp(-Math.min(dt, 0.1) / Math.max(tau, 0.001)));
}
export function measuredEnergy(value: number) {
  const x = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return x * x * (3 - 2 * x);
}
export function revealProgress(elapsed: number, duration: number) {
  const x = Math.max(0, Math.min(1, elapsed / Math.max(duration, 0.001)));
  return 1 - (1 - x) ** 3;
}
