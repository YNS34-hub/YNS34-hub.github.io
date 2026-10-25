import { useRef, type ReactNode, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import type { Attention } from "../interaction/registry";
import { useQuietMotion } from "./useMotionCue";
import { usePalaceStore } from "../systems/store";

// 只编排编辑作品原有的标题和边距；展品是完整位图，不拆造其中的人像与文字。
export default function PosterCaption({ children, attention, hovered, width, height, enabled }: {
  children: ReactNode; attention: RefObject<Attention>; hovered: RefObject<boolean>;
  width: number; height: number; enabled: boolean;
}) {
  const label = useRef<Group>(null), rule = useRef<Mesh<PlaneGeometry, MeshBasicMaterial>>(null);
  const elapsed = useRef(1), previous = useRef(false);
  const quiet = useQuietMotion();
  const editorial = usePalaceStore(s => s.roomId.startsWith("editorial"));
  useFrame((_, dt) => {
    if (!enabled || !editorial || !label.current || !rule.current) return;
    const state = usePalaceStore.getState();
    const active = !state.overlay && !state.focus && !state.pendingDoor && (hovered.current || attention.current.focused);
    if (active && !previous.current) elapsed.current = 0;
    previous.current = active;
    elapsed.current = quiet || document.hidden || !active ? 1 : Math.min(1, elapsed.current + Math.min(dt, .1) / .82);
    const t = elapsed.current, pulse = t === 1 ? 0 : Math.sin(Math.PI * t);
    label.current.position.y = -.045 * pulse;
    rule.current.visible = t < 1 && active;
    rule.current.scale.x = width * (1 - (1 - t) ** 3);
    rule.current.position.x = -width / 2 + rule.current.scale.x / 2;
    rule.current.material.opacity = pulse * .38;
  });
  if (!enabled || !editorial) return <>{children}</>;
  return <>
    <group ref={label} name="editorial-caption-motion">{children}</group>
    <mesh ref={rule} name="editorial-caption-rule" position={[-width / 2, -height / 2 - .16, .15]} visible={false} raycast={() => {}}>
      <planeGeometry args={[1, .008]} />
      <meshBasicMaterial color="#b4cbd5" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  </>;
}
