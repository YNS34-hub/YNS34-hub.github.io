import {useEffect,useMemo,useRef,useState} from 'react';
import {useGLTF} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {AnimationMixer,Group,Mesh,MeshStandardMaterial,SkinnedMesh,SRGBColorSpace,TextureLoader,type Texture} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {ATHLETE,ATHLETE_DETAIL,preloadAthlete} from '../worlds/presence/assets';
import {useAppearance,neutralProfile,loadLocalAppearance} from '../worlds/presence/appearance';
import {dressAthlete,reshapeAthlete} from '../worlds/presence/appearanceRig';
import {usePalaceStore} from '../systems/store';
import {useGymVideo} from './media/video';
import {createFitnessRig,applyFitnessRig} from './trainerRig';
import {fitnessClock,advanceFitness,useFitness} from './session';
import {createFitnessPose,sampleFitnessPose,copyFitnessPose,blendFitnessPose} from './pose';
import {HeldFitnessEquipment} from './Equipment';
import {installBasketballAppearance} from '../worlds/presence/basketballAppearance';
export function preloadGymAthlete(){preloadAthlete();void loadLocalAppearance();}
export default function FitnessTrainer(){
 const profile=useAppearance(s=>s.personal&&s.profile?s.profile:neutralProfile),head=useAppearance(s=>s.personal?s.head:null),[headMap,setHeadMap]=useState<Texture|null>(null),frame=useRef<Group>(null);
 useEffect(()=>{let active=true;setHeadMap(null);if(!head)return;const owned=new TextureLoader().load(head,map=>{if(active){map.colorSpace=SRGBColorSpace;map.flipY=false;setHeadMap(map);}});return()=>{active=false;owned.dispose();};},[head]);
 const quality=usePalaceStore(s=>s.effectiveQuality),gltf=useGLTF(quality==='low'?ATHLETE:ATHLETE_DETAIL),rig=useMemo(()=>{
  const model=clone(gltf.scene),materials:Mesh['material'][]=[],geometries:Mesh['geometry'][]=[],textures=new Map<Texture,Texture>();
  model.traverse(node=>{if(node instanceof Mesh){node.material=Array.isArray(node.material)?node.material.map(material=>material.clone()):node.material.clone();materials.push(node.material);node.geometry=reshapeAthlete(node.geometry,profile);geometries.push(node.geometry);dressAthlete(node,profile,'training-blue');node.castShadow=node.receiveShadow=true;node.raycast=()=>{};
   if(headMap)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof MeshStandardMaterial&&/head/.test(material.name)){material.map=headMap;material.normalScale.multiplyScalar(.35);}
   for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof MeshStandardMaterial)for(const key of['map','normalMap']as const){const source=material[key];if(source){let owned=textures.get(source);if(!owned){owned=source.clone();owned.anisotropy=8;owned.needsUpdate=true;textures.set(source,owned);}material[key]=owned;}}
  }});
  const mixer=new AnimationMixer(model),idle=gltf.animations.find(clip=>clip.name==='idle');if(idle){mixer.clipAction(idle).play();mixer.setTime(.1);}
  const body=createFitnessRig(model),surface=installBasketballAppearance(model,{outfitId:'training-blue',personalHead:!!headMap});mixer.stopAllAction();mixer.uncacheRoot(model);return{...body,materials,geometries,textures,surface};
 },[gltf,profile,headMap]);
 useEffect(()=>{rig.surface.activate();return()=>{rig.surface.dispose();rig.materials.flat().forEach(material=>material.dispose());rig.textures.forEach(texture=>texture.dispose());rig.geometries.forEach(geometry=>geometry.dispose());rig.model.traverse(node=>{if(node instanceof SkinnedMesh)node.skeleton.dispose();});};},[rig]);
 const pose=useMemo(()=>sampleFitnessPose(createFitnessPose(),fitnessClock.exercise,fitnessClock.phase),[]),from=useMemo(createFitnessPose,[]),revision=useRef(fitnessClock.revision);
 useEffect(()=>{const hidden=()=>{if(document.hidden){fitnessClock.running=false;useFitness.setState({running:false});}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);fitnessClock.running=false;useFitness.setState({running:false});};},[]);
 useFrame((_,delta)=>{
  if(!frame.current)return;const palace=usePalaceStore.getState(),blocked=!palace.started||!!palace.overlay||!!palace.focus||palace.mode==='index'||document.hidden;
  if(revision.current!==fitnessClock.revision){copyFitnessPose(from,pose);revision.current=fitnessClock.revision;}
  advanceFitness(fitnessClock,delta,blocked);sampleFitnessPose(pose,fitnessClock.exercise,fitnessClock.phase);if(fitnessClock.transition<1)blendFitnessPose(pose,from,fitnessClock.transition);
  applyFitnessRig(rig,pose,frame.current);
  if(import.meta.env.DEV){frame.current.userData.fitness={exercise:fitnessClock.exercise,phase:fitnessClock.phase,transition:fitnessClock.transition,reps:fitnessClock.reps,elapsed:fitnessClock.elapsed,running:fitnessClock.running,speed:fitnessClock.speed,metrics:{...rig.metrics},videoPlaying:useGymVideo.getState().playing};}
 },-1);
 return <group ref={frame} name="private-gym-trainer" position={[0,0,-4]}><primitive object={rig.container} dispose={null}/><HeldFitnessEquipment rig={rig} frame={frame}/></group>;
}
