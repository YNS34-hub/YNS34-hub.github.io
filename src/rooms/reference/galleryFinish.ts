import { MeshStandardMaterial, type Texture } from "three";

// 只修改本房间拥有的材质副本；共享贴图仍由原 Hook 管理与释放。
export function createGalleryFinish(source: MeshStandardMaterial, wood?: Texture) {
  const finish = source.clone();
  finish.roughness = wood ? .74 : .79;
  finish.metalness = .015;
  finish.bumpScale = .005;
  if (wood) finish.map = wood;
  finish.needsUpdate = true;
  return finish;
}
