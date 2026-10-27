import {describe,expect,it} from 'vitest';
import {Vector3} from 'three';
import {advanceHeldCarryOffset} from '../src/worlds/presence/heldBallPose';

describe('the carried ball follows unsolved chest motion',()=>{
 it('follows the chest without changing the source skeleton sample',()=>{
  const rest=new Vector3(0,1.5,.03),chest=new Vector3(.02,1.53,.01),saved=chest.clone(),out=new Vector3();
  for(let i=0;i<120;i++)advanceHeldCarryOffset(out,chest,rest,1/120);
  expect(out.distanceTo(chest.clone().sub(rest))).toBeLessThan(1e-6);
  expect(chest.equals(saved)).toBe(true);
 });
 it('freezes the wardrobe pose even when a different chest target is supplied',()=>{
  const out=new Vector3(.01,.02,-.01),before=out.clone();
  expect(advanceHeldCarryOffset(out,new Vector3(.06,.04,0),new Vector3(),0)).toBe(out);
  expect(out.equals(before)).toBe(true);
 });
 it('settles to the base carry after releasing the ball',()=>{
  const out=new Vector3(.04,-.02,.03),before=out.length();
  advanceHeldCarryOffset(out,null,new Vector3(),1/60);
  expect(out.length()).toBeLessThan(before);
  for(let i=0;i<120;i++)advanceHeldCarryOffset(out,null,new Vector3(),1/120);
  expect(out.length()).toBeLessThan(1e-6);
 });
 it('bounds a bad animation excursion without moving the actor or extending a limb',()=>{
  const out=new Vector3();
  for(let i=0;i<120;i++)advanceHeldCarryOffset(out,new Vector3(2,-2,3),new Vector3(),1/120);
  expect(Math.max(...out.toArray().map(Math.abs))).toBeLessThanOrEqual(.08);
 });
});
