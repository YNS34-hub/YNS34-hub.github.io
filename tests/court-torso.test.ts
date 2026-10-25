import {describe,expect,it} from 'vitest';
import {advanceCourtTorso,createCourtTorso} from '../src/worlds/presence/courtTorso';

describe('the torso follows the same real action clock across transitions',()=>{
 for(const fps of [30,60,120,240])it(`enters and exits a low running dribble without a posture switch at ${fps}Hz`,()=>{
  const out=createCourtTorso(),target={pitch:-.55,turn:.10,roll:-.024};
  for(let i=0;i<fps;i++){
   const before={...out};expect(advanceCourtTorso(out,target,1/fps)).toBe(out);
   for(const key of ['pitch','turn','roll']as const)expect(Math.abs(out[key]-before[key])).toBeLessThanOrEqual(4.5/fps+1e-12);
  }
  expect(Math.abs(out.pitch-target.pitch)).toBeLessThan(1e-8);
  const shot={pitch:0,turn:.035,roll:0},before={...out};advanceCourtTorso(out,shot,1/fps);
  expect(Math.abs(out.pitch-before.pitch)).toBeLessThanOrEqual(4.5/fps+1e-12);
  for(let i=0;i<fps;i++)advanceCourtTorso(out,createCourtTorso(),1/fps);
  expect(Math.abs(out.pitch)+Math.abs(out.turn)+Math.abs(out.roll)).toBeLessThan(1e-8);
 });
 it('freezes the retained pose during a paused outfit rebuild',()=>{
  const pose={pitch:-.31,turn:.07,roll:-.02},saved={...pose};
  for(let i=0;i<50;i++)expect(advanceCourtTorso(pose,{pitch:0,turn:0,roll:0},0)).toBe(pose);
  expect(pose).toEqual(saved);
 });
 it('keeps both body directions mirrored without mutating their targets',()=>{
  const left=createCourtTorso(),right=createCourtTorso(),a=Object.freeze({pitch:-.45,turn:-.10,roll:.024}),b=Object.freeze({pitch:-.45,turn:.10,roll:-.024});
  for(let i=0;i<100;i++){advanceCourtTorso(left,a,1/120);advanceCourtTorso(right,b,1/120);expect(left.pitch).toBe(right.pitch);expect(left.turn).toBe(-right.turn);expect(left.roll).toBe(-right.roll);}
 });
});
