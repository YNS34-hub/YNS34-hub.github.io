import {Suspense} from 'react';
import {Block,Door,Label} from '../world/primitives';
import FitnessTrainer,{preloadGymAthlete} from '../fitness/FitnessTrainer';
import FitnessMediaWall from '../fitness/FitnessMediaWall';
import {GymEquipment} from '../fitness/Equipment';
export const preloadGymAssets=preloadGymAthlete;
export default function PrivateGym(){return <group name="private-gym-room">
 <mesh position={[0,-.055,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[25,31]}/><meshStandardMaterial color="#c9bba1" roughness={.91}/></mesh>
 <Block position={[0,3.6,-15.1]} scale={[25,7.2,.3]} color="#d7ccba"/>
 <Block position={[-12.6,3.6,0]} scale={[.3,7.2,31]} color="#d6cebe"/>
 <Block position={[12.6,3.6,0]} scale={[.3,7.2,31]} color="#c6c9b6"/>
 <Block position={[0,7.25,0]} scale={[25,.2,31]} color="#e5ddcb"/>
 <Block position={[0,.007,-4]} scale={[6.4,.025,7.2]} color="#464c42" roughness={.98}/>
 {Array.from({length:11},(_,i)=><Block key={i} position={[-12.1+i*2.4,.005,0]} scale={[.025,.004,30]} color="#a99e87" roughness={1}/>)}
 {[-9,-3,3,9].map(x=><group key={x}><Block position={[x,6.6,-8]} scale={[1.2,.10,8]} color="#ebe9d8" emissive="#fff5d5" emissiveIntensity={.3}/><rectAreaLight position={[x,6.5,-8]} rotation={[-Math.PI/2,0,0]} width={1.2} height={8} intensity={3} color="#fff0d0"/></group>)}
 <Block position={[-12.42,4.0,0]} scale={[.035,3.8,8.5]} color="#dfe8d4" emissive="#e8f2d8" emissiveIntensity={.55}/>
 {[-3,0,3].map(z=><Block key={z} position={[-12.33,4.0,z]} scale={[.12,4,.075]} color="#9b9f87"/>)}
 <rectAreaLight position={[-12.25,4,0]} rotation={[0,Math.PI/2,0]} width={8} height={4} intensity={7} color="#fff1d8"/>
 <Label text="PRIVATE TRAINING ROOM" position={[-8.9,3.2,5.0]} rotation={[0,.25,0]} size={.17} color="#4e5b44" maxWidth={3.6}/>
 <Label text="A little stronger. A little more yourself." position={[-8.9,2.85,5]} rotation={[0,.25,0]} size={.10} color="#72765f" maxWidth={3.6}/>
 <GymEquipment/>
 <Suspense fallback={null}><FitnessTrainer/></Suspense><FitnessMediaWall/>
 <Door id="atrium" title="回到中庭" number="01" position={[0,0,14.9]} rotation={[0,Math.PI,0]}/>
 </group>;}
