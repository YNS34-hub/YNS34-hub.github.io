import {describe,it,expect} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {advanceShotHandRotation} from '../src/worlds/presence/shotHandRotation';
import {createCourtWristFrame,advanceCourtHandRotation} from '../src/worlds/presence/courtHandRotation';

const axis=new Vector3(0,1,0),rest=new Quaternion(.2,-.1,.1,.96).normalize();
describe('an empty hand follows its actual moving forearm',()=>{
 it('reproduces the old world clamp twisting an otherwise unchanged idle wrist',()=>{
  const parent=new Quaternion().setFromAxisAngle(axis,1.2),world=rest.clone(),target=parent.clone().multiply(rest);
  advanceShotHandRotation(world,target,1/60);
  expect(parent.clone().invert().multiply(world).angleTo(rest)).toBeGreaterThan(1);
 });
 for(const dt of[0,1/120,1/60,.04])it(`keeps the local rest pose during an actual parent turn (${dt})`,()=>{
  const frame=createCourtWristFrame(),world=rest.clone();advanceCourtHandRotation(world,rest,new Quaternion(),frame,true,1/60);
  const parent=new Quaternion().setFromAxisAngle(axis,1.2),target=parent.clone().multiply(rest);
  advanceCourtHandRotation(world,target,parent,frame,true,dt);
  expect(parent.clone().invert().multiply(world).angleTo(rest)).toBeLessThan(1e-7);
 });
 it('retains the original world-space shot limiter and pause behavior while a hand has a ball task',()=>{
  const frame=createCourtWristFrame(),a=rest.clone(),b=rest.clone();
  for(const dt of[1/120,0,1/30,.3,1/60]){
   const parent=new Quaternion().setFromAxisAngle(axis,1.2),target=new Quaternion().setFromAxisAngle(axis,2.1).multiply(rest);
   advanceCourtHandRotation(a,target,parent,frame,false,dt);advanceShotHandRotation(b,target,dt);
   expect(a.angleTo(b)).toBeLessThan(1e-7);
  }
 });
 it('settles a real hand shape change at the existing rate while the body turns',()=>{
  const frame=createCourtWristFrame(),world=rest.clone();advanceCourtHandRotation(world,rest,new Quaternion(),frame,true,1/60);
  const parent=new Quaternion().setFromAxisAngle(axis,1.5),local=rest.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4));
  advanceCourtHandRotation(world,parent.clone().multiply(local),parent,frame,true,1/60);
  expect(parent.clone().invert().multiply(world).angleTo(rest)).toBeCloseTo(10/60,9);
 });
 it('keeps world continuity when an IK forearm returns to its free animation',()=>{
  const frame=createCourtWristFrame(),world=rest.clone();
  advanceCourtHandRotation(world,rest,new Quaternion(),frame,false,1/120);
  const before=world.clone(),parent=new Quaternion().setFromAxisAngle(axis,3.03),target=parent.clone().multiply(rest);
  advanceCourtHandRotation(world,target,parent,frame,true,.0071);
  expect(before.angleTo(world)).toBeLessThanOrEqual(.071+1e-7);
  const local=parent.clone().invert().multiply(world),nextParent=new Quaternion().setFromAxisAngle(axis,3.04);
  advanceCourtHandRotation(world,nextParent.clone().multiply(local),nextParent,frame,true,1/120);
  expect(nextParent.clone().invert().multiply(world).angleTo(local)).toBeLessThan(1e-7);
 });
});
