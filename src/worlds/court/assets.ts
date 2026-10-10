import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { FileLoader, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

class ShapeLoader extends FileLoader { constructor() { super(); this.setResponseType("json"); } }
export interface TreeShape { height: number; parts: { position: number[]; normal: number[]; uv: number[]; index: number[] }[]; crown: [number, number, number][] }
export const crowdNames = ["Male_Adult_03", "Male_Adult_08", "Male_Adult_12", "Female_Adult_05", "Female_Adult_08", "Male_Adult_19"];
export function useTreeShape() { return useLoader(ShapeLoader, "/media/court/tree/shape.json") as unknown as TreeShape; }
export function useCourtMaps(prefix: string, repeat: [number, number] = [1, 1]) {
  const source = useTexture(["color", "normal", "rough"].map(c => "/media/court/" + prefix + "-" + c + ".webp"));
  const [x, y] = repeat;
  const maps = useMemo(() => source.map((t, i) => { const m = t.clone(); m.colorSpace = i === 0 ? SRGBColorSpace : NoColorSpace; m.wrapS = m.wrapT = RepeatWrapping; m.repeat.set(x, y); m.anisotropy = i === 0 ? 8 : 4; m.needsUpdate = true; return m; }), [source, x, y]);
  useEffect(() => () => maps.forEach(t => t.dispose()), [maps]);
  return { map: maps[0], normalMap: maps[1], roughnessMap: maps[2] };
}
export function preloadCourtAssets() {
  useLoader.preload(RGBELoader, "/media/alpine/clear-daylight-2k.hdr");
  useLoader.preload(ShapeLoader, "/media/court/tree/shape.json");
  crowdNames.forEach(n => useGLTF.preload("/media/court/people/" + n + "/pose.gltf"));
  for (const prefix of ["aggregate", "paving"]) useTexture.preload(["color", "normal", "rough"].map(c => "/media/court/" + prefix + "-" + c + ".webp"));
  useTexture.preload(["branches-color", "branches-normal", "trunk-color", "trunk-normal", "leaves-color"].map(n => "/media/court/tree/" + n + ".webp"));
  useTexture.preload("/media/court/painting.webp"); useTexture.preload("/media/court/day-sky.webp");
}
