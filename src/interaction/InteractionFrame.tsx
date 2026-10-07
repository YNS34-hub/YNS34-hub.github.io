import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector3, type Object3D } from "three";
import { usePalaceStore } from "../systems/store";
import { attentionSample, advanceDwell, type Dwell } from "./attention";
import { activateFocused, interactives, publishFocus } from "./registry";

export default function InteractionFrame() {
  const { camera, scene } = useThree();
  const scratch = useRef({ position: new Vector3(), direction: new Vector3(), delta: new Vector3(), ray: new Raycaster() });
  const dwell = useRef<Dwell>({ id: "", seconds: 0 }), elapsed = useRef(0);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const state = usePalaceStore.getState();
      if (event.repeat || event.defaultPrevented || !state.started || state.overlay || state.focus || state.mode === "index" || state.pendingDoor ||
        (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,button,a,[contenteditable="true"],[data-reading]'))) return;
      if (event.code === "KeyE" || event.code === "KeyF") {
        event.preventDefault();
        activateFocused(event.code === "KeyF");
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useFrame((_, dt) => {
    elapsed.current += Math.min(dt, 0.12);
    if (elapsed.current < 0.1) return;
    const step = elapsed.current; elapsed.current = 0;
    const state = usePalaceStore.getState();
    const enabled = state.started && !state.overlay && !state.focus && !state.pendingDoor && state.mode !== "index" && !document.hidden;
    const { position, direction, delta, ray } = scratch.current;
    camera.getWorldDirection(direction);
    let candidate = "", closest = Infinity;
    for (const [id, target] of interactives) {
      target.object.getWorldPosition(position);
      delta.subVectors(position, camera.position);
      const distance = delta.length(), sample = attentionSample(distance, delta.normalize().dot(direction), target.radius);
      target.state.proximity = enabled ? sample.proximity : 0;
      target.state.focused = false;
      if (enabled && sample.gaze && distance < closest) { candidate = id; closest = distance; }
    }
    if (candidate) {
      const target = interactives.get(candidate)!;
      target.object.getWorldPosition(position);
      ray.set(camera.position, delta.subVectors(position, camera.position).normalize());
      ray.far = closest + 0.4;
      const hit = ray.intersectObjects(scene.children, true).find(hit => hit.object.visible && hit.object.type === "Mesh");
      // 使用世界坐标与实际遮挡；不会隔着墙激活另一侧的收藏。
      let ancestor: Object3D | null = hit?.object || null;
      while (ancestor && ancestor !== target.object) ancestor = ancestor.parent;
      if (hit && !ancestor) candidate = "";
    }
    dwell.current = advanceDwell(dwell.current, candidate, step);
    const focused = dwell.current.seconds >= 0.55 ? candidate : "";
    if (focused) interactives.get(focused)!.state.focused = true;
    publishFocus(focused);
  });
  return null;
}
