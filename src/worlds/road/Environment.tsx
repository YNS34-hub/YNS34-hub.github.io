import { useEffect,useMemo,useRef } from "react";
import { useFrame,useLoader,useThree } from "@react-three/fiber";
import { EquirectangularReflectionMapping,PMREMGenerator,DirectionalLight,PerspectiveCamera,SRGBColorSpace } from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { useProgress,useGLTF,useTexture } from "@react-three/drei";
import { usePalaceStore } from "../../systems/store";
import { useLibraryStore } from "../../systems/library";
import { textureStatus } from "../../world/textureCache";
import { scenicHDR,scenicSky,forestSun,forestSkyRotation } from "../scenery/lighting";
export default function RoadEnvironment({onReady}:{onReady?:()=>void}){
  const {camera,gl,scene}=useThree(),quality=usePalaceStore(s=>s.effectiveQuality),{active}=useProgress();
  const hdr=useLoader(RGBELoader,scenicHDR),source=useTexture(scenicSky);
  const background=useMemo(()=>{const t=source.clone();t.mapping=EquirectangularReflectionMapping;t.colorSpace=SRGBColorSpace;t.needsUpdate=true;return t;},[source]);
  const sun=useRef<DirectionalLight>(null),sent=useRef(false);
  useEffect(()=>()=>background.dispose(),[background]);
  useEffect(()=>{
    const far=camera.far;camera.far=8000;camera.updateProjectionMatrix();useGLTF.preload("/assets/memory-glass.glb");
    hdr.mapping=EquirectangularReflectionMapping;
    const generator=new PMREMGenerator(gl),target=generator.fromEquirectangular(hdr);generator.dispose();
    // 静态摄影与反射使用相同方位；低角度太阳仍沿原方向，不改变玩家镜头或路线。
    scene.background=background;scene.backgroundIntensity=.96;scene.environment=target.texture;scene.environmentIntensity=.72;
    scene.backgroundRotation.set(0,forestSkyRotation,0);scene.environmentRotation.set(0,forestSkyRotation,0);
    return()=>{target.dispose();scene.background=null;scene.backgroundIntensity=1;scene.backgroundRotation.set(0,0,0);scene.environmentRotation.set(0,0,0);scene.environment=null;camera.far=far;if(camera instanceof PerspectiveCamera)camera.fov=60;camera.updateProjectionMatrix();};
  },[camera,gl,scene,hdr,background]);
  useFrame(()=>{
    if(sun.current){sun.current.position.set(camera.position.x+forestSun[0],camera.position.y+forestSun[1],camera.position.z+forestSun[2]);sun.current.target.position.copy(camera.position);sun.current.target.updateMatrixWorld();}
    if(!sent.current&&scene.getObjectByName("long-way-home-road-world")&&scene.getObjectByName("prepared-world:cycling")?.userData.prepared&&useLibraryStore.getState().ready&&!active&&!textureStatus().pending){sent.current=true;onReady?.();}
  });
  return <><fog attach="fog" args={["#bdcedb",250,2450]}/>
    <hemisphereLight args={["#c2d8eb","#77735c",1.02]}/><directionalLight ref={sun} position={forestSun} color="#ffe3b9" intensity={2.5} castShadow={quality!=="low"} shadow-mapSize={quality==="high"?[2048,2048]:[1024,1024]} shadow-camera-left={-38} shadow-camera-right={38} shadow-camera-top={38} shadow-camera-bottom={-38} shadow-camera-far={170} shadow-normalBias={.035} shadow-bias={-.00012}/>
  </>;
}
