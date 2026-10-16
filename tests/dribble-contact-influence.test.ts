import {describe,it,expect} from 'vitest';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';

describe('rendered arm contact is independent of the physical bounce',()=>{
 for(const style of ['balanced','low','wide'] as const)for(const hand of [-1,1])it(`${style}/${hand} frees the opposite arm while retaining exact active palm contact`,()=>{
  const m=new DribbleMotion(hand,style);
  for(let i=0;i<320;i++){
   const p=m.advance(1/240,4,style,true),active=hand<0?p.leftPalm:p.rightPalm;
   expect(hand<0?p.leftInfluence:p.rightInfluence).toBe(1);
   expect(hand<0?p.rightInfluence:p.leftInfluence).toBe(0);
   expect(p.contactPalm).toEqual(active);expect(p.contactPalm).not.toBe(p.ball);
  }
 });
 for(const move of ['between-legs','behind-back'] as const)for(const hand of [-1,1])it(`${move}/${hand} releases both arms during free flight and commits the receiving arm at catch`,()=>{
  const m=new DribbleMotion(hand);m.requestMove(move);let free=0,caught=false;
  for(let i=0;i<900;i++){
   const p=m.advance(1/240,3.2,'balanced',true);
   expect(p.leftInfluence).toBeGreaterThanOrEqual(0);expect(p.rightInfluence).toBeGreaterThanOrEqual(0);
   expect(p.leftInfluence).toBeLessThanOrEqual(p.leftWeight);expect(p.rightInfluence).toBeLessThanOrEqual(p.rightWeight);
   if(p.move===move&&p.phase>.20&&p.phase<.75){expect(p.leftInfluence+p.rightInfluence).toBe(0);free++;}
   if(free>0&&p.move==='crossover'&&p.hand===-hand){
    expect(hand<0?p.rightInfluence:p.leftInfluence).toBe(1);
    expect(p.contactPalm).toEqual(hand<0?p.rightPalm:p.leftPalm);caught=true;break;
   }
  }
  expect(free).toBeGreaterThan(30);expect(caught).toBe(true);
 });
 it('keeps the raw catch position and influence frozen with the same paused motion clock',()=>{
  const m=new DribbleMotion(-1,'low');m.requestMove('behind-back');
  for(let i=0;i<180;i++)m.advance(1/240,3,'low',true);
  const before=structuredClone(m.sample(3));expect(m.advance(.06,3,'low',true,true)).toEqual(before);
 });
});
