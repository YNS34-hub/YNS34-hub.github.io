import {useEffect,useRef} from "react";
import {useFrame,useLoader,useThree} from "@react-three/fiber";
import {useGLTF,useProgress} from "@react-three/drei";
import {DirectionalLight,EquirectangularReflectionMapping,PMREMGenerator,PerspectiveCamera} from "three";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js";
import {usePalaceStore} from "../../systems/store";
import {useLibraryStore} from "../../systems/library";
import {textureStatus} from "../../world/textureCache";
import {alpineSky} from "./assets";

export default function AlpineEnvironment({onReady}:{onReady?:()=>void}){
  const {camera,gl,scene}=useThree(),hdr=useLoader(RGBELoader,alpineSky),sun=useRef<DirectionalLight>(null),sent=useRef(false),{active}=useProgress();
  const quality=usePalaceStore(s=>s.effectiveQuality);
  useEffect(()=>{
    const far=camera.far;camera.far=16000;camera.updateProjectionMatrix();useGLTF.preload("/assets/memory-glass.glb");
    hdr.mapping=EquirectangularReflectionMapping;
    const generator=new PMREMGenerator(gl),target=generator.fromEquirectangular(hdr);generator.dispose();
    scene.background=hdr;scene.backgroundIntensity=.45;scene.environment=target.texture;scene.environmentIntensity=.40;
    // 一次生成环境反射；没有每帧离屏相机或额外全屏后处理。
    return()=>{target.dispose();scene.background=null;scene.backgroundIntensity=1;scene.environment=null;camera.far=far;if(camera instanceof PerspectiveCamera)camera.fov=60;camera.updateProjectionMatrix();};
  },[camera,gl,scene,hdr]);
  useFrame(()=>{
    if(sun.current){sun.current.position.set(camera.position.x-100,camera.position.y+80,camera.position.z+90);sun.current.target.position.copy(camera.position);sun.current.target.updateMatrixWorld();}
    if(!sent.current&&scene.getObjectByName("alpine-descent-world")&&scene.getObjectByName("prepared-world:alpine-ride")?.userData.prepared&&useLibraryStore.getState().ready&&!active&&!textureStatus().pending){sent.current=true;onReady?.();}
  });
  return <><fog attach="fog" args={["#b3c8d5",1800,14500]}/><hemisphereLight args={["#c1dcf1","#7d7954",.40]}/>
    <directionalLight ref={sun} position={[-85,145,55]} color="#fff0d6" intensity={3.1} castShadow={quality!=="low"} shadow-mapSize={quality==="low"?[512,512]:[2048,2048]} shadow-camera-left={-64} shadow-camera-right={64} shadow-camera-top={64} shadow-camera-bottom={-64} shadow-camera-far={480} shadow-normalBias={.055} shadow-bias={-.0001}/>
  </>;
}
