import type { Mesh, Object3D } from "three";

export function isVisibleMesh(object: Object3D) {
  if (!(object as Mesh).isMesh) return false;
  // 实例化建筑同样遮挡视线；子物体的 visible 不能替代父级可见性。
  for (let ancestor: Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (!ancestor.visible) return false;
  }
  return true;
}
