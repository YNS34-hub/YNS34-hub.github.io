import {useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {useTexture} from "@react-three/drei";
import {useFrame,useLoader} from "@react-three/fiber";
import {BufferGeometry,DoubleSide,FileLoader,Float32BufferAttribute,Group,InstancedMesh,MeshStandardMaterial,PlaneGeometry,SRGBColorSpace,Vector3} from "three";
import Instances,{type Instance} from "../Instances";
import {usePineShape} from "../road/textures";
import {usePalaceStore} from "../../systems/store";
import {useQuietMotion} from "../../motion/useMotionCue";
import {alpineGround,alpineLength,alpineSectorLength,nearestAlpine,sampleAlpine} from "./route";

const urls=["/media/road/bark.webp","/media/road/pine.webp"];
export function preloadAlpineVegetation(){useTexture.preload(urls);useLoader.preload(FileLoader,"/media/road/pine-shape.json",loader=>loader.setResponseType("json"));}
// 使用已归档的 CC0 松树结构与枝叶，保持原森林地图及其材质完全不动。
export function AlpineVegetation({index}:{index:number}){
  const shape=usePineShape(),originals=useTexture(urls),tier=usePalaceStore(s=>s.effectiveQuality),quiet=useQuietMotion(),root=useRef<Group>(null);
  const maps=useMemo(()=>originals.map(source=>{const t=source.clone();t.colorSpace=SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;return t;}),[originals]);
  useEffect(()=>()=>maps.forEach(t=>t.dispose()),[maps]);
  const data=useMemo(()=>{
    let seed=8123+index*433;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
    const p=new Vector3(),t=new Vector3(),trees:Instance[]=[],twigs:Instance[]=[],start=index*alpineSectorLength,end=Math.min(alpineLength,start+alpineSectorLength);
    for(let d=start+12;d<end;d+=12){
      sampleAlpine(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz);
      for(const side of[-1,1]){
        const off=side*(12+rand()*65),x=p.x+nx/r*off,z=p.z+nz/r*off,y=alpineGround(x,z);
        // 林线在海拔约 2050 米淡出，不在山口凭空种树林；陡坡和公路保持开放。
        if(y>570||rand()>(570-y)/260||nearestAlpine(x,z).distance<9||Math.hypot(alpineGround(x+2,z)-alpineGround(x-2,z),alpineGround(x,z+2)-alpineGround(x,z-2))>3.5)continue;
        const size=(10+rand()*9)/shape.height,angle=rand()*Math.PI*2,cs=Math.cos(angle),sn=Math.sin(angle);
        trees.push({position:[x,y-.08,z],scale:[size,size,size],rotation:[0,angle,0]});
        for(let k=0;k<shape.crown.length;k+=tier==="low"?8:2){
          const a=shape.crown[k],w=.90+rand()*.22;
          twigs.push({position:[x+(a[0]*cs+a[2]*sn)*size,y+a[1]*size,z+(-a[0]*sn+a[2]*cs)*size],scale:[.8*w*size,1.9*w*size,1],rotation:[(rand()-.5)*1.4,rand()*6.28,(rand()-.5)*1.7]});
        }
      }
    }
    const wood=new BufferGeometry();wood.setAttribute("position",new Float32BufferAttribute(shape.position,3));wood.setAttribute("normal",new Float32BufferAttribute(shape.normal,3));wood.setAttribute("uv",new Float32BufferAttribute(shape.uv,2));wood.setIndex(shape.index);wood.computeBoundingSphere();
    return{trees,twigs,wood,leaf:new PlaneGeometry(1,1),time:{value:0},wind:{value:quiet?0:.04}};
  },[shape,index,tier,quiet]);
  useEffect(()=>()=>{data.wood.dispose();data.leaf.dispose();},[data]);
  useLayoutEffect(()=>{
    root.current?.traverse(o=>{
      if(!(o instanceof InstancedMesh))return;
      const m=o.material as MeshStandardMaterial;if(m.map!==maps[1])return;
      m.side=DoubleSide;m.alphaToCoverage=true;m.forceSinglePass=true;
      m.onBeforeCompile=shader=>{
        shader.uniforms.alpineLeafTime=data.time;shader.uniforms.alpineLeafWind=data.wind;
        shader.vertexShader="uniform float alpineLeafTime;uniform float alpineLeafWind;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ntransformed.x+=sin(alpineLeafTime*.6+instanceMatrix[3].x*.2)*alpineLeafWind*uv.y;");
      };m.customProgramCacheKey=()=>"alpine-pine-breeze-v1";m.needsUpdate=true;
    });
  },[data,maps]);
  useFrame((_,dt)=>{if(!quiet)data.time.value+=Math.min(.06,dt);});
  return <group ref={root} name={"alpine-treeline:"+index}><Instances geometry={data.wood} items={data.trees} map={maps[0]} color="#b3aca0" shadows/><Instances geometry={data.leaf} items={data.twigs} map={maps[1]} color="#8c9f79" cutout shadows/></group>;
}
