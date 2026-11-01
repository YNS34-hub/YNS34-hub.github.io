import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshPhysicalMaterial, PerspectiveCamera } from "three";
import { usePalaceStore } from "../../systems/store";
import { useQuietMotion } from "../../motion/useMotionCue";
import GlassRibbon from "./GlassRibbon";

export function finishMemoryGlass(original:MeshPhysicalMaterial){
  const finish=original.clone();
  // 保留原网格与 IOR；按中庭缩放后的体量校准光程厚度，分开玻璃边缘与内部折射。
  finish.color.set("#e9f7ff");finish.roughness=.035;finish.attenuationColor.set("#bddbe9");finish.attenuationDistance=8;finish.clearcoat=0;finish.envMapIntensity=.7;finish.thickness=1.2;
  return finish;
}
export function OpticalCore({children}:{children:ReactNode}){
  const root=useRef<Group>(null),quiet=useQuietMotion();
  useEffect(()=>{
    const owned:{mesh:Mesh;original:MeshPhysicalMaterial;finish:MeshPhysicalMaterial;castShadow:boolean}[]=[];
    root.current?.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshPhysicalMaterial&&o.material.transmission>.5){const original=o.material,finish=finishMemoryGlass(original),castShadow=o.castShadow;o.material=finish;o.castShadow=false;owned.push({mesh:o,original,finish,castShadow});}});
    return()=>{for(const item of owned){if(item.mesh.material===item.finish)item.mesh.material=item.original;item.mesh.castShadow=item.castShadow;item.finish.dispose();}};
  },[]);
  useFrame((_,dt)=>{const s=usePalaceStore.getState();if(root.current&&!quiet&&!s.overlay&&!s.focus&&!document.hidden)root.current.rotation.y+=Math.min(dt,.06)*.006;});
  return <><group ref={root} name="memory-core-optical-finish" scale={.48}>{children}</group><GlassRibbon /></>;
}
export function EntryCameraReveal(){
  const {camera}=useThree(),quiet=useQuietMotion(),age=useRef(0);
  useLayoutEffect(()=>{if(!(camera instanceof PerspectiveCamera))return;if(!usePalaceStore.getState().started){camera.fov=48;camera.updateProjectionMatrix();}return()=>{camera.fov=60;camera.updateProjectionMatrix();};},[camera]);
  useFrame((_,delta)=>{
    const s=usePalaceStore.getState();if(!(camera instanceof PerspectiveCamera)||s.overlay||document.hidden)return;
    const target=s.started?60:48;
    if(Math.abs(camera.fov-target)>.01){camera.fov+=(target-camera.fov)*(quiet?1:1-Math.exp(-Math.min(delta,.1)*8));camera.updateProjectionMatrix();}
    if(!s.started){age.current+=Math.min(delta,.1);camera.position.z=23+(quiet||age.current>=2?0:.45*(1-age.current/2)**3);}
  });return null;
}
