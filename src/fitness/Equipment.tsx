import {useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {Group,Quaternion,Vector3} from 'three';
import {Block} from '../world/primitives';
import type {FitnessRig} from './trainerRig';
import {fitnessClock} from './session';
function Plate({x,radius=.18}:{x:number;radius?:number}){return <mesh position={[x,0,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[radius,radius,.055,24]}/><meshStandardMaterial color="#303734" metalness={.24} roughness={.64}/></mesh>;}
function Dumbbell(){return <group><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.022,.022,.31,12]}/><meshStandardMaterial color="#a4aca7" metalness={.8} roughness={.28}/></mesh><Plate x={-.13} radius={.10}/><Plate x={.13} radius={.10}/></group>;}
export function HeldFitnessEquipment({rig,frame}:{rig:FitnessRig;frame:RefObject<Group|null>}){
 const bar=useRef<Group>(null),left=useRef<Group>(null),right=useRef<Group>(null),bench=useRef<Group>(null),rack=useRef<Group>(null);
 const contact=useMemo(()=>({left:new Vector3(),right:new Vector3(),q:new Quaternion(),parent:new Quaternion(),offset:new Vector3(.065,.02,0),axis:new Vector3(1,0,0),gripRotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.PI/2)}),[]);
 useFrame(()=>{
  const id=fitnessClock.exercise;if(!frame.current)return;
  for(const [ref,point,prefix]of [[left,contact.left,'L'],[right,contact.right,'R']] as const){
   const hand=rig.bones.get('Bip01_'+prefix+'_Hand')!;hand.getWorldQuaternion(contact.q);hand.getWorldPosition(point);point.add(contact.offset.set(.065,.02,0).applyQuaternion(contact.q));frame.current.worldToLocal(point);
   if(ref.current){ref.current.visible=id==='curl'||id==='shoulder-press';ref.current.position.copy(point);frame.current.getWorldQuaternion(contact.parent);ref.current.quaternion.copy(contact.parent.invert().multiply(contact.q).multiply(contact.gripRotation));}
  }
  if(bar.current){bar.current.visible=id==='bench-press'||id==='weighted-squat';bar.current.position.copy(contact.left).lerp(contact.right,.5);contact.axis.subVectors(contact.right,contact.left).normalize();bar.current.quaternion.setFromUnitVectors(contact.offset.set(1,0,0),contact.axis);}
  if(bench.current)bench.current.visible=id==='bench-press';if(rack.current)rack.current.visible=id==='weighted-squat';
 });
 return <group name="gym-contact-equipment">
  <group ref={bar} name="gym-held-bar" visible={false}><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.018,.018,1.85,16]}/><meshStandardMaterial color="#a3aca7" metalness={.82} roughness={.28}/></mesh><Plate x={-.78}/><Plate x={.78}/><Plate x={-.84}/><Plate x={.84}/></group>
  <group ref={left} name="gym-left-dumbbell" visible={false}><Dumbbell/></group><group ref={right} name="gym-right-dumbbell" visible={false}><Dumbbell/></group>
  <group ref={bench} visible={false}><Block position={[0,.49,-.43]} scale={[.48,.13,1.75]} color="#303a35" roughness={.88}/>{[-1,1].map(side=><Block key={side} position={[0,.23,side*.60-.43]} scale={[.65,.44,.12]} color="#626c65" metalness={.5}/>)}</group>
  <group ref={rack} visible={false}>{[-1,1].map(side=><group key={side}><Block position={[side*1.06,1.1,-.48]} scale={[.075,2.2,.075]} color="#54615b" metalness={.6}/><Block position={[side*1.06,.09,-.40]} scale={[.48,.12,1.25]} color="#54615b" metalness={.6}/></group>)}<Block position={[0,2.15,-.48]} scale={[2.15,.075,.075]} color="#54615b" metalness={.6}/></group>
 </group>;
}
export function GymEquipment(){return <group name="private-gym-equipment">
 <Block position={[0,.022,-4]} scale={[3.0,.045,3.1]} color="#515e50" roughness={.98}/>
 <Block position={[-9,.43,-6]} scale={[1.1,.22,5.0]} color="#675f50" roughness={.8}/>
 {[-1,1].map(side=><Block key={side} position={[-9,.20,-6+side*1.8]} scale={[.8,.40,.16]} color="#333b35"/>)}
 {Array.from({length:6},(_,i)=><group key={i} position={[-9,.65,-8+i*.7]}><Dumbbell/></group>)}
 <Block position={[-9,.43,5.0]} scale={[3.8,.17,1.0]} color="#aa8760" roughness={.8}/>
 {[-1,1].map(side=><Block key={side} position={[-9+side*1.4,.20,5]} scale={[.12,.4,.8]} color="#3a433b"/>)}
 <Block position={[8,.05,7]} scale={[2.8,.10,2.2]} color="#454f46" roughness={.96}/>
 <mesh position={[8,.7,7]} castShadow><sphereGeometry args={[.65,32,24]}/><meshStandardMaterial color="#7f8e72" roughness={.84}/></mesh>
 </group>;}
