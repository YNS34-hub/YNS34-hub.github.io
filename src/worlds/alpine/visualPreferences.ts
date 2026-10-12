import { create } from "zustand";
import type { AlpineWeather } from "./daylight";

interface Preferences { weather: AlpineWeather; detailed: boolean; outline: boolean }
const key = "memory-palace:alpine-visuals:v1";
function normalize(value: Partial<Preferences> | null): Preferences {
  return { weather: value?.weather === "cloudy" ? "cloudy" : "sunny",
    detailed: typeof value?.detailed === "boolean" ? value.detailed : true,
    outline: typeof value?.outline === "boolean" ? value.outline : true };
}
function read() {
  try { return normalize(JSON.parse(localStorage.getItem(key) ?? "null")); }
  catch { return normalize(null); }
}
// 只新增独立的视觉偏好键，不迁移、不覆写既有路线、人物或私人素材库。
export const useAlpineVisuals = create<Preferences & { choose(value: Partial<Preferences>): void }>(set => ({
  ...read(),
  choose(value) {
    set(previous => {
      const next = normalize({ ...previous, ...value });
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* 存储拒绝时仍可在本次参观中使用。 */ }
      return next;
    });
  },
}));
