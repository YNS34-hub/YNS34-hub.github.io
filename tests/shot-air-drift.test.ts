import {describe,expect,it} from 'vitest';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {createBasketballFootwork,sampleShotFootwork,type ShotFootworkInput} from '../src/worlds/presence/basketballFootwork';

const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const mix=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});

describe('moving stop-gather retires animation drift before the landing anchor changes',()=>{
 for(const [name,pack]of Object.entries(motionPacks.shot))for(const hand of[-1,1])it(`${name}/${hand} keeps the real 6.9ms landing interval within the original foot gate`,()=>{
  const launch=Math.sqrt(2*9.81*pack.jump),takeoff=.64*pack.chargeDuration-launch/9.81,landing=takeoff+2*launch/9.81;
  const position={x:.10,y:1.65,z:-.32};
  const base:ShotFootworkInput={charge:0,shotRemaining:0,releaseCharge:.5556190476194024,released:true,jump:0,hand,pack,yaw:0,origin:{x:0,y:1.65,z:0},position,leftSeed:{x:-.13,y:.112,z:.025},rightSeed:{x:.13,y:.112,z:-.025},floorY:.112};
  const at=(offset:number)=>{const elapsed=landing+offset,t=elapsed-takeoff;return sampleShotFootwork(createBasketballFootwork(),{...base,shotRemaining:base.releaseCharge*pack.chargeDuration+.65-elapsed,jump:offset<0?launch*t-4.905*t*t:0,landingOrigin:offset<0?base.origin:position});};
  // The failing native journey crossed this boundary in 6.9ms. Before it, the
  // actor had drifted from the gather origin; after it, a fresh landing anchor
  // correctly reports zero drift. That anchor switch must not move the ankles.
  const before=at(-.0044),after=at(.0025),dt=.0069,limit=.012+6*dt;
  expect(before.phase).toBe('air');expect(after.phase).toBe('land');
  const drift=Math.min(1,(Math.hypot(position.x,position.z)-.18)/.26);
  const oldSteps:number[]=[];
  for(const side of['left','right']as const){
   const animated={x:position.x+(side==='left'?-.11:.11),y:.112,z:position.z+.04};
   oldSteps.push(distance(mix(before[side],animated,drift),after[side]));
   expect(distance(mix(before[side],animated,drift*before.plantDriftWeight),after[side]),'unchanged native foot continuity limit').toBeLessThan(limit);
  }
  expect(Math.max(...oldSteps),'the old anchor switch teleports at least one ankle').toBeGreaterThan(limit);
 });
 it('continues to permit movement during grounded loading and recovery',()=>{
  const base:ShotFootworkInput={charge:.1,shotRemaining:0,releaseCharge:.64,released:false,jump:0,hand:1,pack:motionPacks.shot.quick,yaw:0,origin:{x:0,y:1.65,z:0},position:{x:0,y:1.65,z:.4},leftSeed:{x:-.13,y:.112,z:0},rightSeed:{x:.13,y:.112,z:0},floorY:.112};
  expect(sampleShotFootwork(createBasketballFootwork(),base).plantDriftWeight).toBe(1);
  expect(sampleShotFootwork(createBasketballFootwork(),{...base,charge:0,released:true,shotRemaining:.1,landingOrigin:{x:0,y:1.65,z:.2}}).plantDriftWeight).toBe(1);
 });
});
