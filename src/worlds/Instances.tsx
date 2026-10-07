import { useLayoutEffect, useRef } from "react";
import { Color, InstancedMesh, Object3D, type BufferGeometry } from "three";

export interface Instance {
  position: [number, number, number]; scale: [number, number, number];
  rotation?: [number, number, number]; color?: string;
}
export default function Instances({ items, geometry, color = "#586154", shadows = false, roughness = 0.8 }: {
  items: Instance[]; geometry: BufferGeometry; color?: string; shadows?: boolean; roughness?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new Object3D(), tint = new Color();
    items.forEach((item, i) => {
      object.position.set(...item.position); object.scale.set(...item.scale); object.rotation.set(...(item.rotation || [0, 0, 0])); object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix);
      if (item.color) ref.current!.setColorAt(i, tint.set(item.color));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={shadows} receiveShadow={shadows}>
    <meshStandardMaterial color={items.some(i => i.color) ? "#ffffff" : color} roughness={roughness} />
  </instancedMesh>;
}
