import {describe,expect,it} from 'vitest';
import {sampleCourtClipWeights} from '../src/worlds/presence/courtLocomotion';

describe('actual idle/walk/run clips share continuous speed weights',()=>{
 it('does not switch the free arm to another pose as acceleration crosses 3.5m/s',()=>{
  const a=sampleCourtClipWeights({idle:0,walk:0,run:0},3.499),b=sampleCourtClipWeights({idle:0,walk:0,run:0},3.501);
  expect(Math.abs(a.run-b.run)).toBeLessThan(.002);expect(a.run).toBeGreaterThan(.45);expect(b.walk).toBeGreaterThan(.45);
 });
 it('retains the real idle, walking and full-speed running clips with normalized weights',()=>{
  const out={idle:0,walk:0,run:0};
  expect(sampleCourtClipWeights(out,0)).toEqual({idle:1,walk:0,run:0});
  expect(sampleCourtClipWeights(out,2)).toEqual({idle:0,walk:1,run:0});
  expect(sampleCourtClipWeights(out,6.2)).toEqual({idle:0,walk:0,run:1});
  for(let speed=0;speed<=7;speed+=.01){expect(sampleCourtClipWeights(out,speed)).toBe(out);expect(out.idle+out.walk+out.run).toBeCloseTo(1,12);expect(Object.values(out).every(v=>v>=0&&v<=1)).toBe(true);}
 });
 it('gathers into the original idle base and keeps damaged speed finite',()=>{
  for(const speed of [0,3.5,6.2,NaN,Infinity])expect(sampleCourtClipWeights({idle:0,walk:0,run:0},speed,true)).toEqual({idle:1,walk:0,run:0});
  expect(sampleCourtClipWeights({idle:0,walk:0,run:0},NaN)).toEqual({idle:1,walk:0,run:0});
 });
});
