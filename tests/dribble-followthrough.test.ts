import {describe,expect,it} from 'vitest';
import {dribblePose} from '../src/worlds/presence/dribblePose';
import {motionPacks} from '../src/worlds/court/motionPacks';

describe('the dribbling hand follows the push and recovers before the next catch',()=>{
 for(const style of ['balanced','low','wide'] as const)for(const side of [-1,1])it(`${style}/${side} recovers near the hip rather than holding a fixed horizontal palm`,()=>{
  const pack=motionPacks.dribble[style],catching=dribblePose(0,0,side,undefined,pack.period,pack),released=dribblePose(.34,0,side,undefined,pack.period,pack);
  expect(catching.palm.y-released.palm.y).toBeGreaterThan(style==='low'?.14:.25);
  expect(released.palm.z-released.ball.z).toBeGreaterThan(.15);
  expect(Math.abs(released.palm.x)).toBeLessThan(Math.abs(released.ball.x)-.025);
  for(const phase of [0,1]){
   const pose=dribblePose(phase,0,side,undefined,pack.period,pack);
   expect(pose.palm.x).toBeCloseTo(pose.ball.x,12);expect(pose.palm.z).toBeCloseTo(pose.ball.z,12);expect(pose.palm.y-pose.ball.y).toBeCloseTo(.115,12);
   expect(Math.hypot(pose.palm.y-pose.ball.y,pose.palm.z-pose.ball.z)).toBeLessThan(.12);
  }
 });
 for(const speed of [0,3,6.2])it(`keeps both recoveries mirrored and continuous at ${speed}m/s`,()=>{
  for(const pack of Object.values(motionPacks.dribble)){
   let previous=dribblePose(0,speed,1,undefined,pack.period,pack).palm;
   for(let i=1;i<=480;i++){
    const phase=i/480,a=dribblePose(phase,speed,1,undefined,pack.period,pack),b=dribblePose(phase,speed,-1,undefined,pack.period,pack);
    expect(a.palm.x).toBeCloseTo(-b.palm.x,12);expect(a.palm.y).toBeCloseTo(b.palm.y,12);expect(a.palm.z).toBeCloseTo(b.palm.z,12);
    expect(Math.hypot(a.palm.x-previous.x,a.palm.y-previous.y,a.palm.z-previous.z)).toBeLessThan(.025+9*pack.period/480);
    expect(a.palm.y).toBeGreaterThan(a.ball.y+.07499);previous={...a.palm};
   }
  }
 });
});
