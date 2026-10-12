import {describe,it,expect} from 'vitest';
import {courtMovementSpeed,isCourtTurboKey,isPrimaryShotKey} from '../src/worlds/court/controls';
import {dribblePose} from '../src/worlds/presence/dribblePose';
import {balancedLean,visualSteering} from '../src/worlds/road/balance';
import {riderPosture} from '../src/worlds/presence/riderPose';
import {sportPixelRatio} from '../src/worlds/presence/clarity';
import {FinishMotion} from '../src/worlds/court/finishing';

describe('requested court preset',()=>{
 it('uses only Enter for court acceleration, leaving other museum walking intact',()=>{
  for(const key of ['Enter','NumpadEnter']){expect(isCourtTurboKey(key)).toBe(true);expect(courtMovementSpeed('basketball',new Set(['KeyW',key]))).toBe(6.2);}
  for(const key of ['ShiftLeft','ShiftRight','Space']){expect(isCourtTurboKey(key)).toBe(false);expect(courtMovementSpeed('basketball',new Set(['KeyW',key]))).toBe(2.7);}
  expect(courtMovementSpeed('atrium',new Set(['ShiftLeft']))).toBe(4.45);expect(courtMovementSpeed('atrium',new Set(['Enter']))).toBe(2.7);
  expect(isPrimaryShotKey('Space')).toBe(false);
 });
});
describe('coupled dribble',()=>{
 it('uses gravity in both airborne portions rather than speeding up the ball with arbitrary sine motion',()=>{
  const period=.65,dp=.0001;
  for(const p of [.20,.72]){const y=(at:number)=>dribblePose(at,0).ball.y;expect((y(p+dp)-2*y(p)+y(p-dp))/(dp*period)**2).toBeCloseTo(-9.81,4);}
 });
 it('has a continuous top / real floor contact, without forcing the wrist down to the floor',()=>{
  const top=dribblePose(0,0),end=dribblePose(1,0),bounce=dribblePose(.44,0);
  expect(top.ball.y).toBeCloseTo(end.ball.y);expect(bounce.ball.y).toBeCloseTo(.12);
  for(let p=0;p<=1;p+=.01){const pose=dribblePose(p,5);expect(pose.palm.y).toBeGreaterThan(.8);expect(pose.ball.y).toBeGreaterThanOrEqual(.12);}
  expect(bounce.palm.y-bounce.ball.y).toBeGreaterThan(.65);
 });
 it('keeps left / right paths symmetric and lowers the live dribble while running',()=>{
  expect(dribblePose(.2,6,-1).ball.x).toBeCloseTo(-dribblePose(.2,6,1).ball.x);
  expect(dribblePose(0,6).ball.y).toBeLessThan(dribblePose(0,0).ball.y);
 });
});
describe('cycling balance and standing posture',()=>{
 it('turns the -Z-facing front wheel toward the real path, including automatic route curves',()=>{
  expect(visualSteering(.03,0)).toBeLessThan(0);expect(visualSteering(0,.10)).toBeCloseTo(-.1);
  expect(visualSteering(-.03,0)).toBeGreaterThan(0);expect(visualSteering(0,0)).toBe(0);
 });
 it('uses lateral acceleration for visible lean while remaining bounded',()=>{
  expect(balancedLean(0,.2)).toBe(0);expect(balancedLean(12,0)).toBe(0);
  expect(balancedLean(10,.03)).toBeCloseTo(Math.atan(3/9.81));
  expect(Math.abs(balancedLean(15,10))).toBeLessThanOrEqual(.52);
  expect(balancedLean(10,-.03)).toBeCloseTo(-balancedLean(10,.03));
 });
 it('lifts the hips over the crank in standing mode and keeps comfort free from sway',()=>{
  for(const style of ['city','road'] as const){const seat=riderPosture(style,1,0,1,false,0),stand=riderPosture(style,1,0,1,false,1);
   expect(stand.hipRise-seat.hipRise).toBeGreaterThan(.075);expect(stand.hipForward).toBeLessThan(seat.hipForward-.1);
   expect(riderPosture(style,1,0,1,true,1).rock).toBe(0);
  }
 });
});
describe('sport clarity budget',()=>{
 it('supersamples 1080p without lowering 1440p / 4K below native or spending unbounded pixels',()=>{
  expect(sportPixelRatio(1,1920,1080,'medium')).toBe(1.25);expect(sportPixelRatio(1,1920,1080,'high')).toBe(1.5);
  expect(sportPixelRatio(2,2560,1440,'high')**2*2560*1440).toBeLessThanOrEqual(4_700_001);
  expect(sportPixelRatio(1,3840,2160,'high')).toBe(1);expect(sportPixelRatio(2,1920,1080,'low')).toBe(.85);
 });
});
describe('finish contacts and release continuity',()=>{
 it('keeps a standing foot planted through the other foot step and releases at the held position exactly',()=>{
  const input={held:true,position:{x:0,y:1.65,z:-9.8},direction:{x:0,y:0,z:-1},speed:4,hand:1};
  const motion=new FinishMotion();motion.start('layup',input);
  let a,b,release;
  for(let frame=0;frame<180;frame++){const p=motion.advance(1/120);if(!p)continue;if(p.elapsed>.13&&!a)a=p;if(p.elapsed>.20&&!b)b=p;if(p.release)release=p;}
  expect(a!.leftFoot.x).toBeCloseTo(b!.leftFoot.x);expect(a!.leftFoot.z).toBeCloseTo(b!.leftFoot.z);
  expect(release!.ball.x).toBeCloseTo(release!.release!.origin.x,2);expect(release!.ball.y).toBeCloseTo(release!.release!.origin.y,2);
 });
});
