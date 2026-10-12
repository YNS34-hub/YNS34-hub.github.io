import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshPhysicalMaterial, PerspectiveCamera } from "three";
import { usePalaceStore } from "../../systems/store";
import { useQuietMotion } from "../../motion/useMotionCue";

export function finishMemoryGlass(original:MeshPhysicalMaterial){
  const finish=original.clone();finish.color.set("#f5fcff");finish.roughness=.013;finish.attenuationColor.set("#d5edff");finish.attenuationDistance=32;finish.clearcoat=.5;finish.envMapIntensity=1.8;
  return finish;
}
export function OpticalCore({children}:{children:ReactNode}){
  const root=useRef<Group>(null),quiet=useQuietMotion();
  useEffect(()=>{
    const owned:{mesh:Mesh;original:MeshPhysicalMaterial;finish:MeshPhysicalMaterial}[]=[];
    root.current?.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshPhysicalMaterial&&o.material.transmission>.5){const original=o.material,finish=finishMemoryGlass(original);o.material=finish;owned.push({mesh:o,original,finish});}});
    return()=>{for(const item of owned){if(item.mesh.material===item.finish)item.mesh.material=item.original;item.finish.dispose();}};
  },[]);
  useFrame((_,dt)=>{const s=usePalaceStore.getState();if(root.current&&!quiet&&!s.overlay&&!s.focus&&!document.hidden)root.current.rotation.y+=Math.min(dt,.06)*.006;});
  return <group ref={root} name="memory-core-optical-finish">{children}</group>;
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
