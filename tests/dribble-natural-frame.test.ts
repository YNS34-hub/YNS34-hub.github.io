import {describe,expect,it} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {sampleDribblePalmNormal,sampleDribbleElbowPole,sampleDribbleHandRotation,dribbleWristTarget} from '../src/worlds/presence/dribblePalm';
import {LimbIK} from '../src/worlds/presence/ik';
import {loadAthleteMotion} from './fixtures/athleteMotion';
import {dribblePose} from '../src/worlds/presence/dribblePose';
import {motionPacks} from '../src/worlds/court/motionPacks';

describe('the dribble follows through below its real shoulder',()=>{
 it('flexes the wrist after the push and returns to the same downward catch normal',()=>{
  const push=sampleDribblePalmNormal(new Vector3(),1,0,1),follow=sampleDribblePalmNormal(new Vector3(),1,.36,1),caught=sampleDribblePalmNormal(new Vector3(),1,1,1);
  expect(follow.z,'fingers fold down after release rather than remaining on a horizontal tray').toBeGreaterThan(.30);
  expect(push.distanceTo(caught)).toBeLessThan(1e-12);expect(push.y).toBeLessThan(-.99);
 });
 for(const[id,pack]of Object.entries(motionPacks.dribble))for(const side of[-1,1])it(`${id}/${side} catches with the elbow below its actual shoulder at both headings`,()=>{
  for(const facing of[0,1.7]){
   const r=loadAthleteMotion();r.mixer.setTime(.1);r.model.rotation.y=Math.PI;r.root.rotation.y=facing;r.root.position.y=-Math.min(.36,.12+Math.max(0,.95-pack.height)*.72);r.root.updateWorldMatrix(true,true);r.bones.get('Bip01_Spine')!.rotateZ(-pack.torso);r.root.updateWorldMatrix(true,true);
   const prefix='Bip01_'+(side<0?'L':'R')+'_',top=r.bones.get(prefix+'UpperArm')!,middle=r.bones.get(prefix+'Forearm')!,end=r.bones.get(prefix+'Hand')!,shoulder=top.getWorldPosition(new Vector3()),pose=dribblePose(0,0,side,undefined,pack.period,pack),target=new Vector3(pose.palm.x,pose.palm.y,pose.palm.z).applyAxisAngle(new Vector3(0,1,0),facing);
   const rotation=sampleDribbleHandRotation(new Quaternion(),side,0,facing,new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),facing));dribbleWristTarget(target,target.clone(),rotation);
   // Pass the measured shoulder separately so a hip turn cannot rotate the pole away from the chest.
   const pole=sampleDribbleElbowPole(new Vector3(),side,0,false,0,shoulder,facing);
   new LimbIK().solve(top,middle,end,target,pole,true);const arm=middle.getWorldPosition(new Vector3()).sub(shoulder);
   expect(-arm.y).toBeGreaterThan(.20);expect(side*arm.dot(new Vector3(Math.cos(facing),0,-Math.sin(facing)))).toBeLessThan(.15);
   expect(end.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(.035);r.dispose();
  }
 });
});
