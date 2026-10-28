import {describe,expect,it} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {captureAnimationContinuity,createAnimationContinuity,restoreAnimationContinuity} from '../src/worlds/presence/animationContinuity';
import {loadAthleteMotion} from './fixtures/athleteMotion';
const rotationError=(a:Quaternion,b:Quaternion)=>{const x=a.toArray(),y=b.toArray();return Math.min(Math.hypot(...x.map((v,i)=>v-y[i])),Math.hypot(...x.map((v,i)=>v+y[i])));};

describe('outfit rebuild keeps the actual athlete mixer phase',()=>{
 for(const direction of [1,-1])for(const elapsed of [.173,.613,1.237])it(`restores all three actual clips and shoulder/elbow/wrist poses after ${elapsed}s, playback ${direction}`,()=>{
  const old=loadAthleteMotion(),fresh=loadAthleteMotion(),state=createAnimationContinuity();
  old.actions.forEach((action,i)=>{action.setEffectiveWeight([.2,.3,.5][i]);action.setEffectiveTimeScale([.65,1.1*direction,1.45*direction][i]);});old.mixer.update(elapsed);
  const base=new Map([...old.bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
  captureAnimationContinuity(state,old.mixer,old.actions,base);
  const savedReferences=[...state.bones.values()];captureAnimationContinuity(state,old.mixer,old.actions,base);[...state.bones.values()].forEach((pose,i)=>expect(pose).toBe(savedReferences[i]));
  // Simulate an IK layer on the old mesh; the saved clip pose must stay independent.
  old.bones.get('Bip01_L_Forearm')!.quaternion.setFromAxisAngle(new Vector3(0,1,0),1.4);
  expect(restoreAnimationContinuity(state,fresh.mixer,fresh.actions,fresh.bones)).toBe(true);fresh.mixer.update(0);
  for(const [name,bone]of fresh.bones){const expected=base.get(name)!;expect(bone.position.distanceTo(expected.position),name).toBeLessThan(1e-9);expect(rotationError(bone.quaternion,expected.quaternion),name).toBeLessThan(1e-9);}
  old.actions.forEach((action,i)=>{expect(fresh.actions[i].time).toBe(action.time);expect(fresh.actions[i].getEffectiveWeight()).toBe(action.getEffectiveWeight());expect(fresh.actions[i].timeScale).toBe(action.timeScale);});
  for(const [name,bone]of old.bones){bone.position.copy(base.get(name)!.position);bone.quaternion.copy(base.get(name)!.quaternion);}
  old.mixer.update(1/60);fresh.mixer.update(1/60);
  for(const [name,bone]of fresh.bones){expect(bone.position.distanceTo(old.bones.get(name)!.position)).toBeLessThan(1e-9);expect(rotationError(bone.quaternion,old.bones.get(name)!.quaternion)).toBeLessThan(1e-9);}
  old.dispose();fresh.dispose();
 });
 it('leaves a fresh rig untouched without a captured session',()=>{
  const rig=loadAthleteMotion(),state=createAnimationContinuity(),bone=rig.bones.get('Bip01_L_Hand')!,position=bone.position.clone(),rotation=new Quaternion().copy(bone.quaternion);
  expect(restoreAnimationContinuity(state,rig.mixer,rig.actions,rig.bones)).toBe(false);expect(bone.position).toEqual(position);expect(bone.quaternion.toArray()).toEqual(rotation.toArray());rig.dispose();
 });
});
