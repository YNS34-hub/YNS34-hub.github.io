import { useEffect,useRef } from "react";
import { useFrame,useThree } from "@react-three/fiber";
import { BackSide,Scene,SphereGeometry,Mesh,ShaderMaterial,PMREMGenerator,DirectionalLight,PerspectiveCamera } from "three";
import { useProgress,useGLTF } from "@react-three/drei";
import { usePalaceStore } from "../../systems/store";
import { useLibraryStore } from "../../systems/library";
import { textureStatus } from "../../world/textureCache";
import { useQuietMotion } from "../../motion/useMotionCue";

const vertex="varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
const fragment=`uniform float time;varying vec3 direction;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){vec3 d=normalize(direction);float h=max(0.,d.y);vec3 c=mix(vec3(.57,.64,.66),vec3(.14,.34,.54),pow(h,.48));
vec3 sun=normalize(vec3(-.67,.28,-.53));float a=max(0.,dot(d,sun));c+=vec3(.33,.22,.10)*pow(a,20.);c=mix(c,vec3(1.4,1.14,.72),smoothstep(.99925,.99965,a));
vec2 uv=d.xz/max(.18,d.y)*.8+vec2(time*.0003,0.);float cloud=noise(uv*2.)*.5+noise(uv*4.1)*.3+noise(uv*8.2)*.2;
float mask=smoothstep(.60,.76,cloud)*smoothstep(.06,.3,h)*(1.-smoothstep(.6,.9,h));c=mix(c,vec3(.83,.82,.75),mask*.66);
gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>
#include <colorspace_fragment>}`.replace(";#include",";\n#include");
export default function RoadEnvironment({onReady}:{onReady?:()=>void}){
  const quiet=useQuietMotion();
  const {camera,gl,scene}=useThree(),quality=usePalaceStore(s=>s.effectiveQuality),{active}=useProgress();
  const sun=useRef<DirectionalLight>(null),sky=useRef<Mesh>(null),sent=useRef(false),uniforms=useRef({time:{value:0}});
  useEffect(()=>{
    const far=camera.far;camera.far=2800;camera.updateProjectionMatrix();useGLTF.preload("/assets/memory-glass.glb");
    const env=new Scene(),geo=new SphereGeometry(10,32,16),mat=new ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{time:{value:0}},side:BackSide});env.add(new Mesh(geo,mat));
    const generator=new PMREMGenerator(gl),target=generator.fromScene(env,.04);scene.environment=target.texture;scene.environmentIntensity=.62;generator.dispose();geo.dispose();mat.dispose();
    return()=>{target.dispose();scene.environment=null;camera.far=far;if(camera instanceof PerspectiveCamera)camera.fov=60;camera.updateProjectionMatrix();};
  },[camera,gl,scene]);
  useFrame((_,dt)=>{
    if(!quiet)uniforms.current.time.value+=Math.min(dt,.06);sky.current?.position.copy(camera.position);
    if(sun.current){sun.current.position.set(camera.position.x-67,camera.position.y+28,camera.position.z-53);sun.current.target.position.copy(camera.position);sun.current.target.updateMatrixWorld();}
    if(!sent.current&&scene.getObjectByName("long-way-home-road-world")&&scene.getObjectByName("prepared-world:cycling")?.userData.prepared&&useLibraryStore.getState().ready&&!active&&!textureStatus().pending){sent.current=true;onReady?.();}
  });
  return <><color attach="background" args={["#b5c3cb"]}/><fog attach="fog" args={["#b5c3cb",550,2350]}/>
    <mesh ref={sky} name="long-way-home-daylight" raycast={()=>{}}><sphereGeometry args={[2600,32,16]}/><shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms.current} side={BackSide} depthWrite={false}/></mesh>
    <hemisphereLight args={["#b7d3e2","#6a6656",.85]}/><directionalLight ref={sun} position={[-67,28,-53]} color="#ffe2b2" intensity={2.25} castShadow={quality!=="low"} shadow-mapSize={quality==="high"?[2048,2048]:[1024,1024]} shadow-camera-left={-38} shadow-camera-right={38} shadow-camera-top={38} shadow-camera-bottom={-38} shadow-camera-far={170} shadow-normalBias={.08} shadow-bias={-.00015}/>
  </>;
}
