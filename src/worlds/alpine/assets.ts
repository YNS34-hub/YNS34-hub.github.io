import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { FileLoader, NoColorSpace, RepeatWrapping, SRGBColorSpace, ClampToEdgeWrapping } from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { setAlpineHeightfield, setAlpineDetailfield, type AlpineHeightfield } from "./route";
import type {ImageAtlas} from "./projection";

export const alpineSky = "/media/alpine/clear-daylight-2k.hdr";
class GeographyLoader extends FileLoader {constructor(){super();this.setResponseType("json");}}
class ElevationLoader extends FileLoader {constructor(){super();this.setResponseType("arraybuffer");}}
export interface AlpineGeography {
  massif:Omit<AlpineHeightfield,"values">;detail:Omit<AlpineHeightfield,"values">;
  imagery:ImageAtlas;nearImagery:ImageAtlas;
}
const terrainUrl="/media/alpine/geography.json",demUrls=["/media/alpine/massif-dem.bin","/media/alpine/detail-dem.bin"];
const urls = ['road-color','road-normal','meadow-color','meadow-normal','rock-color','rock-normal','swissimage','swissimage-near'].map(n=>"/media/alpine/"+n+".webp");
export function preloadAlpineAssets() { useTexture.preload(urls); useLoader.preload(RGBELoader,alpineSky); useLoader.preload(GeographyLoader,terrainUrl);useLoader.preload(ElevationLoader,demUrls); }
export function useAlpineGeography(){return useLoader(GeographyLoader,terrainUrl) as unknown as AlpineGeography;}
export function useAlpineHeightfield() {
  const meta=useAlpineGeography(),buffers=useLoader(ElevationLoader,demUrls) as unknown as ArrayBuffer[];
  const fields=useMemo(()=>[meta.massif,meta.detail].map((f,i)=>({...f,values:new Int16Array(buffers[i])})),[meta,buffers]);
  // 解码后的不可变高程只注册一次；骑行器挂载前已经可读取，不引入另一套玩家状态。
  setAlpineHeightfield(fields[0]);setAlpineDetailfield(fields[1]);return fields[0];
}
export function useAlpineTextures() {
  const originals = useTexture(urls), copies = useMemo(()=>originals.map((texture,i)=>{
    const copy=texture.clone();const normal=[1,3,5].includes(i);copy.colorSpace=normal?NoColorSpace:SRGBColorSpace;copy.wrapS=copy.wrapT=i>=6?ClampToEdgeWrapping:RepeatWrapping;copy.anisotropy=normal?4:8;copy.needsUpdate=true;return copy;
  }),[originals]);
  useEffect(()=>()=>copies.forEach(t=>t.dispose()),[copies]);
  return useMemo(()=>({asphalt:copies[0],asphaltNormal:copies[1],meadow:copies[2],meadowNormal:copies[3],rock:copies[4],rockNormal:copies[5],imagery:copies[6],nearImagery:copies[7]}),[copies]);
}
