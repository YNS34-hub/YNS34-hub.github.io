import {describe,it,expect} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {LimbIK} from '../src/worlds/presence/ik';
import {loadAthleteMotion} from './fixtures/athleteMotion';

describe('stable two-hand hold with the production shoulder chain',()=>{
 for(const [id,pack] of Object.entries(motionPacks.hands))for(const hand of [-1,1])it(`${id}/${hand} keeps each elbow outside the chest while retaining both wrist contacts`,()=>{
  const athlete=loadAthleteMotion(),ik=new LimbIK();athlete.mixer.setTime(.1);athlete.model.rotation.y=Math.PI;athlete.root.position.y=-.08;athlete.root.updateWorldMatrix(true,true);
  try{for(const side of [-1,1]){
   const prefix='Bip01_'+(side<0?'L':'R')+'_',top=athlete.bones.get(prefix+'UpperArm')!,middle=athlete.bones.get(prefix+'Forearm')!,end=athlete.bones.get(prefix+'Hand')!;
   const target=new Vector3(hand*pack.holdX+side*pack.spread,pack.holdY-.045,pack.holdZ),pole=athlete.root.localToWorld(new Vector3(side*.70,1.02,-.32)),shoulder=top.getWorldPosition(new Vector3());
   const first=middle.getWorldPosition(new Vector3()).sub(shoulder),second=end.getWorldPosition(new Vector3()).sub(middle.getWorldPosition(new Vector3()));
   const hinge=new Vector3().crossVectors(first,second).normalize().applyQuaternion(top.getWorldQuaternion(new Quaternion()).invert());
   ik.solve(top,middle,end,target,pole,true);
   expect(end.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(.035);
   expect(side*middle.getWorldPosition(new Vector3()).x,id+' entire elbow remains near/outside its own shoulder line').toBeGreaterThan(side*shoulder.x-.035);
   const upper=middle.getWorldPosition(new Vector3()).sub(shoulder),lower=end.getWorldPosition(new Vector3()).sub(middle.getWorldPosition(new Vector3()));
   const actual=new Vector3().crossVectors(upper,lower).normalize(),anatomical=hinge.applyQuaternion(top.getWorldQuaternion(new Quaternion()));
   expect(actual.dot(anatomical),'the elbow bends in its original plane without a spiral shoulder twist').toBeGreaterThan(.995);
  }}finally{athlete.dispose();}
 });
 // Sprinting automatically enters dribbling; the unfiltered native matrix covers that path.
 for(const clip of ['idle','walk'])it(`${clip} keeps held upper-arm rotations continuous through the original animation cycle`,()=>{
  const athlete=loadAthleteMotion(),ik=new LimbIK(),dt=1/120;
  athlete.model.rotation.y=Math.PI;athlete.root.position.y=-.08;
  for(const action of athlete.actions)action.reset().play().setEffectiveWeight(Number(action.getClip().name===clip));
  const animated=new Map([...athlete.bones].map(([name,bone])=>[name,{position:bone.position.clone(),rotation:bone.quaternion.clone()}]));
  const previous=new Map<number,Quaternion>();let maximum=0;
  try{for(let frame=0;frame<=Math.ceil(athlete.clips.find(item=>item.name===clip)!.duration/dt);frame++){
   for(const [name,pose]of animated){const bone=athlete.bones.get(name)!;bone.position.copy(pose.position);bone.quaternion.copy(pose.rotation);}
   athlete.mixer.update(dt);for(const[name,pose]of animated){const bone=athlete.bones.get(name)!;pose.position.copy(bone.position);pose.rotation.copy(bone.quaternion);}
   athlete.root.updateWorldMatrix(true,true);
   for(const side of [-1,1]){
    const prefix='Bip01_'+(side<0?'L':'R')+'_',top=athlete.bones.get(prefix+'UpperArm')!,middle=athlete.bones.get(prefix+'Forearm')!,end=athlete.bones.get(prefix+'Hand')!;
    ik.solve(top,middle,end,new Vector3(.045+side*.14,1.085,-.29),athlete.root.localToWorld(new Vector3(side*.70,1.02,-.32)),true);
    const rotation=top.getWorldQuaternion(new Quaternion()),last=previous.get(side);if(last)maximum=Math.max(maximum,last.angleTo(rotation)/dt);previous.set(side,rotation);
   }
  }expect(maximum,'upper-arm surface rotation must not flip between frames').toBeLessThan(12);}finally{athlete.dispose();}
 });
});
