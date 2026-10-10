import { roadLength, roadSample, terrainHeight, roadChapter, roadForestDensity, lakeDistance, roadStops, activeRoadSectors } from "./route";
import { alpineMap } from "../alpine/route";
import type { RideMap } from "./mapTypes";

export const forestMap: RideMap = {
  id:"cycling",title:"THE LONG WAY HOME",subtitle:"森林湖谷 · 原地图",sceneName:"long-way-home-road-world",saveKey:"memory-palace:road:v2",
  length:roadLength,sample:roadSample,ground:terrainHeight,chapter:roadChapter,forest:roadForestDensity,
  water:(x,z)=>Math.max(0,1-(lakeDistance(x,z)-1)/.65),stops:roadStops,sectors:activeRoadSectors,
};
export const rideMaps = [forestMap, alpineMap];
export const isRideScene = (id: string) => id === "cycling" || id === "alpine-ride";
export const getRideMap = (id: string) => id === "alpine-ride" ? alpineMap : forestMap;
