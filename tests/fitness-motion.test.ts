import {describe,it,expect} from 'vitest';
import {Group,Vector3,Quaternion} from 'three';
import {exerciseIds} from '../src/fitness/exercises';
import {sampleFitnessPose,createFitnessPose,copyFitnessPose,blendFitnessPose} from '../src/fitness/pose';
import {createFitnessRig,applyFitnessRig} from '../src/fitness/trainerRig';
import {advanceFitness,newFitnessClock} from '../src/fitness/session';
import {loadAthleteMotion} from './fixtures/athleteMotion';

describe('private gym clock and production skeleton',()=>{
 for(const id of exerciseIds)it(`${id} keeps both real hands and feet within 3.5cm of equipment contacts over a full cycle`,()=>{
  const athlete=loadAthleteMotion();athlete.mixer.setTime(.1);const rig=createFitnessRig(athlete.model),frame=new Group();frame.add(rig.container);
  const pose=createFitnessPose();let maximum=0;
  try{for(let i=0;i<=120;i++){sampleFitnessPose(pose,id,i/120);const metrics=applyFitnessRig(rig,pose,frame);maximum=Math.max(maximum,...Object.values(metrics));}expect(maximum,id).toBeLessThan(.035);}finally{athlete.dispose();}
 });
 it('freezes transitions, reps and plank duration while paused, hidden or overlaid; speed changes preserve phase',()=>{
  const clock=newFitnessClock();clock.running=true;clock.exercise='curl';
  for(let i=0;i<432;i++)advanceFitness(clock,1/120,false);expect(clock.reps).toBe(1);
  const snapshot={...clock};advanceFitness(clock,2,true);expect(clock).toEqual(snapshot);clock.running=false;advanceFitness(clock,1,false);expect(clock.elapsed).toBe(snapshot.elapsed);
  clock.running=true;clock.speed=1.5;const phase=clock.phase;expect(clock.phase).toBe(phase);advanceFitness(clock,1/60,false);expect(clock.elapsed).toBeCloseTo(snapshot.elapsed+.025,8);
  clock.exercise='plank';clock.reps=0;for(let i=0;i<120;i++)advanceFitness(clock,1/120,false);expect(clock.reps).toBe(0);expect(clock.elapsed).toBeGreaterThan(snapshot.elapsed+1);
 });
 it('keeps the weighted squat bar behind the real neck at shoulder height across the full squat',()=>{
  const athlete=loadAthleteMotion();athlete.mixer.setTime(.1);const rig=createFitnessRig(athlete.model),frame=new Group();frame.add(rig.container);const pose=createFitnessPose();
  const left=new Vector3(),right=new Vector3(),neck=new Vector3(),q=new Quaternion();
  try{for(let i=0;i<=120;i++){
   sampleFitnessPose(pose,'weighted-squat',i/120);expect(Math.max(...Object.values(applyFitnessRig(rig,pose,frame)))).toBeLessThan(.035);
   for(const [prefix,out]of [['L',left],['R',right]] as const){const hand=rig.bones.get('Bip01_'+prefix+'_Hand')!;out.set(.065,.02,0).applyQuaternion(hand.getWorldQuaternion(q)).add(hand.getWorldPosition(new Vector3()));}
   left.lerp(right,.5);rig.bones.get('Bip01_Neck')!.getWorldPosition(neck);
   expect(left.z).toBeLessThan(neck.z-.08);expect(neck.y-left.y).toBeGreaterThan(.05);expect(neck.y-left.y).toBeLessThan(.14);
  }}finally{athlete.dispose();}
 });
 it('blends every stand/lie change with finite rotations and continuous contact paths',()=>{
  const athlete=loadAthleteMotion();athlete.mixer.setTime(.1);const rig=createFitnessRig(athlete.model),frame=new Group();frame.add(rig.container);const from=createFitnessPose(),target=createFitnessPose();
  let maximum=0;
  try{for(const source of exerciseIds)for(const destination of exerciseIds){sampleFitnessPose(from,source,.25);let previous=copyFitnessPose(createFitnessPose(),from);
   for(let i=0;i<=60;i++){sampleFitnessPose(target,destination,0);blendFitnessPose(target,from,i/60);expect(target.rotation.length()).toBeCloseTo(1,9);maximum=Math.max(maximum,...Object.values(applyFitnessRig(rig,target,frame)));for(const key of ['leftWrist','rightWrist','leftFoot','rightFoot'] as const)expect(target[key].distanceTo(previous[key])).toBeLessThan(.075);previous=copyFitnessPose(previous,target);}
  }expect(maximum).toBeLessThan(.035);}finally{athlete.dispose();}
 });
});
