import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { CanvasTexture, MeshStandardMaterial, NoColorSpace, RepeatWrapping, Vector2 } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { usePalaceStore } from "../../systems/store";
import { museum } from "../../world/artDirection";
import type { BlockProps } from "../../world/primitives";

function microSurface(normal:boolean) {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
  const context=canvas.getContext("2d")!,pixels=context.createImageData(128,128);let seed=193;
  for(let i=0;i<128*128;i++){seed=(1664525*seed+1013904223)>>>0;const grain=(seed>>>24)/255;
    pixels.data[i*4]=normal?112+grain*32:202+grain*53;pixels.data[i*4+1]=normal?116+grain*24:202+grain*53;pixels.data[i*4+2]=normal?255:202+grain*53;pixels.data[i*4+3]=255;}
  context.putImageData(pixels,0,0);const texture=new CanvasTexture(canvas);texture.colorSpace=NoColorSpace;texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(12,12);return texture;
}
const Context=createContext<ReturnType<typeof createSurfaces>|null>(null);
function createSurfaces(){
  const normal=microSurface(true),rough=microSurface(false),materials=new Map<string,MeshStandardMaterial>();
  return {get(color:string,roughness:number,metalness:number,opacity:number,emissive?:string,emissiveIntensity=1){
    const key=[color,roughness,metalness,opacity,emissive,emissiveIntensity].join(":");
    if(!materials.has(key)){
      const material=new MeshStandardMaterial({color,roughness,metalness,transparent:opacity<1,opacity,normalMap:normal,normalScale:new Vector2(.075,.075),roughnessMap:rough,emissive:emissive||"#000000",emissiveIntensity});
      // 仅为已知建筑饰面补足墙脚的低频接触明暗；不冒充实时全局光照或新增屏幕空间通道。
      material.onBeforeCompile=shader=>{
        shader.vertexShader="varying vec3 entryWorld;\n"+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nentryWorld=(modelMatrix*vec4(transformed,1.)).xyz;");
        shader.fragmentShader="varying vec3 entryWorld;\n"+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>","outgoingLight*=.78+.22*smoothstep(0.,.65,entryWorld.y);\n#include <opaque_fragment>");
      };
      material.customProgramCacheKey=()=>"atrium-painted-surface-contact-v1";materials.set(key,material);
    }
    return materials.get(key)!;
  },dispose(){materials.forEach(m=>m.dispose());normal.dispose();rough.dispose();}};
}
export function AtriumSurfaces({children}:{children:ReactNode}){
  const surfaces=useMemo(createSurfaces,[]);useEffect(()=>()=>surfaces.dispose(),[surfaces]);return <Context.Provider value={surfaces}>{children}</Context.Provider>;
}
// 尺寸、位置、门洞与碰撞不变；局部材质与细倒角由这一套自有资源共享。
export function EntryBlock({position,rotation,scale=[1,1,1],color=museum.wall,roughness=.38,metalness=0,opacity=1,emissive,emissiveIntensity=1,castShadow=false,receiveShadow=true,onClick,bevel=.055}:BlockProps){
  const surfaces=useContext(Context)!,tier=usePalaceStore(s=>s.effectiveQuality),[width,height,depth]=scale;
  const geometry=useMemo(()=>new RoundedBoxGeometry(width,height,depth,1,tier==="low"?0:Math.min(bevel,Math.min(width,height,depth)*.16)),[width,height,depth,bevel,tier]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh position={position} rotation={rotation} geometry={geometry} material={surfaces.get(color,roughness,metalness,opacity,emissive,emissiveIntensity)} castShadow={castShadow} receiveShadow={receiveShadow} onClick={onClick} dispose={null}/>;
}
