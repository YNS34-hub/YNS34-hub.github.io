import {describe,expect,it} from 'vitest';
import {prepareShot,shotRecovery} from '../src/worlds/presence/shotPose';
import {motionPacks} from '../src/worlds/court/motionPacks';

describe('the planted leg drive joins the same ballistic jump',()=>{
 for(const [id,pack]of Object.entries(motionPacks.shot)){
  const launch=Math.sqrt(19.62*pack.jump),takeoff=.64*pack.chargeDuration-launch/9.81,epsilon=1e-5;
  it(`${id} reaches takeoff at the actual launch velocity rather than changing velocity on lift-off`,()=>{
   const sample=(seconds:number)=>prepareShot(seconds/pack.chargeDuration,pack).jump;
   const incoming=(sample(takeoff)-sample(takeoff-epsilon))/epsilon,outgoing=(sample(takeoff+epsilon)-sample(takeoff))/epsilon;
   expect(Math.abs(incoming-outgoing)).toBeLessThan(.002);expect(incoming).toBeCloseTo(launch,2);
   let deepest=0;
   for(let i=0;i<=1000;i++){const y=sample(takeoff*i/1000);expect(y).toBeLessThanOrEqual(1e-10);deepest=Math.min(deepest,y);}
   expect(-deepest).toBeGreaterThan(pack.crouch*.98);expect(-deepest).toBeLessThanOrEqual(pack.crouch*1.02);
  });
  it(`${id} absorbs the incoming landing speed and settles without a second bounce`,()=>{
   const release=prepareShot(.64,pack),landing=launch/9.81;
   const sample=(seconds:number)=>shotRecovery(.65-seconds,release.jump,pack,release.verticalVelocity).jump;
   const before=(sample(landing)-sample(landing-epsilon))/epsilon,after=(sample(landing+epsilon)-sample(landing))/epsilon;
   expect(Math.abs(before-after)).toBeLessThan(.002);
   const grounded=Array.from({length:181},(_,i)=>sample(landing+i/1000));
   expect(Math.min(...grounded)).toBeGreaterThan(-.08);expect(Math.min(...grounded)).toBeLessThan(-.04);
   expect(grounded.every(y=>y<=1e-10)).toBe(true);expect(grounded.at(-1)).toBeCloseTo(0,10);
  });
  it(`${id} dips from the real hold and enters the torso load gradually`,()=>{
   expect(prepareShot(.10,pack).y).toBeLessThan(1.10);
   expect(Math.abs(prepareShot(0,pack).pitch)).toBe(0);
   expect(Math.abs(prepareShot(.002,pack).pitch)).toBeLessThan(.001);
   const shot=prepareShot(.64,pack);expect(shot.y).toBeCloseTo(pack.releaseHeight,10);
   expect(shot.jump).toBeCloseTo(pack.jump,10);
  });
 }
});
