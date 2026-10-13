import type {InstancedMesh} from 'three';

// 每个路段拥有实例矩阵缓冲，但不拥有共享树木几何 / 材质；离开路段只释放实例本身。
export function disposeForestInstances(meshes:Iterable<InstancedMesh>){
 for(const mesh of meshes)mesh.dispose();
}
