import { create } from "zustand";
import { PerspectiveCamera, Vector3, type Camera } from "three";
import type { FinishPose } from "../court/finishing";

export type AdventureRoom = "basketball" | "cycling" | "alpine-ride";
export type ViewMode = "first" | "third";
export const isAdventureRoom = (room: string): room is AdventureRoom => ["basketball", "cycling", "alpine-ride"].includes(room);
const KEY = "memory-palace:perspective:v1";
function readViews(): Record<AdventureRoom, ViewMode> {
  const defaults: Record<AdventureRoom, ViewMode> = { basketball: "first", cycling: "first", "alpine-ride": "first" };
  try { const stored = JSON.parse(localStorage.getItem(KEY) ?? "null"); for (const room of Object.keys(defaults) as AdventureRoom[]) if (stored?.[room] === "third") defaults[room] = "third"; } catch { /* 无本机存储时保留原第一人称入口。 */ }
  return defaults;
}
export const usePerspective = create<{ views: Record<AdventureRoom, ViewMode>; setView: (room: AdventureRoom, view: ViewMode) => void }>((set, get) => ({
  views: readViews(), setView: (room, view) => {
    const views = { ...get().views, [room]: view }; set({ views });
    try { localStorage.setItem(KEY, JSON.stringify(views)); } catch { /* 不改馆藏数据库或上传替代存档。 */ }
  },
}));

// 户外逻辑眼位仍由原 Player / RoadRider 控制。渲染相机的跟随偏移不参与物理、拾球、门槛和返回快照。
export const presence = {
  roomId: "", camera: new PerspectiveCamera(60, 1, .1, 200), previous: new Vector3(), velocity: new Vector3(), speed: 0,
  sprinting: false, jump: 0, finishLocked: false, ball: new Vector3(), held: false, dribbling: false, hand: 1,
  finish: "idle" as "idle" | "layup" | "dunk", shot: 0, charge: 0,
  releaseHand: new Vector3(), turboHeld: false, shotJump: 0, finishPose: null as FinishPose | null,
  dribblePalm:new Vector3(),dribblePhase:0,crossover:0,leftFoot:new Vector3(),rightFoot:new Vector3(),
};
export function actorCamera(camera: Camera, roomId: string) { return isAdventureRoom(roomId) ? presence.camera : camera; }
