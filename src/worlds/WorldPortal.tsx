import { useRef } from "react";
import { Group, Vector3 } from "three";
import { Block, Label, Picture } from "../world/primitives";
import WorkAttention from "../motion/WorkAttention";
import { useInteractable } from "../interaction/useInteractable";
import { acknowledge } from "../interaction/registry";
import { usePalaceStore } from "../systems/store";
import { setWalkTarget } from "../world/walkTarget";
import { preloadWorld } from "./preload";
import { useFrame } from "@react-three/fiber";

export function WorldPortal({ id, title, position, rotation = [0, 0, 0], compact = false, museum = false }: {
  id: string; title: string; position: [number, number, number]; rotation?: [number, number, number]; compact?: boolean; museum?: boolean;
}) {
  const ref = useRef<Group>(null), hovered = useRef(false), warmed = useRef(false);
  const enter = () => {
    if (!ref.current) return;
    // 保留原 pendingDoor 与门槛行走；新入口先加载场景代码，然后沿当前视线走到阈值。
    void preloadWorld(id).catch(() => { /* 预热失败由实际进入后的原加载边界处理。 */ });
    const target = ref.current.getWorldPosition(new Vector3());
    target.y = 1.65;
    setWalkTarget(target);
    usePalaceStore.getState().update({ pendingDoor: id });
    acknowledge("Entering " + title);
  };
  const attention = useInteractable(ref, { title, hint: "Enter world", radius: compact ? 7 : 12, activate: enter });
  useFrame(() => { if (!warmed.current && attention.current.proximity > .2) { warmed.current = true; void preloadWorld(id).catch(() => { /* 预热不产生未处理的拒绝。 */ }); } });
  const width = compact ? 2.5 : museum ? 4.6 : 6.4, height = compact ? 3.5 : 4.8;
  const view = !compact && (id === "basketball" || id === "cycling");
  return <group ref={ref} position={position} rotation={rotation} name={"world-portal:" + id} onPointerOver={() => { hovered.current = true; }} onPointerOut={() => { hovered.current = false; }} onClick={event => { if (event.delta < 5) { event.stopPropagation(); enter(); } }}>
    <Block scale={[width + .18, height + .18, .22]} color="#344a50" roughness={.35} metalness={.55} />
    <Block position={[0, 0, .14]} scale={[width, height, .06]} color={id === "basketball" ? "#986341" : id === "cycling" ? "#466952" : "#142c36"} roughness={.8} />
    {view ? <Picture src={"/media/worlds/" + (id === "basketball" ? "after-hours" : "golden-forest") + ".webp"} width={6.4} height={3.6} position={[0, .6, .19]} medium="screen" /> : <Label text={compact ? "RETURN ↗" : "WORLDS\nBEYOND"} position={[0, .6, .19]} size={compact ? .28 : .67} color="#e8dfcd" maxWidth={width - .4} />}
    <Label text={title} position={[0, compact ? -.7 : -1.25, .19]} size={.16} color="#c5d5cf" maxWidth={width - .3} />
    <Label text="ENTER ↗" position={[0, -height / 2 + .42, .2]} size={.14} color="#b7d5d9" />
    <WorkAttention width={width} height={height} hovered={hovered} attention={attention} />
  </group>;
}
