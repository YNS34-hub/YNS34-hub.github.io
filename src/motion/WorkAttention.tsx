import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, LineSegments, LineBasicMaterial, Vector3 } from "three";
import { usePalaceStore } from "../systems/store";
import { useQuietMotion } from "./useMotionCue";
import { settleMotion } from "./tokens";

// 附在原作品边缘的四个短角标：只响应实际指向，不移动作品、不拦截点击，静止时不绘制。
export default function WorkAttention({ width, height, hovered, warm = false }: {
  width: number; height: number; hovered: RefObject<boolean>; warm?: boolean;
}) {
  const edge = useRef<LineSegments<BufferGeometry, LineBasicMaterial>>(null);
  const strength = useRef(0);
  const quiet = useQuietMotion();
  const geometry = useMemo(() => {
    const x = width / 2 + 0.03, y = height / 2 + 0.03;
    const length = Math.min(0.3, width * 0.06, height * 0.08);
    const points: Vector3[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      points.push(new Vector3(sx * (x - length), sy * y, 0), new Vector3(sx * x, sy * y, 0));
      points.push(new Vector3(sx * x, sy * y, 0), new Vector3(sx * x, sy * (y - length), 0));
    }
    return new BufferGeometry().setFromPoints(points);
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    if (!edge.current) return;
    const state = usePalaceStore.getState();
    const target = Number(hovered.current && !state.overlay && !state.focus && !state.pendingDoor);
    strength.current = quiet ? target : settleMotion(strength.current, target, dt, 0.14, 0.2);
    edge.current.visible = strength.current > 0.001;
    edge.current.material.opacity = strength.current * 0.42;
  });
  return <lineSegments ref={edge} geometry={geometry} position={[0, 0, 0.15]} name="work-attention-edge" visible={false} raycast={() => {}}>
    <lineBasicMaterial color={warm ? "#e3c49e" : "#b5d8e5"} transparent opacity={0} depthWrite={false} toneMapped={false} />
  </lineSegments>;
}
