import type { Object3D } from "three";

export interface Attention { proximity: number; focused: boolean }
export interface Interactive {
  object: Object3D;
  title: string;
  hint: string;
  radius: number;
  state: Attention;
  activate: () => void;
  secondary?: () => void;
}
export const interactives = new Map<string, Interactive>();
export interface InteractionSnapshot {
  id: string; title: string; hint: string; secondary: boolean;
  feedback: string; sequence: number;
}
let snapshot: InteractionSnapshot = { id: "", title: "", hint: "", secondary: false, feedback: "", sequence: 0 };
const listeners = new Set<() => void>();
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
export const subscribeInteraction = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const readInteraction = () => snapshot;
export function publishFocus(id: string) {
  if (id === snapshot.id) return;
  const target = interactives.get(id);
  snapshot = { ...snapshot, id: target ? id : "", title: target?.title || "", hint: target?.hint || "", secondary: !!target?.secondary };
  listeners.forEach(listener => listener());
}
export function acknowledge(feedback: string) {
  clearTimeout(feedbackTimer);
  snapshot = { ...snapshot, feedback, sequence: snapshot.sequence + 1 };
  listeners.forEach(listener => listener());
  feedbackTimer = setTimeout(() => {
    snapshot = { ...snapshot, feedback: "" };
    listeners.forEach(listener => listener());
  }, 1700);
}
export function activateFocused(secondary = false) {
  const target = interactives.get(snapshot.id);
  if (!target) return;
  (secondary ? target.secondary : target.activate)?.();
}
