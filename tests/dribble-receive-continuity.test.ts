import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {dribbleContact} from '../src/worlds/presence/dribblePalm';
type Frame={phase:number;base:number[];raw:number[];weight:number;actual:number[]};
const saved=JSON.parse(readFileSync('tests/fixtures/native-rear-catch-20261021.json','utf8')) as {palmSourceSha256:string;pairs:{dt:number;a:Frame;b:Frame}[]};
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
describe('the receiving hand prepares before the high-speed rear catch',()=>{
 for(const side of [-1,1])it(`keeps the captured ${side} sprint catch under the unchanged world wrist-speed gate`,()=>{
  expect(saved.palmSourceSha256).toBe('9384921d4bb7c0da3bf6532f051598ad4bf93fb4cd4ce48abbc7161f91e01c8f');
  for(const pair of saved.pairs){
   const limit=.025+9*pair.dt;expect(distance(pair.a.actual,pair.b.actual)).toBeGreaterThan(limit);
   const target=(f:Frame)=>f.base.map((v,i)=>(v+(f.raw[i]-v)*f.weight*dribbleContact(f.phase))*(i===0?side:1));
   expect(distance(target(pair.a),target(pair.b))).toBeLessThan(limit);
  }
 });
});
