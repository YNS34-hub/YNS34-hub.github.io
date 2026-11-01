import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, type BufferGeometry, type MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { BlockProps } from "../../world/primitives";
import { usePalaceStore } from "../../systems/store";
import { createArchitecturalFinish, type ArchitecturalMaps, type FinishKind } from "./architecturalFinish";
import RoomRadiance from "./RoomRadiance";

const mapUrls = (withTimber: boolean) => (withTimber ? ["Concrete034", "WoodFloor051"] : ["Concrete034"]).flatMap(name => ["Color", "NormalGL", "Roughness"].map(channel => `/media/surfaces/${name}_1K-JPG_${channel}.jpg`));
export const architecturalDaylightUrl = "/media/road/sky-4k.webp";
export function PrepareArchitecturalMaps({ children, timber = true, daylight = false }: { children: ReactNode; timber?: boolean; daylight?: boolean }) {
  const [prepared, setPrepared] = useState<string | null>(null), key = `${timber}:${daylight}`;
  useEffect(() => {
    // 与读取方使用完全相同的缓存键；在提交阶段启动，避免跨房间渲染通知旧进度订阅者。
    useTexture.preload(mapUrls(timber));
    if (daylight) useTexture.preload(architecturalDaylightUrl);
    setPrepared(key);
  }, [timber, daylight, key]);
  return prepared === key ? children : null;
}
export function useArchitecturalMaps(withTimber = true) {
  const source = useTexture(mapUrls(withTimber));
  const maps = useMemo(() => {
    const copies = source.map((texture, i) => {
      const own = texture.clone(); own.colorSpace = i % 3 === 0 ? SRGBColorSpace : NoColorSpace;
      own.wrapS = own.wrapT = RepeatWrapping; own.anisotropy = 4; own.needsUpdate = true; return own;
    });
    return { stone: { color: copies[0], normal: copies[1], roughness: copies[2] }, timber: { color: copies[3] || copies[0], normal: copies[4] || copies[1], roughness: copies[5] || copies[2] }, dispose: () => copies.forEach(texture => texture.dispose()) };
  }, [source]);
  useEffect(() => () => maps.dispose(), [maps]);
  return maps;
}

type Resources = { maps: { stone: ArchitecturalMaps; timber: ArchitecturalMaps }; material: (kind: FinishKind, color?: string, roughness?: number, metalness?: number, floor?: boolean) => MeshStandardMaterial; geometry: (width: number, height: number, depth: number, radius: number) => BufferGeometry };
const Context = createContext<Resources | null>(null);
export function useOptionalArchitecturalSurfaces() { return useContext(Context); }
export function ArchitecturalSurfaces({ children, radiance }: { children: ReactNode; radiance?: "research" | "music" | "projects" | "wallpapers" }) {
  return <PrepareArchitecturalMaps timber={radiance !== "wallpapers"} daylight={radiance === "projects" || radiance === "research"}><PreparedArchitecturalSurfaces radiance={radiance}>{children}</PreparedArchitecturalSurfaces></PrepareArchitecturalMaps>;
}
function PreparedArchitecturalSurfaces({ children, radiance }: { children: ReactNode; radiance?: "research" | "music" | "projects" | "wallpapers" }) {
  const maps = useArchitecturalMaps(radiance !== "wallpapers");
  const resources = useMemo(() => {
    const materials = new Map<string, MeshStandardMaterial>(), geometries = new Map<string, BufferGeometry>();
    return { maps,
      material(kind: FinishKind, color?: string, roughness?: number, metalness?: number, floor = false) {
        const key = [kind, color, roughness, metalness, floor].join(":");
        if (!materials.has(key)) materials.set(key, createArchitecturalFinish(kind, kind === "timber" ? maps.timber : maps.stone, { color, roughness, metalness, floor }));
        return materials.get(key)!;
      },
      geometry(width: number, height: number, depth: number, radius: number) {
        const key = [width, height, depth, radius].join(":");
        if (!geometries.has(key)) geometries.set(key, new RoundedBoxGeometry(width, height, depth, 1, radius));
        return geometries.get(key)!;
      }, dispose() { materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose()); },
    };
  }, [maps]);
  useEffect(() => () => resources.dispose(), [resources]);
  return <Context.Provider value={resources}>{radiance && <RoomRadiance room={radiance} />}{children}</Context.Provider>;
}
export function useArchitecturalSurfaces() {
  const resources = useContext(Context);
  if (!resources) throw new Error("Architectural material requires its room-owned provider");
  return resources;
}
export function ArchitecturalBlock({ finish = "basalt", position, rotation, scale = [1, 1, 1], color, roughness, metalness, bevel = .04, castShadow = false, receiveShadow = true, onClick }: BlockProps & { finish?: FinishKind }) {
  const resources = useArchitecturalSurfaces(), tier = usePalaceStore(state => state.effectiveQuality);
  const radius = tier === "low" ? 0 : Math.min(bevel, Math.min(...scale) * .16);
  return <mesh position={position} rotation={rotation} geometry={resources.geometry(...scale, radius)} material={resources.material(finish, color, roughness, metalness)} castShadow={castShadow} receiveShadow={receiveShadow} onClick={onClick} dispose={null} />;
}
