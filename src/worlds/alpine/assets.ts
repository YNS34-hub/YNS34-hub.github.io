import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { FileLoader, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { setAlpineHeightfield, type AlpineHeightfield } from "./route";

export const alpineSky = "/media/alpine/daylight-2k.hdr";
const terrainUrl = "/media/alpine/terrain.json", json = (loader: FileLoader) => loader.setResponseType("json");
const urls = ["/media/road/asphalt.webp","/media/road/asphalt-normal.webp",...['meadow-color','meadow-normal','rock-color','rock-normal'].map(n=>"/media/alpine/"+n+".webp")];
export function preloadAlpineAssets() { useTexture.preload(urls); useLoader.preload(RGBELoader,alpineSky); useLoader.preload(FileLoader,terrainUrl,json); }
export function useAlpineHeightfield() {
  const data = useLoader(FileLoader,terrainUrl,json) as unknown as AlpineHeightfield;
  // 解码后的不可变高程只注册一次；骑行器挂载前已经可读取，不引入另一套玩家状态。
  setAlpineHeightfield(data);return data;
}
export function useAlpineTextures() {
  const originals = useTexture(urls), copies = useMemo(()=>originals.map((texture,i)=>{
    const copy=texture.clone();copy.colorSpace=i%2?NoColorSpace:SRGBColorSpace;copy.wrapS=copy.wrapT=RepeatWrapping;copy.anisotropy=i%2?4:8;copy.needsUpdate=true;return copy;
  }),[originals]);
  useEffect(()=>()=>copies.forEach(t=>t.dispose()),[copies]);
  return {asphalt:copies[0],asphaltNormal:copies[1],meadow:copies[2],meadowNormal:copies[3],rock:copies[4],rockNormal:copies[5]};
}
