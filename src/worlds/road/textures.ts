import { useMemo,useEffect } from "react";
import { useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { RepeatWrapping,ClampToEdgeWrapping,SRGBColorSpace,NoColorSpace,FileLoader } from "three";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js";
import {scenicSky,scenicHDR} from "../scenery/lighting";
import {preloadAlpineScans} from "../alpine/Scans";
import {preloadAlpineGrass} from "../alpine/Grass";
import type {RidgeSamples} from "../scenery/landforms";
import {preloadForestTrees} from "../scenery/ForestTrees";
import {preloadAlpineGeography} from "../alpine/assets";

export const roadTextureUrls=["asphalt","asphalt-normal","bark","pine","ground","grass","ridge-rock","ridge-normal","meadow","meadow-normal"].map(name=>"/media/road/"+name+".webp").concat('/media/alpine/swissimage.webp');
export interface PineShape {height:number;position:number[];normal:number[];uv:number[];index:number[];crown:number[][]}
const json=(loader:FileLoader)=>loader.setResponseType("json"),shapeUrl="/media/road/pine-shape.json";
const ridgeUrl="/media/road/ridge-samples.json";
export function useRidgeSamples(){return useLoader(FileLoader,ridgeUrl,json) as unknown as RidgeSamples;}
export function usePineShape(){return useLoader(FileLoader,shapeUrl,json) as unknown as PineShape;}
export function primeRoadTextures(){preloadAlpineGeography();useTexture.preload(roadTextureUrls);useTexture.preload(scenicSky);useLoader.preload(RGBELoader,scenicHDR);useLoader.preload(FileLoader,shapeUrl,json);useLoader.preload(FileLoader,ridgeUrl,json);preloadAlpineScans();preloadAlpineGrass();preloadForestTrees();}
// 解码缓存由 drei 管理，各路线挂载只拥有克隆的 sampler。卸载不会销毁另一处仍在用的原纹理。
export function useRoadTextures(){
  const originals=useTexture(roadTextureUrls);
  const copies=useMemo(()=>originals.map((texture,i)=>{
    const t=texture.clone();t.colorSpace=[1,7,9].includes(i)?NoColorSpace:SRGBColorSpace;t.anisotropy=i===0?8:4;
    if(i===10)t.wrapS=t.wrapT=ClampToEdgeWrapping;
    else if(i!==3){t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(1,1);}t.needsUpdate=true;return t;
  }),[originals]);
  useEffect(()=>()=>copies.forEach(t=>t.dispose()),[copies]);
  return useMemo(()=>({asphalt:copies[0],normal:copies[1],bark:copies[2],pine:copies[3],ground:copies[4],grass:copies[5],rock:copies[6],rockNormal:copies[7],meadow:copies[8],meadowNormal:copies[9],aerial:copies[10]}),[copies]);
}
