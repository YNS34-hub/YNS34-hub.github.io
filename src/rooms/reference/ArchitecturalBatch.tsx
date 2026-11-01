import { useEffect, useMemo } from "react";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { BoxInstance } from "../../world/StudioObjects";
import { useArchitecturalSurfaces } from "./ArchitecturalSurfaces";
import type { FinishKind } from "./architecturalFinish";

export default function ArchitecturalBatch({ items, finish = "basalt", color, name, shadow = true }: { items: BoxInstance[]; finish?: FinishKind; color?: string; name?: string; shadow?: boolean }) {
  const surfaces = useArchitecturalSurfaces();
  const geometry = useMemo(() => {
    const transform = new Matrix4(), position = new Vector3(), rotation = new Quaternion();
    const pieces = items.map(item => {
      const piece = surfaces.geometry(...item.scale, Math.min(.025, Math.min(...item.scale) * .16)).clone();
      position.set(...item.position); rotation.setFromEuler(new Euler(...(item.rotation || [0, 0, 0])));
      transform.compose(position, rotation, new Vector3(1, 1, 1)); piece.applyMatrix4(transform); return piece;
    });
    const merged = mergeGeometries(pieces)!; pieces.forEach(piece => piece.dispose()); merged.computeBoundingSphere(); return merged;
  }, [items, surfaces]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name={name} geometry={geometry} material={surfaces.material(finish, color)} castShadow={shadow} receiveShadow dispose={null} />;
}
