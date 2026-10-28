import {describe,expect,it} from 'vitest';
import {advanceCourtTravel,createCourtTravel} from '../src/worlds/presence/courtLocomotion';
const facing={x:0,z:-1},forward={x:0,z:-2.7},backward={x:0,z:2.7};
describe('actual travel direction controls the existing walk/run clips',()=>{
 it('starts backward motion with reverse playback, without changing clip phase',()=>{
  const state=createCourtTravel();expect(advanceCourtTravel(state,backward,facing,1/60)).toBe(state);expect(state.direction).toBe(-1);expect(state.playback).toBe(-1);
 });
 it('keeps forward playback for forward travel and uses the logical camera basis after turning',()=>{
  expect(advanceCourtTravel(createCourtTravel(),forward,facing,1/60).playback).toBe(1);
  expect(advanceCourtTravel(createCourtTravel(),{x:-3,z:0},{x:1,z:0},1/60).playback).toBe(-1);
  expect(advanceCourtTravel(createCourtTravel(),{x:3,z:0},{x:1,z:0},1/60).playback).toBe(1);
 });
 it('retains direction through nearly perpendicular strafe motion instead of flipping at zero projection',()=>{
  const state=advanceCourtTravel(createCourtTravel(),backward,facing,1/60);
  for(const z of [-.01,.01,0,-.2,.2]){advanceCourtTravel(state,{x:3,z},facing,1/60);expect(state.direction).toBe(-1);}
  advanceCourtTravel(state,{x:0,z:-3},facing,1/60);expect(state.direction).toBe(1);
 });
 it('reverses joint velocity gradually while preserving a continuous animation time',()=>{
  const state=advanceCourtTravel(createCourtTravel(),backward,facing,1/60),values:number[]=[];
  for(let i=0;i<24;i++){advanceCourtTravel(state,forward,facing,1/60);values.push(state.playback);}
  expect(values[0]).toBeGreaterThan(-1);expect(values[0]).toBeLessThan(0);expect(values.at(-1)).toBeGreaterThan(.99);
  values.forEach((value,i)=>{expect(value).toBeGreaterThanOrEqual(-1);expect(value).toBeLessThanOrEqual(1);if(i)expect(value).toBeGreaterThan(values[i-1]);});
 });
 it('freezes direction and playback during pause, invalid elapsed time and authored ball actions',()=>{
  const state=advanceCourtTravel(createCourtTravel(),backward,facing,1/60),saved={...state};
  for(const dt of [0,-1,NaN,Infinity]){advanceCourtTravel(state,forward,facing,dt);expect(state).toEqual(saved);}
  advanceCourtTravel(state,forward,facing,1/60,true);expect(state).toEqual(saved);
 });
 it('keeps the last direction at rest or with an invalid camera or velocity',()=>{
  const state=advanceCourtTravel(createCourtTravel(),backward,facing,1/60);
  for(const velocity of [{x:0,z:0},{x:0,z:-.2},{x:NaN,z:3}]){advanceCourtTravel(state,velocity,facing,1/60);expect(state.playback).toBe(-1);}
  advanceCourtTravel(state,forward,{x:0,z:0},1/60);expect(state.playback).toBe(-1);
 });
 it('has the same reversal at 30Hz and 144Hz',()=>{
  const run=(hz:number)=>{const state=advanceCourtTravel(createCourtTravel(),backward,facing,1/hz);for(let i=0;i<hz;i++)advanceCourtTravel(state,forward,facing,1/hz);return state.playback;};
  expect(run(30)).toBeCloseTo(run(144),12);
 });
 it('caps a stalled frame and keeps independent actor state',()=>{
  const state=advanceCourtTravel(createCourtTravel(),backward,facing,1/60);advanceCourtTravel(state,forward,facing,10);expect(state.playback).toBeLessThan(.5);expect(createCourtTravel().playback).toBe(1);
 });
});
