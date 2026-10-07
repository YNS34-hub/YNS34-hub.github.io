import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, Mesh, MeshBasicMaterial } from "three";
import { motionTime, revealProgress } from "./tokens";
import { useQuietMotion } from "./useMotionCue";

// 原 Picture 保持一张平面与原比例；只在真实纹理就绪时短暂调低投影亮度，不增加纹理或离屏通道。
export default function ProjectionReveal({ resourceKey, ready, children }: {
  resourceKey: string; ready: boolean; children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const records = useRef<{ material: MeshBasicMaterial; color: Color }[]>([]);
  const age = useRef(1);
  const quiet = useQuietMotion();
  const duration = motionTime.enter / 1000;
  useLayoutEffect(() => {
    records.current = [];
    if (!ready) return;
    group.current?.traverse(object => {
      const material = (object as Mesh).material;
      if (material instanceof MeshBasicMaterial) records.current.push({ material, color: material.color.clone() });
    });
    age.current = quiet ? duration : 0;
    for (const { material, color } of records.current) material.color.copy(color).multiplyScalar(quiet ? 1 : 0.82);
    return () => {
      for (const { material, color } of records.current) material.color.copy(color);
      records.current = [];
    };
  }, [resourceKey, ready, quiet, duration]);
  useFrame((_, dt) => {
    if (age.current >= duration || !records.current.length) return;
    age.current = Math.min(duration, age.current + Math.min(dt, 0.1));
    const value = 0.82 + 0.18 * revealProgress(age.current, duration);
    for (const { material, color } of records.current) material.color.copy(color).multiplyScalar(value);
  });
  return <group ref={group} name="cinema-projection">{children}</group>;
}
