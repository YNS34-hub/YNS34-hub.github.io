import {describe,expect,it} from 'vitest';
import {Bone,Group,Quaternion,Vector3} from 'three';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {LimbIK} from '../src/worlds/presence/ik';
import {loadAthleteMotion} from './fixtures/athleteMotion';

describe('running posture keeps the real ball contact within the actual arm reach',()=>{
 it('keeps the real mixed walk/run hesitation catch inside the original wrist tolerance',()=>{
  const shoulder=new Vector3(-.20429714661343729,1.4355312174583312,.8995462465964732),elbow=new Vector3(-.3286772654622942,1.2163718740448486,.7349817788994804),wrist=new Vector3(-.44595968504246986,1.0145061810193585,.5710005484692813);
  const originalTarget=new Vector3(-.4607114552186097,.9891155007833516,.5503748960753628),root=new Group(),upper=new Bone(),lower=new Bone(),hand=new Bone(),solver=new LimbIK();
  upper.position.copy(shoulder);lower.position.copy(elbow).sub(shoulder);hand.position.copy(wrist).sub(elbow);root.add(upper);upper.add(lower);lower.add(hand);root.updateWorldMatrix(true,true);
  const pole=new Vector3(-.48,1.04,.9761458339961508-.28);
  solver.solve(upper,lower,hand,originalTarget,pole);expect(hand.getWorldPosition(new Vector3()).distanceTo(originalTarget)).toBeGreaterThan(.035);
  const motion=new DribbleMotion(-1,'wide'),pack=motionPacks.dribble.wide,phase=.20189125296917318;motion.requestMove('hesitation');
  let elapsed=0,pose=motion.sample(3.5332218606294488);const duration=pack.period+pack.sprintPeriod*1.35*phase;
  while(elapsed<duration-1e-12){const dt=Math.min(1/240,duration-elapsed);pose=motion.advance(dt,3.5332218606294488,'wide',true);elapsed+=dt;}
  expect(pose.move).toBe('hesitation');expect(pose.phase).toBeCloseTo(phase,9);
  const target=originalTarget.clone();target.x=pose.contactPalm.x;
  solver.solve(upper,lower,hand,target,pole);expect(hand.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(.03);
 });
 for(const style of ['balanced','low','wide'] as const)for(const side of [-1,1])it(`${style}/${side} reaches the pushing palm through every run-clip phase`,()=>{
  const rig=loadAthleteMotion(),run=rig.clips.find(clip=>clip.name==='run')!;
  rig.actions.forEach(action=>action.setEffectiveWeight(action.getClip().name==='run'?1:0));
  const cache=new Map([...rig.bones].map(([name,bone])=>[name,{position:bone.position.clone(),quaternion:bone.quaternion.clone()}]));
  const prefix=`Bip01_${side<0?'L':'R'}_`,upper=rig.bones.get(prefix+'UpperArm')!,lower=rig.bones.get(prefix+'Forearm')!,hand=rig.bones.get(prefix+'Hand')!,spine=rig.bones.get('Bip01_Spine')!,spine1=rig.bones.get('Bip01_Spine1')!;
  const solver=new LimbIK(),axis=new Vector3(1,0,0),world=new Quaternion(),parent=new Quaternion(),tilt=new Quaternion();let maximum=0,worst={clipPhase:0,bouncePhase:0};
  try{
   // .194468 is the actual ordinary catch phase following the failed native
   // sprint transfer; the other phases cover early push, low ball and recovery.
   for(const bounce of [.18,.19446808511906252,.45,.82]){
    const motion=new DribbleMotion(side,style),pack=motionPacks.dribble[style],duration=pack.period+pack.sprintPeriod*bounce;let pose=motion.sample(6.2);
    for(let elapsed=0;elapsed<duration-1e-12;){const dt=Math.min(1/240,duration-elapsed);pose=motion.advance(dt,6.2,style,true);elapsed+=dt;}
    expect(pose.phase).toBeCloseTo(bounce,9);
    for(let i=0;i<=120;i++){
     for(const [name,bone]of rig.bones){const p=cache.get(name)!;bone.position.copy(p.position);bone.quaternion.copy(p.quaternion);}
     rig.mixer.setTime(i*run.duration/120);
     for(const [name,bone]of rig.bones){const p=cache.get(name)!;p.position.copy(bone.position);p.quaternion.copy(bone.quaternion);}
     rig.model.rotation.y=Math.PI;rig.root.position.set(0,-pose.crouch,0);rig.root.updateWorldMatrix(true,true);
     spine.getWorldQuaternion(world);world.premultiply(tilt.setFromAxisAngle(axis,pose.torso));spine.parent!.getWorldQuaternion(parent);spine.quaternion.copy(parent.invert().multiply(world));spine.updateWorldMatrix(true,true);
     spine1.getWorldQuaternion(world);world.premultiply(tilt.setFromAxisAngle(new Vector3(0,1,0),pose.twist));spine1.parent!.getWorldQuaternion(parent);spine1.quaternion.copy(parent.invert().multiply(world));spine1.updateWorldMatrix(true,true);
     const target=new Vector3(pose.contactPalm.x,pose.contactPalm.y,pose.contactPalm.z),pole=new Vector3(side*.48,1.04,-.28);rig.root.localToWorld(pole);solver.solve(upper,lower,hand,target,pole);
     const error=hand.getWorldPosition(new Vector3()).distanceTo(target);if(error>maximum){maximum=error;worst={clipPhase:i/120,bouncePhase:pose.phase};}
    }
   }
   expect(maximum,JSON.stringify({style,side,maximum,worst})).toBeLessThan(.035);
  }finally{rig.dispose();}
 });
});
