import { useEffect, useMemo } from "react";
import { useTexture,useGLTF } from "@react-three/drei";
import { useLoader, useThree } from "@react-three/fiber";
import { BackSide, BoxGeometry, Color, EquirectangularReflectionMapping, Mesh, MeshBasicMaterial, PMREMGenerator, Scene, SRGBColorSpace } from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

RectAreaLightUniformsLib.init();
const entrySky='/media/road/sky-4k.webp',entryDaylight='/media/alpine/daylight-2k.hdr';
// World is imported lazily. Start these requests before Environment subscribes to
// loader progress, so a cold atrium render never updates another React component.
if(typeof window!=='undefined'){useTexture.preload(entrySky);useLoader.preload(RGBELoader,entryDaylight);useGLTF.preload('/assets/memory-glass.glb');}

export function createEntryRadiance() {
  const scene=new Scene();scene.background=new Color("#668fb8");
  const geometry=new BoxGeometry(1,1,1),materials=new Set<MeshBasicMaterial>();
  const block=(position:[number,number,number],scale:[number,number,number],color:string,energy=1)=>{
    const material=new MeshBasicMaterial({color,toneMapped:false});material.color.multiplyScalar(energy);materials.add(material);
    const mesh=new Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);scene.add(mesh);
  };
  // 相对玻璃中心的展厅光场：亮屋顶带、深门洞与少量暖侧光；不是均匀灰色产品摄影棚。
  block([0,-4,0],[44,.2,52],"#91a7b9");block([0,4,-23],[44,16,.2],"#152b45");
  for(const z of [-14,-4,6])block([0,10,z],[25,.12,3.4],"#eef8ff",4);
  for(const side of [-1,1]){block([side*17,4,0],[.3,14,44],"#a3c5dd",1.4);block([side*7,0,14],[6,10,.4],"#0a182b");}
  block([-8,3,5],[.2,5,2.6],"#ffe3be",3);
  block([0,4,10],[8,.8,.1],"#edf8ff",6);
  let released=false;
  return {scene,dispose(){if(released)return;released=true;geometry.dispose();materials.forEach(m=>m.dispose());}};
}

export default function AtriumAtmosphere() {
  const {gl,scene}=useThree(),source=useTexture(entrySky),daylight=useLoader(RGBELoader,entryDaylight);
  const sky=useMemo(()=>{const texture=source.clone();texture.colorSpace=SRGBColorSpace;texture.needsUpdate=true;return texture;},[source]);
  useEffect(()=>()=>sky.dispose(),[sky]);
  useEffect(()=>{
    const previous=scene.environment,probe=createEntryRadiance(),generator=new PMREMGenerator(gl);
    // 借用已有公共 HDR 的真实太阳 / 云层辐亮度，建筑遮挡仍由专属光场提供；原缓存不被修改。
    const skyLight=daylight.clone();skyLight.mapping=EquirectangularReflectionMapping;skyLight.needsUpdate=true;probe.scene.background=skyLight;
    const target=generator.fromScene(probe.scene,.045);target.texture.name="atrium-radiance-probe";skyLight.dispose();probe.dispose();generator.dispose();scene.environment=target.texture;
    return()=>{if(scene.environment===target.texture)scene.environment=previous;target.dispose();};
  },[gl,scene,daylight]);
  // 屋顶开口看到真实公共天空照片，原 HDR / 其他房间背景不被改写。
  return <><mesh name="atrium-roof-sky" position={[0,4,-10]} rotation={[0,Math.PI*.45,0]} raycast={()=>{}}>
    <sphereGeometry args={[80,48,24]}/><meshBasicMaterial map={sky} side={BackSide} fog={false} toneMapped={false}/>
  </mesh>
    {/* 两处屏幕下的暖光有明确归属；只补软侧光，不增加阴影相机或全屏光效。 */}
    {[-1,1].map(side=><rectAreaLight key={side} position={[side*12.2,1.2,-8.5]} rotation={[-Math.PI/2,0,0]} color="#ffe3bf" intensity={12} width={6.4} height={2}/>) }
  </>;
}
