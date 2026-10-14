import { create } from "zustand";
import { PerspectiveCamera, Vector3, type Camera } from "three";
import type { FinishPose } from "../court/finishing";
import type {MotionPackSelection} from "../court/motionPacks";

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
  releaseHand: new Vector3(),releaseBody:new Vector3(),shotReleaseStance:0,shotReleasePitch:0, turboHeld: false, shotJump: 0, finishPose: null as FinishPose | null,
  dribblePalm:new Vector3(),dribbleLeftPalm:new Vector3(),dribbleRightPalm:new Vector3(),dribblePhase:0,crossover:0,dribbleTorso:0,dribbleTwist:0,dribbleCrouch:0,courtStance:0,dribbleStanceSeed:.08,dribbleBlend:1,holdBlend:1,leftWrist:new Vector3(),rightWrist:new Vector3(),dribbleLeftSeed:new Vector3(),dribbleRightSeed:new Vector3(),dribbleOrigin:new Vector3(),holdLeftSeed:new Vector3(),holdRightSeed:new Vector3(),holdOrigin:new Vector3(),shotPack:"classic" as MotionPackSelection["shot"],shotVerticalVelocity:0,shotStance:0,shotGather:1,shotLeftSeed:new Vector3(),shotRightSeed:new Vector3(),shotOrigin:new Vector3(),finishLeftSeed:new Vector3(),finishRightSeed:new Vector3(),finishOrigin:new Vector3(),leftFoot:new Vector3(),rightFoot:new Vector3(),
};
export function actorCamera(camera: Camera, roomId: string) { return isAdventureRoom(roomId) ? presence.camera : camera; }
