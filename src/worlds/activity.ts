import { create } from "zustand";

// 这里只存活动的低频 UI 快照；相机、球和车每帧更新局部引用，不修改馆藏或播放器状态。
export const useActivity = create<{
  mode: "ground" | "held" | "flight"; dribbling: boolean; charge: number;
  shots: number; made: number; streak: number; result: string; assist: boolean;
  speed: number; distance: number; riding: boolean; scenic: string; stopped: boolean;
}>(() => ({
  mode: "ground", dribbling: false, charge: 0, shots: 0, made: 0, streak: 0, result: "", assist: true,
  speed: 0, distance: 0, riding: false, scenic: "FOREST ENTRY", stopped: true,
}));
export type CourtCommand = "pickup" | "dribble" | "charge" | "release" | "recall";
export function courtCommand(command: CourtCommand) { window.dispatchEvent(new CustomEvent("palace:court", { detail: command })); }
