import {describe,expect,it} from 'vitest';
import {Vector3} from 'three';
import {blendShotGather,chooseShotGatherDuration} from '../src/worlds/presence/shotGather';
import {prepareShot} from '../src/worlds/presence/shotPose';
import {motionPacks} from '../src/worlds/court/motionPacks';

// Native quick-transition-right: the ball is still at the low rear bounce when
// the player stops and starts gathering. These are neutral-avatar world points.
const seed=new Vector3(.2504828200653237,.13714826790103296,1.776399660696566),origin=new Vector3(0,1.65,1.189572150012696),initialSpeed=.5161808993528233;
const rest=new Vector3(.23,1.13,origin.z-.35),duration=()=>chooseShotGatherDuration(true,seed.distanceTo(rest));
function trajectory(fps:number,gather=duration()){
 const dt=1/fps,out=new Vector3(),body=new Vector3(),previous=seed.clone();let maximum=0,violations=0;
 for(let i=1;i<=Math.ceil(.42*fps);i++){
  const elapsed=i*dt,prep=prepareShot(elapsed/motionPacks.shot.quick.chargeDuration,motionPacks.shot.quick);
  body.set(0,1.65,origin.z-initialSpeed*(1-Math.exp(-7*elapsed))/7);out.set(prep.x,prep.y+prep.jump,body.z+prep.z);
  blendShotGather(out,seed,origin,body,elapsed,gather);const step=out.distanceTo(previous);maximum=Math.max(maximum,step/dt);violations+=Number(step>=.025+9*dt);previous.copy(out);
 }
 return {maximum,violations};
}
describe('collecting a low rear dribble into a shot',()=>{
 it('retains the old fast held-shot timing and gives the actual rear ball a longer bounded gather',()=>{
  expect(chooseShotGatherDuration(false,20)).toBe(.16);expect(chooseShotGatherDuration(true,.15)).toBe(.16);
  expect(duration()).toBeGreaterThan(.30);expect(duration()).toBeLessThanOrEqual(.34);
  for(const pack of Object.values(motionPacks.shot))expect(chooseShotGatherDuration(true,20)).toBeLessThan(.46*pack.chargeDuration);
 });
 it('reproduces the excessive velocity of the old fixed .16-second collection',()=>{
  const old=trajectory(120,.16);expect(old.maximum).toBeGreaterThan(12);expect(old.violations).toBeGreaterThan(0);
 });
 for(const fps of [30,60,120,240])it(`keeps the captured physical gather continuous at ${fps}fps`,()=>{
  const result=trajectory(fps);expect(result.violations).toBe(0);expect(result.maximum).toBeLessThan(9);
 });
 for(const invalid of [NaN,Infinity,-Infinity,-2])it(`handles invalid travel distance ${invalid}`,()=>{
  expect(chooseShotGatherDuration(true,invalid)).toBe(.16);
 });
 it('starts from the actual translated ball and ends on the current shot goal without touching snapshots',()=>{
  const body=new Vector3(.4,1.65,origin.z-.3),goal=new Vector3(.2,1.8,-.3),out=goal.clone(),before=[seed.toArray(),origin.toArray(),body.toArray()];
  expect(blendShotGather(out,seed,origin,body,0,duration())).toBe(out);expect(out.distanceTo(seed.clone().add(body).sub(origin))).toBeLessThan(1e-12);
  out.copy(goal);blendShotGather(out,seed,origin,body,duration(),duration());expect(out.toArray()).toEqual(goal.toArray());expect([seed.toArray(),origin.toArray(),body.toArray()]).toEqual(before);
 });
 it('collects ball and wrists with one shared easing, including a hand released above a low bounce',()=>{
  const wristSeed=new Vector3(.38,.95,origin.z+.3),offset=new Vector3(-.025,-.115,0),body=origin.clone().add(new Vector3(.1,0,-.2));
  for(let i=0;i<=100;i++){
   const t=i/100,s=t*t*(3-2*t),goal=new Vector3(.23,1.22,body.z-.35),ball=goal.clone(),wrist=goal.clone().add(offset);
   blendShotGather(ball,seed,origin,body,t*duration(),duration());
   blendShotGather(wrist,wristSeed,origin,body,t*duration(),duration());
   const relative=wristSeed.clone().sub(seed).multiplyScalar(1-s).addScaledVector(offset,s);
   expect(wrist.clone().sub(ball).distanceTo(relative)).toBeLessThan(1e-12);
   if(t>=.9)expect(wrist.distanceTo(ball)).toBeLessThan(.15);
   if(t===.5){
    const delayed=ball.clone().add(offset).lerp(wristSeed.clone().add(body).sub(origin),1-t);
    expect(delayed.clone().sub(ball).distanceTo(relative)).toBeGreaterThan(.20);
   }
  }
 });
});
