import {useEffect,useMemo,useRef} from "react";
import {useFrame,useLoader,useThree} from "@react-three/fiber";
import {useGLTF,useProgress,useTexture} from "@react-three/drei";
import {DirectionalLight,EquirectangularReflectionMapping,PMREMGenerator,PerspectiveCamera,SRGBColorSpace} from "three";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js";
import {usePalaceStore} from "../../systems/store";
import {useLibraryStore} from "../../systems/library";
import {textureStatus} from "../../world/textureCache";
import {alpineSky,alpineBackdrop,useAlpineGeography} from "./assets";

export default function AlpineEnvironment({onReady}:{onReady?:()=>void}){
  const {camera,gl,scene}=useThree(),hdr=useLoader(RGBELoader,alpineSky),backgroundSource=useTexture(alpineBackdrop),sun=useRef<DirectionalLight>(null),sent=useRef(false),{active}=useProgress();
  const background=useMemo(()=>{const texture=backgroundSource.clone();texture.mapping=EquirectangularReflectionMapping;texture.colorSpace=SRGBColorSpace;texture.needsUpdate=true;return texture;},[backgroundSource]);
  useEffect(()=>()=>background.dispose(),[background]);
  const quality=usePalaceStore(s=>s.effectiveQuality),{sun:{direction}}=useAlpineGeography();
  useEffect(()=>{
    const far=camera.far;camera.far=16000;camera.updateProjectionMatrix();useGLTF.preload("/assets/memory-glass.glb");
    hdr.mapping=EquirectangularReflectionMapping;
    const generator=new PMREMGenerator(gl),target=generator.fromEquirectangular(hdr);generator.dispose();
    // 大尺寸 LDR 只负责观看；小尺寸 HDR 负责光照，避免为天空清晰度创建巨大 PMREM。
    scene.background=background;scene.backgroundIntensity=1;scene.environment=target.texture;scene.environmentIntensity=.30;
    // 一次生成环境反射；没有每帧离屏相机或额外全屏后处理。
    return()=>{target.dispose();scene.background=null;scene.backgroundIntensity=1;scene.environment=null;camera.far=far;if(camera instanceof PerspectiveCamera)camera.fov=60;camera.updateProjectionMatrix();};
  },[camera,gl,scene,hdr,background]);
  useFrame(()=>{
    if(sun.current){sun.current.position.set(camera.position.x+direction[0],camera.position.y+direction[1],camera.position.z+direction[2]);sun.current.target.position.copy(camera.position);sun.current.target.updateMatrixWorld();}
    if(!sent.current&&scene.getObjectByName("alpine-descent-world")&&scene.getObjectByName("prepared-world:alpine-ride")?.userData.prepared&&useLibraryStore.getState().ready&&!active&&!textureStatus().pending){sent.current=true;onReady?.();}
  });
  return <><fog attach="fog" args={["#adcce0",2500,16000]}/><hemisphereLight args={["#b9d7f1","#596648",.30]}/>
    <directionalLight ref={sun} position={direction} color="#fff4df" intensity={3.05} castShadow={quality!=="low"} shadow-mapSize={quality==="low"?[512,512]:[2048,2048]} shadow-camera-left={-64} shadow-camera-right={64} shadow-camera-top={64} shadow-camera-bottom={-64} shadow-camera-far={480} shadow-normalBias={.035} shadow-bias={-.0001}/>
  </>;
}
