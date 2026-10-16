import {describe,expect,it} from 'vitest';
import {Euler,Quaternion,Vector3} from 'three';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {shotRecovery} from '../src/worlds/presence/shotPose';
import {advanceShotHandRotation,sampleShotHandRotation} from '../src/worlds/presence/shotHandRotation';

const releaseFor=(side:number)=>new Quaternion().setFromEuler(new Euler(.8,side*.65,-side*.3));
const restFor=(side:number)=>new Quaternion().setFromEuler(new Euler(-.12,side*.1,side*.08));

describe('shot hand orientation comes from the frozen release, not a zero wrist-to-goal vector',()=>{
 for(const side of [-1,1])for(const axis of [new Vector3(1,0,0),new Vector3(.3,.7,-.2).normalize()]){
  it(`preserves the release and current animated rest exactly for hand ${side}, axis ${axis.toArray()}`,()=>{
   const release=releaseFor(side),rest=restFor(side),out=new Quaternion();
   expect(sampleShotHandRotation(out,release,rest,axis,.65,0)).toBe(out);
   expect(out.toArray()).toEqual(release.toArray());
   sampleShotHandRotation(out,release,rest,axis,0,1);
   expect(out.toArray()).toEqual(rest.toArray());
  });
 }
 it('flexes around the supplied world axis rather than the hand local axis',()=>{
  const release=releaseFor(-1),axis=new Vector3(.2,.9,.3).normalize(),out=new Quaternion();
  const expected=release.clone().premultiply(new Quaternion().setFromAxisAngle(axis,-.42));
  const local=release.clone().multiply(new Quaternion().setFromAxisAngle(axis,-.42));
  sampleShotHandRotation(out,release,restFor(-1),axis,.55,1);
  expect(out.angleTo(expected)).toBeLessThan(1e-7);
  expect(out.angleTo(local)).toBeGreaterThan(.1);
  expect(release.angleTo(out)).toBeCloseTo(.42,10);
 });
 it('recovers the same fraction as shot reach to this frame\'s mixer rest',()=>{
  const release=releaseFor(1),rest=restFor(1),axis=new Vector3(1,0,0),out=new Quaternion();
  const flexed=release.clone().premultiply(new Quaternion().setFromAxisAngle(axis,-.42*.8));
  for(const remaining of [.65,.51,.5,.4,.27,.1,0]){
   const reach=shotRecovery(remaining,.2,motionPacks.shot.classic).reach;
   sampleShotHandRotation(out,release,rest,axis,remaining,.8);
   expect(out.angleTo(rest)).toBeCloseTo(flexed.angleTo(rest)*reach,7);
  }
 });
 for(const side of [-1,1])it(`keeps a full hand ${side} release/flex/landing cycle continuous with a moving animated rest`,()=>{
  const release=releaseFor(side),axis=new Vector3(side*.8,.25,-.2).normalize(),out=release.clone(),target=new Quaternion();
  let previous=out.clone();
  for(let i=0;i<=156;i++){
   const remaining=.65-i/240,rest=restFor(side).multiply(new Quaternion().setFromAxisAngle(axis,.04*Math.sin(i/18)));
   const recovery=shotRecovery(remaining,.24,motionPacks.shot.quick);
   sampleShotHandRotation(target,release,rest,axis,remaining,recovery.wrist);
   advanceShotHandRotation(out,target,1/240);
   expect(out.toArray().every(Number.isFinite)).toBe(true);
   expect(out.length()).toBeCloseTo(1,12);
   expect(out.angleTo(previous)).toBeLessThanOrEqual(10/240+1e-7);
   previous=out.clone();
  }
  expect(out.angleTo(target)).toBeLessThan(1e-7);
 });
 it('reuses the output and never changes release/rest/axis snapshots',()=>{
  const release=releaseFor(1),rest=restFor(-1),axis=new Vector3(.2,.3,.7);
  const before=[release.toArray(),rest.toArray(),axis.toArray()],out=new Quaternion();
  sampleShotHandRotation(out,release,rest,axis,.38,.7);
  expect([release.toArray(),rest.toArray(),axis.toArray()]).toEqual(before);
  expect(out.length()).toBeCloseTo(1,12);
 });
 it('clamps timer and flex overshoot without escaping the release/rest endpoints',()=>{
  const release=releaseFor(-1),rest=restFor(-1),axis=new Vector3(1,0,0),out=new Quaternion(),other=new Quaternion();
  sampleShotHandRotation(out,release,rest,axis,2,-1);expect(out.toArray()).toEqual(release.toArray());
  sampleShotHandRotation(out,release,rest,axis,-.1,2);expect(out.toArray()).toEqual(rest.toArray());
  sampleShotHandRotation(out,release,rest,axis,.55,2);
  sampleShotHandRotation(other,release,rest,axis,.55,1);expect(out.angleTo(other)).toBeLessThan(1e-7);
 });
 it('holds a finite existing orientation for malformed snapshots or timer data',()=>{
  const release=releaseFor(1),rest=restFor(1),axis=new Vector3(1,0,0),out=restFor(-1),before=out.toArray();
  for(const bad of [new Quaternion(Number.NaN,0,0,1),new Quaternion(0,0,0,0),null as unknown as Quaternion]){
   sampleShotHandRotation(out,bad,rest,axis,.3,.5);expect(out.toArray()).toEqual(before);
   sampleShotHandRotation(out,release,bad,axis,.3,.5);expect(out.toArray()).toEqual(before);
  }
  sampleShotHandRotation(out,release,rest,axis,Number.NaN,.5);expect(out.toArray()).toEqual(before);
  sampleShotHandRotation(out,release,rest,new Vector3(Number.NaN,0,0),.3,.5);expect(out.toArray()).toEqual(before);
 });
});

describe('shot wrist follows the previous actual world rotation at a bounded angular rate',()=>{
 // Native Edge / real GLTF: quick-left-0.55, frames 141–142, 20261015-accepted-shots/orientation-audit.json.
 // Normalize matrix-decomposition roundoff before comparing actual SO(3) angles.
 const previous=new Quaternion(.5204930782906076,.38639432337442386,-.020871364692946533,.7611509494563183).normalize();
 const flipped=new Quaternion(-.42349562725486367,.6303243319763392,.6506476102939456,-.00052439507486728).normalize();
 it('contains the captured 3.123 rad follow-through flip to a 0.069 rad step',()=>{
  const out=previous.clone(),before=out.clone(),targetBefore=flipped.toArray(),dt=.006899999998509543;
  expect(before.angleTo(flipped)).toBeGreaterThan(3.12);
  expect(advanceShotHandRotation(out,flipped,dt)).toBe(out);
  expect(out.angleTo(before)).toBeLessThanOrEqual(10*dt+1e-7);
  expect(out.angleTo(flipped)).toBeLessThan(before.angleTo(flipped));
  expect(flipped.toArray()).toEqual(targetBefore);
 });
 it('does not mistake antipodal quaternion signs for a real wrist turn',()=>{
  const out=previous.clone(),target=new Quaternion(-previous.x,-previous.y,-previous.z,-previous.w);
  advanceShotHandRotation(out,target,1/120);expect(out.angleTo(previous)).toBeLessThan(1e-7);
 });
 it('converges to a stable target without overshooting through repeated updates',()=>{
  const out=previous.clone();let distance=out.angleTo(flipped);
  for(let i=0;i<100;i++){
   advanceShotHandRotation(out,flipped,1/120);
   expect(out.angleTo(flipped)).toBeLessThanOrEqual(distance+1e-7);distance=out.angleTo(flipped);
  }
  expect(distance).toBeLessThan(1e-7);
 });
 for(const dt of [0,-1,Number.NaN,Number.POSITIVE_INFINITY])it(`freezes when the simulation clock is paused or invalid (${dt})`,()=>{
  const out=previous.clone();advanceShotHandRotation(out,flipped,dt);expect(out.toArray()).toEqual(previous.toArray());
 });
 it('caps a resumed frame to 60 ms of rotation rather than skipping the visible transition',()=>{
  const out=previous.clone();advanceShotHandRotation(out,flipped,2);
  expect(out.angleTo(previous)).toBeCloseTo(.6,10);
 });
 it('ignores a damaged desired rotation and preserves a finite previous wrist',()=>{
  const out=previous.clone();
  for(const bad of [new Quaternion(Number.NaN,0,0,1),new Quaternion(0,0,0,0),null as unknown as Quaternion]){
   advanceShotHandRotation(out,bad,1/120);expect(out.toArray()).toEqual(previous.toArray());
  }
 });
});
