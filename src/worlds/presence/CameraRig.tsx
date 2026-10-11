import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, Quaternion, Matrix4 } from "three";
import { usePalaceStore } from "../../systems/store";
import { useQuietMotion } from "../../motion/useMotionCue";
import { useActivity } from "../activity";
import { roadView, useRoadRide } from "../road/state";
import { getRideMap } from "../road/maps";
import { followPose } from "./math";
import { limitCourtBoom } from "./courtBoom";
import { presence, usePerspective, type AdventureRoom } from "./state";

export default function AdventureCamera({ roomId }: { roomId: AdventureRoom }) {
  const { camera } = useThree(), quiet = useQuietMotion(), view = usePerspective(s => s.views[roomId]);
  const last = useRef(view), transition = useRef(0), initialized = useRef(false);
  const scratch = useMemo(() => ({ eye: new Vector3(), direction: new Vector3(), position: new Vector3(), target: new Vector3(), matrix: new Matrix4(), quaternion: new Quaternion(), up: new Vector3(0, 1, 0) }), []);
  useEffect(() => {
    const debug=window as Window & {__PRESENCE_DEBUG__?:unknown};
    if(import.meta.env.DEV)debug.__PRESENCE_DEBUG__={presence,perspective:usePerspective,activity:useActivity,ride:useRoadRide};
    const query = new URLSearchParams(location.search).get("view");
    if (query === "first" || query === "third") usePerspective.getState().setView(roomId, query);
    const key = (event: KeyboardEvent) => {
      const s = usePalaceStore.getState();
      if (event.code !== "KeyV" || event.repeat || event.defaultPrevented || s.overlay || s.focus || s.mode === "index" || !s.started || useActivity.getState().warming || event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault(); const state = usePerspective.getState(); state.setView(roomId, state.views[roomId] === "first" ? "third" : "first");
    };
    document.addEventListener("keydown", key); return () => {document.removeEventListener("keydown", key);delete debug.__PRESENCE_DEBUG__;};
  }, [roomId]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, .06), body = presence.camera, riding = roomId !== "basketball" && useRoadRide.getState().mounted;
    const photo = riding && useRoadRide.getState().photo, comfort = quiet || riding && useRoadRide.getState().comfort;
    const mode = photo ? "first" : view;
    scratch.eye.copy(body.position); if (!comfort && roomId === "basketball") scratch.eye.y += presence.jump * (mode === "first" ? .65 : .3);
    body.getWorldDirection(scratch.direction);
    if (riding && mode === "third") scratch.direction.set(-Math.sin(roadView.yaw + roadView.headYaw * 1.25), Math.sin(roadView.headPitch), -Math.cos(roadView.yaw + roadView.headYaw * 1.25)).normalize();
    followPose(scratch.eye, scratch.direction, mode, riding, scratch.position, scratch.target);
    if (mode === "third") {
      const ground = roomId === "basketball" ? 0 : getRideMap(roomId).ground(scratch.position.x, scratch.position.z);
      scratch.position.y = Math.max(scratch.position.y, ground + .75);
      if (roomId === "basketball") {
        scratch.position.x = Math.max(-12.3, Math.min(12.3, scratch.position.x)); scratch.position.z = Math.max(-18.3, Math.min(18.3, scratch.position.z));
        limitCourtBoom(scratch.eye, scratch.position);
      }
      scratch.matrix.lookAt(scratch.position, scratch.target, scratch.up); scratch.quaternion.setFromRotationMatrix(scratch.matrix);
    } else scratch.quaternion.copy(body.quaternion);
    if (last.current !== mode) { last.current = mode; transition.current = comfort ? 0 : .4; }
    // 渲染相机不写逻辑身体。第一人称静止状态完全归回原眼位，视角切换只做短过渡。
    const smooth = initialized.current && !comfort && (mode === "third" || transition.current > 0);
    if (smooth) { const blend = 1 - Math.exp(-dt * (transition.current > 0 ? 12 : 16)); camera.position.lerp(scratch.position, blend); camera.quaternion.slerp(scratch.quaternion, blend); }
    else { camera.position.copy(scratch.position); camera.quaternion.copy(scratch.quaternion); }
    // 平滑轨迹也要避障，避免上一帧的长镜头仍把篮板夹在镜头与球员之间。
    if (mode === "third" && roomId === "basketball" && limitCourtBoom(scratch.eye, camera.position)) {
      scratch.matrix.lookAt(camera.position, scratch.target, scratch.up); camera.quaternion.setFromRotationMatrix(scratch.matrix);
    }
    transition.current = Math.max(0, transition.current - dt); initialized.current = true;
    if (camera instanceof PerspectiveCamera && Math.abs(camera.fov - body.fov) > .01) { camera.fov = body.fov; camera.updateProjectionMatrix(); }
  }, -1);
  return null;
}
