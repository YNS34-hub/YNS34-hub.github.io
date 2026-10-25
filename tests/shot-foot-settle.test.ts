import {describe,expect,it} from 'vitest';
import {shotFootSettleTarget} from '../src/worlds/presence/basketballFootwork';
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

describe('grounded shot returns from the real ankle only once',()=>{
 it('keeps the high-release left ankle within the native tail limit',()=>{
  // Native early-release trace previously moved 30 mm in 7.4 ms near .06 s.
  const seed={x:-.20,y:.112,z:-4.96},rest={x:-.13,y:.112,z:-4.78},body={x:0,y:1.65,z:-4.8};
  const out={...seed},start=.154,dt=.0074;let previous={...seed};
  for(let remaining=start;remaining>=0;remaining-=dt){
   shotFootSettleTarget(out,seed,body,body,rest,remaining,start);
   expect(distance(out,previous)).toBeLessThanOrEqual(.008+2.8*dt);
   expect(out.y).toBeCloseTo(.112,12);previous={...out};
  }
  shotFootSettleTarget(out,seed,body,body,rest,0,start);expect(out).toEqual(rest);
 });
 it('starts at the rendered ankle and follows only horizontal body translation',()=>{
  const seed={x:-.2,y:.112,z:-5},origin={x:0,y:1.65,z:-4.8},body={x:.15,y:1.9,z:-4.6},rest={x:.02,y:.112,z:-4.58},out={x:0,y:0,z:0};
  shotFootSettleTarget(out,seed,origin,origin,rest,.14,.14);expect(out).toEqual(seed);
  shotFootSettleTarget(out,seed,origin,body,rest,.14,.14);expect(out.x).toBeCloseTo(-.05);expect(out.z).toBeCloseTo(-4.8);expect(out.y).toBe(.112);
  const snapshots=JSON.stringify({seed,origin,body,rest});
  expect(shotFootSettleTarget(out,seed,origin,body,rest,.07,.14)).toBe(out);
  expect(JSON.stringify({seed,origin,body,rest})).toBe(snapshots);
 });
 it('ends at the current animated rest and sanitizes interrupted clocks',()=>{
  const seed={x:-.2,y:.112,z:0},body={x:0,y:1.65,z:0},rest={x:-.13,y:.112,z:.1},out={x:0,y:0,z:0};
  for(const remaining of [0,-.1,Number.NaN]){
   shotFootSettleTarget(out,seed,body,body,rest,remaining,.14);expect(out).toEqual(rest);
  }
  shotFootSettleTarget(out,seed,body,body,rest,.1,0);expect(out).toEqual(rest);
  shotFootSettleTarget(out,{x:Number.NaN,y:Number.POSITIVE_INFINITY,z:0},body,body,rest,.1,.14);expect(Object.values(out).every(Number.isFinite)).toBe(true);
 });
});
