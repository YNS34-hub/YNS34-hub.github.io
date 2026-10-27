import {describe,expect,it} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';
import {dribbleRecoveryWindow} from '../src/worlds/presence/dribblePose';
import {sampleDribbleElbowPole} from '../src/worlds/presence/dribblePalm';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {sampleDribbleHandRotation,dribbleWristTarget} from '../src/worlds/presence/dribblePalm';
import {LimbIK} from '../src/worlds/presence/ik';
import {loadAthleteMotion} from './fixtures/athleteMotion';

describe('the whole recovery arc fits the actual athlete skeleton',()=>{
 for(const style of ['balanced','low','wide']as const)for(const side of [-1,1])it(`${style}/${side} remains reachable while standing, walking and running`,()=>{
  const rig=loadAthleteMotion(),world=new Quaternion(),parent=new Quaternion(),tilt=new Quaternion(),target=new Vector3(),pole=new Vector3(),solver=new LimbIK();
  rig.mixer.setTime(.1);
  const original=new Map([...rig.bones].map(([name,bone])=>[name,{position:bone.position.clone(),rotation:bone.quaternion.clone()}]));
  const upper=rig.bones.get(`Bip01_${side<0?'L':'R'}_UpperArm`)!,lower=rig.bones.get(`Bip01_${side<0?'L':'R'}_Forearm`)!,hand=rig.bones.get(`Bip01_${side<0?'L':'R'}_Hand`)!;
  let maximum=0,worst={clip:'',clipPhase:0,bounce:0};
  try{
   for(const [clip,speed]of [['idle',0],['walk',2],['run',6.2]]as const)for(const gait of [.12,.33,.71]){
    rig.actions.forEach(a=>a.setEffectiveWeight(Number(a.getClip().name===clip)));
    const motion=new DribbleMotion(side,style);
    for(let i=0;i<=120;i++){
     const pose=i===0?motion.sample(speed):motion.advance(motionPacks.dribble[style].period/120,speed,style);
     for(const[name,bone]of rig.bones){const saved=original.get(name)!;bone.position.copy(saved.position);bone.quaternion.copy(saved.rotation);}
     rig.mixer.setTime(rig.clips.find(c=>c.name===clip)!.duration*gait);
     rig.model.rotation.y=Math.PI;rig.root.position.set(0,-pose.crouch,0);rig.root.updateWorldMatrix(true,true);
     for(const[name,angle,axis]of [['Bip01_Spine',pose.torso,new Vector3(1,0,0)],['Bip01_Spine1',pose.twist,new Vector3(0,1,0)]]as const){
      const bone=rig.bones.get(name)!;bone.getWorldQuaternion(world);world.premultiply(tilt.setFromAxisAngle(axis,angle));bone.parent!.getWorldQuaternion(parent);bone.quaternion.copy(parent.invert().multiply(world));bone.updateWorldMatrix(true,true);
     }
     const rotation=sampleDribbleHandRotation(new Quaternion(),side,pose.phase,0,new Vector3(0,0,-1));dribbleWristTarget(target,new Vector3(pose.contactPalm.x,pose.contactPalm.y,pose.contactPalm.z),rotation);sampleDribbleElbowPole(pole,side,pose.phase,false,dribbleRecoveryWindow(pose.phase),upper.getWorldPosition(new Vector3()),0);
     solver.solve(upper,lower,hand,target,pole);const error=hand.getWorldPosition(new Vector3()).distanceTo(target);
     if(error>maximum){maximum=error;worst={clip,clipPhase:gait,bounce:pose.phase};}
    }
   }
   expect(maximum,JSON.stringify({maximum,worst})).toBeLessThan(.035);
  }finally{rig.dispose();}
 });
});
