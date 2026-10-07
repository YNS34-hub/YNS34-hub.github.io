import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { usePalaceStore } from "../systems/store";
import { motionEase, motionTime } from "./tokens";

const systemReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeReduced = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
export function useQuietMotion() {
  const setting = usePalaceStore(s => s.reducedMotion);
  const system = useSyncExternalStore(subscribeReduced, systemReduced, () => false);
  return setting || system;
}
const cues = {
  identity: { duration: motionTime.copy, frames: [{ opacity: 0.82 }, { opacity: 1 }] },
  hero: { duration: motionTime.hero, frames: [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }] },
  copy: { duration: motionTime.copy, frames: [{ opacity: 0.55, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }] },
  threshold: { duration: motionTime.threshold, frames: [{ opacity: 0.45, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }] },
} satisfies Record<string, { duration: number; frames: Keyframe[] }>;
export type MotionCue = keyof typeof cues;

// 原 DOM 不拆卸、不延迟事件和焦点；动画结束/取消后恢复原样式，快速切换会撤销上一条 cue。
export function useMotionCue<T extends HTMLElement>(key: string | number | null, cue: MotionCue, enabled = true, delay = 0) {
  const ref = useRef<T>(null);
  const quiet = useQuietMotion();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node?.animate || !enabled || quiet || document.visibilityState === "hidden") return;
    const preset = cues[cue];
    const animation = node.animate(preset.frames, {
      // 延迟期间保持起始帧，避免先显示后淡入；结束后不保留行内样式。
      duration: preset.duration, delay, easing: motionEase.enter, fill: "backwards",
    });
    animation.id = "palace:" + cue;
    const visibility = () => { if (document.visibilityState === "hidden") animation.cancel(); };
    const settled = () => document.removeEventListener("visibilitychange", visibility);
    document.addEventListener("visibilitychange", visibility);
    // 一次性 cue 归位后立即卸下监听；取消、快速切换与组件卸载也共享同一清理路径。
    animation.addEventListener("finish", settled, { once: true });
    animation.addEventListener("cancel", settled, { once: true });
    return () => {
      animation.removeEventListener("finish", settled);
      animation.removeEventListener("cancel", settled);
      animation.cancel();
      settled();
    };
  }, [key, cue, enabled, delay, quiet]);
  return ref;
}
