import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { usePalaceStore } from "../../systems/store";
import { museum } from "../../world/artDirection";
import type { BlockProps } from "../../world/primitives";
import MasonryDetails from "./MasonryDetails";
import { PrepareArchitecturalMaps, useArchitecturalMaps } from "../reference/ArchitecturalSurfaces";
import { createArchitecturalFinish } from "../reference/architecturalFinish";

// 仅映射中庭已知的建筑饰面，不改展品、文字、其他房间或原始几何。
const finishes: Record<string, { color: string; roughness: number; metalness: number }> = {
  "#0b1d31": { color: "#282c2d", roughness: .69, metalness: .02 },
  "#101e30": { color: "#303536", roughness: .72, metalness: .02 },
  "#19314c": { color: "#2a2e30", roughness: .76, metalness: .02 },
  "#dcded5": { color: "#777f85", roughness: .66, metalness: .02 },
  "#d0e4eb": { color: "#464f58", roughness: .58, metalness: .025 },
  "#cbdfe9": { color: "#515a62", roughness: .65, metalness: .02 },
  "#d9e8f1": { color: "#7c848a", roughness: .64, metalness: .02 },
  "#e6f0f7": { color: "#8f969b", roughness: .56, metalness: .03 },
  "#a8cfe5": { color: "#949b9a", roughness: .34, metalness: .72 },
  "#8797a2": { color: "#858c8b", roughness: .36, metalness: .72 },
  "#11243a": { color: "#282d2e", roughness: .53, metalness: .24 },
};

const Context=createContext<ReturnType<typeof createSurfaces>|null>(null);
function createSurfaces(maps: ReturnType<typeof useArchitecturalMaps>) {
  const materials = new Map<string, MeshStandardMaterial>();
  return { maps,
    get(color: string, roughness: number, metalness: number, opacity: number, emissive?: string, emissiveIntensity = 1) {
      const key = [color, roughness, metalness, opacity, emissive, emissiveIntensity].join(":");
      if (!materials.has(key)) {
        const finish = finishes[color], kind = (finish?.metalness ?? metalness) > .5 ? "bronze" : "basalt";
        const material = createArchitecturalFinish(kind, maps.stone, { color: finish?.color ?? color, roughness: finish?.roughness ?? roughness, metalness: finish?.metalness ?? metalness });
        material.transparent = opacity < 1; material.opacity = opacity; material.emissive.set(emissive || "#000000"); material.emissiveIntensity = emissiveIntensity;
        const compile = material.onBeforeCompile, cache = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", "outgoingLight*=.76+.24*smoothstep(0.,.7,architecturalPosition.y);\n#include <opaque_fragment>");
        };
        material.customProgramCacheKey = () => "atrium-stone-contact-v2-" + cache;
        materials.set(key, material);
      }
      return materials.get(key)!;
    },
    dispose() { materials.forEach(material => material.dispose()); },
  };
}
export function AtriumSurfaces({children}:{children:ReactNode}){
  return <PrepareArchitecturalMaps timber={false}><PreparedAtriumSurfaces>{children}</PreparedAtriumSurfaces></PrepareArchitecturalMaps>;
}
function PreparedAtriumSurfaces({children}:{children:ReactNode}){
  const maps=useArchitecturalMaps(false),surfaces=useMemo(()=>createSurfaces(maps),[maps]);useEffect(()=>()=>surfaces.dispose(),[surfaces]);return <Context.Provider value={surfaces}>{children}<MasonryDetails /></Context.Provider>;
}
export function useEntrySurfaces() { return useContext(Context)!; }
// 尺寸、位置、门洞与碰撞不变；局部材质与细倒角由这一套自有资源共享。
export function EntryBlock({position,rotation,scale=[1,1,1],color=museum.wall,roughness=.38,metalness=0,opacity=1,emissive,emissiveIntensity=1,castShadow=false,receiveShadow=true,onClick,bevel=.055}:BlockProps){
  const surfaces=useContext(Context)!,tier=usePalaceStore(s=>s.effectiveQuality),[width,height,depth]=scale;
  const geometry=useMemo(()=>new RoundedBoxGeometry(width,height,depth,1,tier==="low"?0:Math.min(bevel,Math.min(width,height,depth)*.16)),[width,height,depth,bevel,tier]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh position={position} rotation={rotation} geometry={geometry} material={surfaces.get(color,roughness,metalness,opacity,emissive,emissiveIntensity)} castShadow={castShadow} receiveShadow={receiveShadow} onClick={onClick} dispose={null}/>;
}
