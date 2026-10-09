import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, MathUtils, Vector3 } from "three";
import { usePalaceStore } from "../systems/store";
import { clearWalkTarget, hasWalkTarget, walkTarget } from "./walkTarget";
import { proximity } from "./proximity";
import { keepClear, roomFootprints, tourWaypoint } from "./collision";
import { resolveRoomPlan } from "./roomPlan";
import { roomViews } from "./visitView";
import { useLibraryStore } from "../systems/library";
import { imageLayout } from "./spatialLayout";
import { worksForRoom } from "../systems/mediaPlacement";
// 交互扩展开始 player-import
import { setWorldView } from "../worlds/worldConfig";
import { applyCyclingLook } from "../worlds/cyclingRoute";
// 交互扩展结束

const EYE = 1.65;
const worldPosition = new Vector3();
const upAxis = new Vector3(0, 1, 0);
export { roomBounds } from "./collision";

export default function Player({ roomId }: { roomId: string }) {
  const { camera, gl } = useThree();
  const velocity = useRef(new Vector3());
  const desired = useRef(new Vector3());
  const angle = useRef(new Euler(0, 0, 0, "YXZ"));
  const keys = useRef(new Set<string>());
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const proximityAt = useRef(0);
  const previousPosition = useRef(new Vector3());
  const waypoint = useRef(new Vector3());
  const footstepsAt = useRef(0);
  const library = useLibraryStore();
  const footprints = useMemo(() => {
    const base = roomId.split("-page-")[0],
      page = Math.max(0, (Number(roomId.split("-page-")[1]) || 1) - 1);
    const photos =
      base === "wallpapers" ? library.wallpapers : library.personal.visuals;
    const imageRoom = ["wallpapers", "portraits", "editorial"].includes(base);
    const walls = imageRoom
      ? imageLayout(
          worksForRoom(photos, base).slice(page * 5, page * 5 + 5),
          base !== "wallpapers",
          base === "editorial",
        ).map((p) => ({
          x: p.position[0],
          z: p.position[2] - 0.3,
          halfWidth:
            (Math.abs(Math.cos(p.rotation[1])) * (p.width + 0.65)) / 2 + 0.6,
          halfDepth:
            (Math.abs(Math.sin(p.rotation[1])) * (p.width + 0.65)) / 2 + 0.6,
        }))
      : [];
    return [...roomFootprints(roomId), ...walls];
  }, [roomId, library.wallpapers, library.personal.visuals]);
  const travelSequence = usePalaceStore((s) => s.travelSequence);
  useLayoutEffect(() => {
    if (roomId === "atrium") {
      camera.position.set(0, EYE, 23);
      camera.lookAt(0, 3.5, -1);
    } else if (roomId === "corridor") {
      camera.position.set(0, EYE, 14);
      camera.lookAt(0, 2.3, -40);
    } else if (roomId === "cinema") {
      camera.position.set(0, EYE, 12);
      camera.lookAt(0, 4.9, -13);
    } else {
      const plan = resolveRoomPlan(roomId);
      camera.position.set(
        plan.type === "listening" ? 1.5 : 0,
        EYE,
        plan.rule === "impossible"
          ? 21
          : plan.type === "listening"
            ? 10.8
            : roomId === "unfinished"
              ? 10.8
              : 13.8,
      );
      camera.lookAt(
        0,
        plan.type === "listening" ? 2.75 : roomId === "cinema" ? 4.3 : 3.15,
        -8,
      );
    }
    // 交互扩展开始 player-world-view
    setWorldView(camera, roomId);
    // 交互扩展结束
    angle.current.setFromQuaternion(camera.quaternion, "YXZ");
    velocity.current.set(0, 0, 0);
    keys.current.clear();
    clearWalkTarget();
  }, [camera, roomId, travelSequence]);
  useLayoutEffect(() => {
    const view = usePalaceStore.getState().returnView;
    if (view?.roomId === roomId) {
      camera.position.set(...view.position);
      camera.quaternion.set(...view.quaternion);
      angle.current.setFromQuaternion(camera.quaternion, "YXZ");
      usePalaceStore.getState().update({ returnView: null });
    }
  }, [roomId, travelSequence, camera]);
  useEffect(() => {
    const remember = () =>
      roomViews.set(roomId, {
        roomId,
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
      });
    window.addEventListener("palace:before-travel", remember);
    return () => window.removeEventListener("palace:before-travel", remember);
  }, [roomId, camera]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      const code = event.code;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "ShiftLeft",
          "ShiftRight",
        ].includes(code)
      ) {
        keys.current.add(code);
        if (
          usePalaceStore.getState().started &&
          !usePalaceStore.getState().overlay
        )
          event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const blur = () => {
      keys.current.clear();
      dragging.current = false;
    };
    const pointerDown = (event: PointerEvent) => {
      if (!usePalaceStore.getState().started || event.button !== 0) return;
      dragging.current = true;
      last.current = { x: event.clientX, y: event.clientY };
    };
    const pointerUp = () => {
      dragging.current = false;
    };
    const pointerMove = (event: PointerEvent) => {
      const state = usePalaceStore.getState();
      if (
        !state.started ||
        state.overlay ||
        state.focus ||
        state.mode === "index"
      )
        return;
      const locked = document.pointerLockElement === gl.domElement;
      if (!locked && !dragging.current) return;
      const dx = locked ? event.movementX : event.clientX - last.current.x;
      const dy = locked ? event.movementY : event.clientY - last.current.y;
      last.current = { x: event.clientX, y: event.clientY };
      const factor = 0.0022 * state.sensitivity;
      angle.current.y -= dx * factor;
      angle.current.x = MathUtils.clamp(
        angle.current.x - dy * factor,
        -1.12,
        1.12,
      );
    };
    const lock = () =>
      usePalaceStore.getState().update({
        pointerLocked: document.pointerLockElement === gl.domElement,
      });
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    gl.domElement.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointermove", pointerMove);
    document.addEventListener("pointerlockchange", lock);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      gl.domElement.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("pointerlockchange", lock);
    };
  }, [gl]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.06);
    const state = usePalaceStore.getState();
    // Cinema has a fixed, level viewing position; movement resumes on exit.
    if (roomId === "cinema") return;
    if (roomId === "music" && document.activeElement?.hasAttribute("data-reading")) {
      keys.current.clear();
      velocity.current.set(0, 0, 0);
      return;
    }
    if (clock.elapsedTime - proximityAt.current > 0.25) {
      proximityAt.current = clock.elapsedTime;
      let closest = Infinity,
        near: string | null = null;
      for (const entry of proximity.values()) {
        entry.object.getWorldPosition(worldPosition);
        const distance = camera.position.distanceToSquared(worldPosition);
        if (distance < entry.radius * entry.radius && distance < closest) {
          closest = distance;
          near = entry.title;
        }
      }
      if (near !== state.near) state.update({ near });
    }
    if (
      !state.started ||
      state.overlay ||
      state.focus ||
      state.mode === "index"
    ) {
      velocity.current.set(0, 0, 0);
      return;
    }
    camera.quaternion.setFromEuler(angle.current);
    // 交互扩展开始 player-cycle-locomotion
    if (roomId === "cycling") { applyCyclingLook(camera, angle.current); return; }
    // 交互扩展结束
    const input = keys.current;
    const x =
      (input.has("KeyD") || input.has("ArrowRight") ? 1 : 0) -
      (input.has("KeyA") || input.has("ArrowLeft") ? 1 : 0);
    const z =
      (input.has("KeyS") || input.has("ArrowDown") ? 1 : 0) -
      (input.has("KeyW") || input.has("ArrowUp") ? 1 : 0);
    const speed =
      input.has("ShiftLeft") || input.has("ShiftRight") ? 4.45 : 2.7;
    if (x || z) {
      clearWalkTarget();
      desired.current
        .set(x, 0, z)
        .normalize()
        .applyAxisAngle(upAxis, angle.current.y)
        .multiplyScalar(speed);
    } else if (hasWalkTarget && (state.mode === "tour" || state.pendingDoor)) {
      keepClear(walkTarget, roomId, footprints);
      tourWaypoint(camera.position, walkTarget, footprints, waypoint.current);
      desired.current.subVectors(waypoint.current, camera.position);
      desired.current.y = 0;
      if (camera.position.distanceToSquared(walkTarget) < 0.12) {
        if (state.pendingDoor) {
          state.enterRoom(state.pendingDoor);
          return;
        }
        clearWalkTarget();
        desired.current.set(0, 0, 0);
      } else desired.current.normalize().multiplyScalar(speed);
    } else desired.current.set(0, 0, 0);
    velocity.current.lerp(
      desired.current,
      1 - Math.exp(-delta * (state.reducedMotion ? 14 : 7)),
    );
    previousPosition.current.copy(camera.position);
    camera.position.addScaledVector(velocity.current, delta);
    keepClear(camera.position, roomId, footprints);
    if (
      camera.position.distanceToSquared(previousPosition.current) > 0.00001 &&
      clock.elapsedTime - footstepsAt.current > 0.58
    ) {
      footstepsAt.current = clock.elapsedTime;
      window.dispatchEvent(new Event("palace:footstep"));
    }
  });
  return null;
}
