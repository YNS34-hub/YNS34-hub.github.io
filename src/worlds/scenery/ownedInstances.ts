import {InstancedMesh,type Object3D} from "three";

// 保存此组件当次拥有的实例对象。共享扫描网格和材质不属于它，不能递归销毁。
// 节点更换或卸载后仍释放旧 instanceMatrix / instanceColor，重复清理不会波及新节点。
export function ownedInstanceBuffers(root:Object3D){
  const owned:InstancedMesh[]=[];root.traverse(object=>{if(object instanceof InstancedMesh)owned.push(object);});
  let released=false;
  return()=>{if(released)return;released=true;for(const object of owned)object.dispose();};
}
