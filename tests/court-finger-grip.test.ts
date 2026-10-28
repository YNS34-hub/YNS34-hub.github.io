import{describe,it,expect}from'vitest';
import{advanceCourtFingerGrip,createCourtFingerGrip,type CourtFingerContext}from'../src/worlds/presence/courtFingerGrip';
const free:CourtFingerContext={held:false,dribbling:false,shot:0,dribblePhase:0,dribbleLeftInfluence:0,dribbleRightInfluence:1};
const held={...free,held:true},bounce={...held,dribbling:true};

describe('basketball fingers belong to each hand task',()=>{
 for(const hand of[-1,1])it(`leaves the zero-influence ${hand<0?'right':'left'} hand on its real animation`,()=>{
  const state=createCourtFingerGrip();
  for(let i=0;i<180;i++)advanceCourtFingerGrip(state,{...bounce,dribblePhase:i%60/60,dribbleLeftInfluence:hand<0?1:0,dribbleRightInfluence:hand>0?1:0},1/60);
  expect(hand<0?state.right:state.left).toBe(0);
 });
 it('uses the actual independent participation during a hand transfer',()=>{
  const state=createCourtFingerGrip();advanceCourtFingerGrip(state,{...bounce,dribblePhase:.02,dribbleLeftInfluence:.25,dribbleRightInfluence:.75},1/60);
  expect(state.right).toBeGreaterThan(0);expect(state.left/state.right).toBeCloseTo(1/3,8);
 });
 it('does not curl an empty hand from a stale dribbling flag',()=>{
  const state=createCourtFingerGrip();advanceCourtFingerGrip(state,{...free,dribbling:true},1/60);
  expect(state.left).toBe(0);expect(state.right).toBe(0);
 });
 it('preserves the established held and followthrough grip sizes',()=>{
  const a=createCourtFingerGrip(),b=createCourtFingerGrip();advanceCourtFingerGrip(a,held,0);advanceCourtFingerGrip(b,{...free,shot:.5},0);
  expect(a.left).toBe(.30);expect(a.right).toBe(.30);expect(b.left).toBe(.05);expect(b.right).toBe(.05);
 });
 it('releases fingers over real time and holds their actual curl while paused',()=>{
  const state=createCourtFingerGrip();advanceCourtFingerGrip(state,held,1/60);advanceCourtFingerGrip(state,free,0);
  expect(state.left).toBe(.30);advanceCourtFingerGrip(state,free,1/60);expect(state.left).toBeGreaterThan(0);expect(state.left).toBeLessThan(.30);
  for(let i=0;i<120;i++)advanceCourtFingerGrip(state,free,1/60);expect(state.left).toBeLessThan(1e-8);
 });
 it('has the same real-time transition on30,60and120Hz render loops',()=>{
  const results=[30,60,120].map(hz=>{const s=createCourtFingerGrip();advanceCourtFingerGrip(s,held,0);for(let i=0;i<hz/5;i++)advanceCourtFingerGrip(s,free,1/hz);return s.left;});
  expect(results[0]).toBeGreaterThan(0);expect(Math.max(...results)-Math.min(...results)).toBeLessThan(1e-8);
 });
 it('eases the beginning and end of physical contact rather than adding a finger-velocity corner',()=>{
  const sample=(phase:number)=>advanceCourtFingerGrip(createCourtFingerGrip(),{...bounce,dribblePhase:phase},1/60).right;
  for(const boundary of[0,.15,.85,1]){
   const h=1e-5,wrap=(p:number)=>(p+1)%1;
   const before=(sample(wrap(boundary))-sample(wrap(boundary-h)))/h,after=(sample(wrap(boundary+h))-sample(wrap(boundary)))/h;
   expect(Math.abs(before-after)).toBeLessThan(.002);
  }
 });
 it('never adds a full-fist curl beyond the previous ball-contact range',()=>{
  for(let i=0;i<=100;i++){
   const state=createCourtFingerGrip();advanceCourtFingerGrip(state,{...bounce,dribblePhase:i/100},1/60);
   expect(state.right).toBeGreaterThanOrEqual(0);expect(state.right).toBeLessThanOrEqual(.19);expect(state.left).toBe(0);
  }
 });
});
