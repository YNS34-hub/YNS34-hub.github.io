import { useEffect, useId, useRef, type RefObject } from "react";
import type { Object3D } from "three";
import { interactives, publishFocus, readInteraction, type Attention } from "./registry";

export function useInteractable(object: RefObject<Object3D | null>, options: {
  title: string; hint: string; activate: () => void; secondary?: () => void; radius?: number;
}) {
  const id = useId();
  const state = useRef<Attention>({ proximity: 0, focused: false });
  const actions = useRef(options);
  useEffect(() => { actions.current = options; });
  useEffect(() => {
    if (!object.current) return;
    const entry = {
      object: object.current, title: options.title, hint: options.hint, radius: options.radius || 10,
      state: state.current, activate: () => actions.current.activate(),
      secondary: options.secondary ? () => actions.current.secondary?.() : undefined,
    };
    interactives.set(id, entry);
    return () => {
      // StrictMode 的旧实例不能删除后来登记的对象，卸载也不会留下可触发的幽灵展品。
      if (interactives.get(id) === entry) interactives.delete(id);
      if (readInteraction().id === id) publishFocus("");
    };
  }, [id, object, options.title, options.hint, options.radius, !!options.secondary]);
  return state;
}
