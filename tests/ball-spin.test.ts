import {describe,expect,it} from 'vitest';
import {Vector3} from 'three';
import {BallVisualSpin} from '../src/worlds/court/ballSpin';

describe('physical-ball presentation spin',()=>{
 it('gives shots backspin toward either hoop, rather than velocity-driven topspin',()=>{
  for(const velocity of[{x:0,y:7,z:-6},{x:0,y:7,z:6},{x:4,y:7,z:-6}]){
   const spin=new BallVisualSpin();spin.launch(velocity,'shot');spin.step(.01,'flight',{x:0,y:2,z:0},velocity);
   const top=new Vector3(0,1,0).applyQuaternion(spin.orientation);
   expect(top.x*velocity.x+top.z*velocity.z).toBeLessThan(0);
  }
 });
 it('keeps rotation continuous through a catch, recall and the next launch',()=>{
  const spin=new BallVisualSpin(),velocity={x:0,y:7,z:-6},position={x:0,y:2,z:0};spin.launch(velocity);spin.step(.037,'flight',position,velocity);const caught=spin.orientation.clone();
  for(let i=0;i<60;i++)spin.step(1/60,'held',position,{x:0,y:0,z:0});expect(spin.orientation.angleTo(caught)).toBeLessThan(1e-7);
  spin.step(1/60,'ground',{x:0,y:.12,z:0},{x:0,y:0,z:0});expect(spin.orientation.angleTo(caught)).toBeLessThan(1e-7);
  spin.launch({x:0,y:6,z:5},'layup');expect(spin.orientation.angleTo(caught)).toBeLessThan(1e-7);
 });
 it('preserves the same air spin across frame rates and a changed linear velocity',()=>{
  const runs=[30,60,120].map(hz=>{const spin=new BallVisualSpin();spin.launch({x:2,y:8,z:-5});let elapsed=0;while(elapsed<.317-1e-10){const dt=Math.min(1/hz,.317-elapsed);spin.step(dt,'flight',{x:0,y:3,z:0},{x:2,y:8-9.81*elapsed,z:-5});elapsed+=dt;}return spin.orientation.clone();});
  for(const value of runs)expect(value.angleTo(runs[0])).toBeLessThan(1e-7);
 });
 it('lets lower energy finishes rotate less and handles a vertical dunk with finite values',()=>{
  const amount=(kind:'shot'|'layup'|'dunk')=>{const spin=new BallVisualSpin();spin.launch({x:0,y:-3,z:0},kind);spin.step(.02,'flight',{x:0,y:3,z:0},{x:0,y:-3,z:0});expect(spin.orientation.toArray().every(Number.isFinite)).toBe(true);return spin.orientation.angleTo(new BallVisualSpin().orientation);};
  expect(amount('shot')).toBeGreaterThan(amount('layup'));expect(amount('layup')).toBeGreaterThan(amount('dunk'));
 });
 it('turns a slow floor ball in the rolling direction without mutating authoritative physics',()=>{
  const spin=new BallVisualSpin(),position={x:0,y:.12,z:0},velocity={x:0,y:0,z:-1},snapshot=JSON.stringify({position,velocity});spin.launch({x:0,y:5,z:-5});for(let i=0;i<60;i++)spin.step(1/60,'flight',position,velocity);
  expect(spin.angularVelocity.x).toBeLessThan(0);expect(JSON.stringify({position,velocity})).toBe(snapshot);expect(spin.orientation.length()).toBeCloseTo(1,12);
 });
 it('does not advance presentation time for zero, negative or non-finite frame durations',()=>{
  const spin=new BallVisualSpin();spin.launch({x:0,y:8,z:-5});const initial=spin.orientation.clone();for(const dt of[0,-1,NaN,Infinity])spin.step(dt,'flight',{x:0,y:2,z:0},{x:0,y:8,z:-5});expect(spin.orientation.angleTo(initial)).toBe(0);
 });
});
