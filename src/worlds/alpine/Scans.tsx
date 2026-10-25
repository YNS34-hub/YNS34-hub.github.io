import {useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {useGLTF} from "@react-three/drei";
import {FrontSide,InstancedMesh,Mesh,MeshStandardMaterial,Object3D,type BufferGeometry} from "three";
import type {Instance} from "../Instances";

const urls=["/media/alpine/rock_09/lod.gltf","/media/alpine/rock_face_01/lod.gltf"];
export function preloadAlpineScans(){useGLTF.preload(urls);}
export function useAlpineScans(){
  const models=useGLTF(urls);
  const scans=useMemo(()=>models.map(model=>{
    let source:Mesh<BufferGeometry,MeshStandardMaterial>|undefined;
    model.scene.updateMatrixWorld(true);model.scene.traverse(object=>{if(object instanceof Mesh)source=object as Mesh<BufferGeometry,MeshStandardMaterial>;});
    if(!source)throw new Error("The alpine rock scan has no mesh");
    const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();
    const box=geometry.boundingBox!,span=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z);
    geometry.translate(-(box.min.x+box.max.x)*.5,-box.min.y,-(box.min.z+box.max.z)*.5);geometry.scale(1/span,1/span,1/span);geometry.computeBoundingSphere();
    const material=source.material.clone();material.side=FrontSide;material.normalScale.set(.85,.85);material.roughness=.95;
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\nfloat stoneGrey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(stoneGrey)*vec3(.97,1.,1.03),.72);");};
    material.customProgramCacheKey=()=>"alpine-cool-stone-scan-v1";
    material.map!.anisotropy=8;return{geometry,material};
  }),[models]);
  // 只销毁本场景的几何和材质副本，drei 的解码纹理由缓存持有。
  useEffect(()=>()=>scans.forEach(s=>{s.geometry.dispose();s.material.dispose();}),[scans]);return scans;
}
export function ScanInstances({scan,items,shadows}:{scan:ReturnType<typeof useAlpineScans>[number];items:Instance[];shadows:boolean}){
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{const temp=new Object3D();items.forEach((item,i)=>{temp.position.set(...item.position);temp.scale.set(...item.scale);temp.rotation.set(...(item.rotation??[0,0,0]));temp.updateMatrix();ref.current!.setMatrixAt(i,temp.matrix);});ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere();},[items]);
  return <instancedMesh ref={ref} args={[scan.geometry,scan.material,items.length]} castShadow={shadows} receiveShadow raycast={()=>{}} dispose={null}/>;
}
