import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useLoader} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import {BufferGeometry,DoubleSide,FrontSide,FileLoader,Float32BufferAttribute,Group,InstancedMesh,MeshDepthMaterial,MeshStandardMaterial,Object3D,RGBADepthPacking,SRGBColorSpace,NoColorSpace,RepeatWrapping,Vector2,Vector3,type WebGLProgramParametersWithUniforms} from 'three';
import {usePalaceStore} from '../../systems/store';
import {useQuietMotion} from '../../motion/useMotionCue';
import {roadView} from '../road/state';
import {forestLod,type ForestLod} from './forestLod';
import {disposeForestInstances} from './forestResources';
import type {Instance} from '../Instances';

export type ForestTree=Instance&{model:0|1;variant:number};
type Part={position:number[];normal:number[];uv:number[];index:number[];leaf:boolean};
type Shape={variants:{height:number;lods:Part[][]}[]};
const root='/media/road/forest/',ids=['fir_tree_01','pine_sapling_small'];
const urls=ids.flatMap((id,i)=>(i?['bark-color','bark-normal']:['bark-color','bark-normal','twig-color','twig-normal']).map(kind=>root+id+'-'+kind+'.webp'));
const json=(loader:FileLoader)=>loader.setResponseType('json');
export function preloadForestTrees(){useTexture.preload(urls);useLoader.preload(FileLoader,ids.map(id=>root+id+'.json'),json);}
export function useForestAssets(){
 const shapes=useLoader(FileLoader,ids.map(id=>root+id+'.json'),json) as unknown as Shape[],originals=useTexture(urls);
 const quiet=useQuietMotion(),wind=useRef({time:{value:0},amount:{value:0}});
 const resources=useMemo(()=>{
  // 解码图像继续由原缓存拥有，只释放本空间的 sampler、几何与材质，避免重访后破图。
  const maps=originals.map((source,i)=>{const texture=source.clone();texture.colorSpace=i%2?NoColorSpace:SRGBColorSpace;texture.anisotropy=4;if(i%4<2)texture.wrapS=texture.wrapT=RepeatWrapping;texture.needsUpdate=true;return texture;});
  const models=shapes.map((shape,model)=>shape.variants.map(variant=>variant.lods.map((parts,lod)=>parts.map(part=>{
   const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(part.position,3));geometry.setAttribute('normal',new Float32BufferAttribute(part.normal,3));geometry.setAttribute('uv',new Float32BufferAttribute(part.uv,2));geometry.setIndex(part.index);geometry.computeBoundingSphere();
   // 针叶微法线只在近档采样；中远档保留原照片、真实冠层轮廓和动态阴影，不花像素预算读不可辨细节。
   const normalMap=(part.leaf?lod===0:lod<2)?maps[part.leaf?3:model*4+1]:null;
   const material=new MeshStandardMaterial({map:maps[part.leaf?2:model*4],normalMap,normalScale:new Vector2(.35,.35),roughness:part.leaf?.91:.96,alphaTest:part.leaf?.42:0,side:part.leaf?DoubleSide:FrontSide,envMapIntensity:.6,alphaToCoverage:part.leaf});
   const depth=new MeshDepthMaterial({depthPacking:RGBADepthPacking,map:material.map,alphaTest:material.alphaTest,side:material.side});
   if(part.leaf){
    // 沿用原树林的小幅风感，根部固定；颜色 / 光照仍由真实 PBR 决定，不额外抬亮全部树叶。
    const patch=(shader:WebGLProgramParametersWithUniforms)=>{shader.uniforms.forestTime=wind.current.time;shader.uniforms.forestWind=wind.current.amount;shader.vertexShader='uniform float forestTime;uniform float forestWind;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.x+=sin(forestTime*.62+position.y*.91+position.z*.7)*forestWind*smoothstep(${(variant.height*.35).toFixed(3)},${(variant.height*.85).toFixed(3)},position.y);`);};
    material.onBeforeCompile=patch;depth.onBeforeCompile=patch;material.customProgramCacheKey=depth.customProgramCacheKey=()=>`grounded-conifer-${model}-${variant.height}-v1`;
   }
   return{geometry,material,depth};
  }))));
 return{maps,models,heights:shapes.map(shape=>shape.variants.map(variant=>variant.height))};
 },[shapes,originals]);
 useEffect(()=>()=>{resources.maps.forEach(t=>t.dispose());resources.models.flat(3).forEach(p=>{p.geometry.dispose();p.material.dispose();p.depth.dispose();});},[resources]);
 useFrame((_,dt)=>{if(!quiet)wind.current.time.value+=Math.min(dt,.06);wind.current.amount.value=quiet?0:.025+.025*Math.min(1,roadView.speed/15.28);});
 return resources;
}
export type ForestAssets=ReturnType<typeof useForestAssets>;
export default function ForestTrees({trees,assets,shadows=false}:{trees:ForestTree[];assets:ForestAssets;shadows?:boolean}){
 const root=useRef<Group>(null),quality=usePalaceStore(s=>s.effectiveQuality),eye=useRef(new Vector3()),tick=useRef(1);
 const buckets=useMemo(()=>{
  const o=new Object3D();return assets.models.flatMap((variants,model)=>variants.map((lods,variant)=>{
   const entries=trees.filter(t=>t.model===model&&t.variant===variant).map(t=>{o.position.set(...t.position);o.rotation.set(...(t.rotation??[0,0,0]));o.scale.set(...t.scale);o.updateMatrix();return{matrix:o.matrix.clone(),point:new Vector3(...t.position),lod:1 as ForestLod};});
   return{lods,entries,meshes:lods.map(parts=>parts.map(()=>null as InstancedMesh|null))};
  }));
 },[trees,assets]);
 const update=()=>{
  for(const bucket of buckets){const counts=[0,0,0];for(const entry of bucket.entries){const level=forestLod(entry.point.distanceTo(eye.current),entry.lod,quality);entry.lod=level;const index=counts[level]++;bucket.meshes[level].forEach(mesh=>mesh?.setMatrixAt(index,entry.matrix));}
   bucket.meshes.forEach((parts,lod)=>parts.forEach(mesh=>{if(mesh){mesh.count=counts[lod];mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}}));
  }
 };
 useLayoutEffect(()=>{update();},[buckets,quality]);
 useLayoutEffect(()=>{
  root.current?.traverse(o=>{if(o instanceof InstancedMesh)o.raycast=()=>{};});
  // 在 ref 清空前保存实例快照；dispose=null 保护共享几何，因此局部矩阵缓冲要明确释放。
  const owned=buckets.flatMap(bucket=>bucket.meshes.flat()).filter((mesh):mesh is InstancedMesh=>!!mesh);
  return()=>disposeForestInstances(owned);
 },[buckets]);
 // 分块和有界实例保留；每半秒更新距离桶，不向 React 每帧发布相机或树木状态。
 useFrame(({camera},dt)=>{camera.getWorldPosition(eye.current);root.current?.worldToLocal(eye.current);tick.current+=dt;if(tick.current>.5){tick.current=0;update();}});
 return <group ref={root} name="grounded-photographic-conifer-stands">{buckets.flatMap((bucket,i)=>bucket.lods.flatMap((parts,lod)=>parts.map((part,j)=><instancedMesh key={i+':'+lod+':'+j} ref={mesh=>{bucket.meshes[lod][j]=mesh;}} args={[part.geometry,part.material,bucket.entries.length]} customDepthMaterial={part.depth} castShadow={shadows&&lod<2} receiveShadow dispose={null}/>)))}</group>;
}
