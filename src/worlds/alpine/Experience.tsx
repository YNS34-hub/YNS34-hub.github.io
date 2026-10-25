import RoadExperience from "../road/Experience";
import AlpineLandscape from "./Landscape";
import {useAlpineHeightfield} from "./assets";
import {preloadAlpineAssets as preloadMaps} from "./assets";
import {preloadAlpineScans} from "./Scans";
import {preloadAlpineVegetation} from "./Vegetation";
import {preloadAlpineGrass} from "./Grass";
export function preloadAlpineAssets(){preloadMaps();preloadAlpineScans();preloadAlpineVegetation();preloadAlpineGrass();}

// 只扩展风景，骑姿、换档、相机、照片模式与环境音继续来自已验证的原骑行体验。
export default function AlpineExperience(){useAlpineHeightfield();return <RoadExperience landscape={<AlpineLandscape/>}/>;}
