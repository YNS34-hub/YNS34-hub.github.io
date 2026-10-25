import {describe,it,expect} from 'vitest';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {prepareShot,shotRecovery,shotGuideTarget} from '../src/worlds/presence/shotPose';
const d=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

describe('guide hand keeps its actual released posture',()=>{
 for(const id of ['quick','classic','high-release'] as const)for(const charge of [.46,.64,.75,.90,1])it(`${id}/${charge} does not reattach a peeled guide hand`,()=>{
  const pack=motionPacks.shot[id],release=prepareShot(charge,pack);
  const first=shotRecovery(.65,release.jump,pack,release.verticalVelocity,release.guide);
  expect(first.guide).toBeCloseTo(release.guide,12);
  for(const remaining of [.64,.60,.50,.41,.20,0])expect(shotRecovery(remaining,release.jump,pack,release.verticalVelocity,release.guide).guide).toBeLessThanOrEqual(first.guide);
 });
 for(const side of [-1,1])it(`side ${side} begins at the actual wrist and fades to this frame's animated rest with continuous body recovery`,()=>{
  const out={x:0,y:0,z:0},wrist={x:side*.24,y:1.44,z:-5.05},releaseBody={x:0,y:1.65,z:-4.8},body={...releaseBody},rest={x:side*.20,y:.87,z:-4.75};
  shotGuideTarget(out,wrist,releaseBody,body,.24,.24,.03,.03,rest,.65);expect(out).toEqual(wrist);
  let previous={...out};for(let time=1/120;time<=.30;time+=1/120){
   body.x=time*.4;const jump=Math.max(0,.24-4.905*time*time);
   shotGuideTarget(out,wrist,releaseBody,body,.24,jump,.03,.03*(1-time/.3),rest,.65-time);
   expect(d(out,previous)).toBeLessThan(.045);previous={...out};
  }
  expect(out).toEqual(rest);expect(wrist).toEqual({x:side*.24,y:1.44,z:-5.05});
 });
 it('reuses the output and keeps damaged samples finite',()=>{
  const out={x:0,y:0,z:0},w={x:.2,y:1,z:0},b={x:0,y:1.65,z:0},r={x:.25,y:.9,z:-.1};
  expect(shotGuideTarget(out,w,b,b,0,0,0,0,r,.65)).toBe(out);
  shotGuideTarget(out,w,b,b,Number.NaN,Number.POSITIVE_INFINITY,0,0,{x:Number.NaN,y:1,z:0},Number.NaN);
  expect(Object.values(out).every(Number.isFinite)).toBe(true);
 });
});
