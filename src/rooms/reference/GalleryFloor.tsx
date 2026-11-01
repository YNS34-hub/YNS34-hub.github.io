import { useLayoutEffect, useRef } from "react";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { Floor } from "../../world/primitives";
import { useSurfaceTexture } from "../../world/materials";
import { createGalleryFinish } from "./galleryFinish";
import { useOptionalArchitecturalSurfaces } from "./ArchitecturalSurfaces";

export default function GalleryFloor({ color, wood = false }: { color: string; wood?: boolean }) {
  const root = useRef<Group>(null);
  const grain = useSurfaceTexture("walnut");
  const surfaces = useOptionalArchitecturalSurfaces();
  useLayoutEffect(() => {
    const mesh = root.current?.children.find(child => child instanceof Mesh) as Mesh | undefined;
    if (!mesh || !(mesh.material instanceof MeshStandardMaterial)) return;
    const original = mesh.material, finish = surfaces ? surfaces.material(wood ? "timber" : "limestone", color, .7, .025, true) : createGalleryFinish(original, wood ? grain : undefined);
    mesh.material = finish;
    return () => { if (mesh.material === finish) mesh.material = original; if (!surfaces) finish.dispose(); };
  }, [color, wood, grain, surfaces]);
  // 复用原 Floor 的位置、射线与点击行走，不新增覆盖交互的地板平面。
  return <group ref={root}><Floor width={28} depth={34} color={color} /></group>;
}
