import { create } from "zustand";

export type CourtTime = "day" | "night";
const key = "memory-palace:court-light:v1";
function readTime(): CourtTime {
  try { return localStorage.getItem(key) === "night" ? "night" : "day"; } catch { return "day"; }
}
// 球场光照偏好独立于球、播放器和旧数据库，不拥有任何玩法状态。
export const useCourtTime = create<{ time: CourtTime; setTime: (time: CourtTime) => void }>(set => ({
  time: readTime(),
  setTime: time => { try { localStorage.setItem(key, time); } catch { /* 浏览器禁用存储时仍允许本次切换。 */ } set({ time }); },
}));
export const courtAtmosphere = { night: 0 };
