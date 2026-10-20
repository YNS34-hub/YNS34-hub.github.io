import {Suspense} from 'react';
import {Door} from '../world/primitives';
import FitnessTrainer,{preloadGymAthlete} from '../fitness/FitnessTrainer';
import FitnessMediaWall from '../fitness/FitnessMediaWall';
import {GymEquipment} from '../fitness/Equipment';
import GymInterior from '../fitness/GymInterior';
export const preloadGymAssets=preloadGymAthlete;
export default function PrivateGym(){return <group name="private-gym-room">
 <GymInterior/>
 <GymEquipment/>
 <Suspense fallback={null}><FitnessTrainer/></Suspense><FitnessMediaWall/>
 <Door id="atrium" title="回到中庭" number="01" position={[0,0,14.9]} rotation={[0,Math.PI,0]}/>
 </group>;}
