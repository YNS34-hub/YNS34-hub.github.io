import {describe,it,expect} from 'vitest';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {dribblePose} from '../src/worlds/presence/dribblePose';

const snap=(motion:DribbleMotion)=>JSON.parse(JSON.stringify(motion.sample(0)));
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

for(const style of ['balanced','wide'] as const)it(`keeps ${style} running hips above a deep squat`,()=>{
 const m=new DribbleMotion(1,style),standing=m.sample(0).crouch,running=m.sample(6.2).crouch;
 expect(running).toBeLessThan(.20);expect(running-standing).toBeLessThanOrEqual(.035);
});

it('keeps hesitation outside the captured left running thigh',()=>{
 const m=new DribbleMotion(-1,'wide');m.requestMove('hesitation');let checked=false;
 const original=[-.44351026,.66668405,.66376967],hip=[-.10776303,.73327592,1.11606953],knee=[-.28778559,.67557216,.74078155],ab=knee.map((v,i)=>v-hip[i]);
 for(let i=0;i<4400;i++){
  const p=m.advance(1/2400,3.58574,'wide',true);if(p.move!=='hesitation'||Math.abs(p.phase-.1976359)>.0005)continue;
  const plain=dribblePose(p.phase,3.58574,-1,undefined,motionPacks.dribble.wide.sprintPeriod*1.35,motionPacks.dribble.wide);
  const ball=[original[0]+p.ball.x-plain.ball.x,original[1],original[2]];
  const t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(ball[i]-hip[i]),0)/ab.reduce((s,v)=>s+v*v,0)));
  expect(Math.hypot(...ball.map((v,i)=>v-hip[i]-t*ab[i]))).toBeGreaterThanOrEqual(.175);checked=true;
 }
 expect(checked).toBe(true);
});

describe('catch-queued creative dribbles',()=>{
 for(const style of ['balanced','low','wide'] as const) for(const hand of [-1,1]) for(const move of ['between-legs','behind-back','hesitation'] as const) it(`${style}/${hand}/${move} preserves catch continuity and ball-ground clearance`,()=>{
  const m=new DribbleMotion(hand,style); for(let i=0;i<13;i++)m.advance(1/120); const before=snap(m);m.requestMove(move);expect(snap(m)).toEqual(before);
  let prior=before,seen=false,handChanges=0,maxBehind=-Infinity,minGap=Infinity;
  for(let i=0;i<310;i++){
   const p=JSON.parse(JSON.stringify(m.advance(1/120,0,style)));
   for(const key of ['ball','leftPalm','rightPalm'] as const)expect(distance(p[key],prior[key])).toBeLessThan(.095);
   expect(p.ball.y).toBeGreaterThanOrEqual(.12-1e-7);expect(Object.values(p.ball).every(Number.isFinite)).toBe(true);
   if(p.hand!==prior.hand){handChanges++;expect(p.phase).toBeLessThan(.03);}
   if(p.move===move){seen=true;maxBehind=Math.max(maxBehind,p.ball.z);if(Math.abs(p.phase-.44)<.035)minGap=Math.min(minGap,Math.abs(p.ball.x));}
   prior=p;
  }
  expect(seen).toBe(true);expect(prior.move).toBe('crossover');expect(handChanges).toBe(move==='hesitation'?0:1);
  if(move==='behind-back')expect(maxBehind).toBeGreaterThan(.10);
  if(move==='between-legs'){expect(maxBehind).toBeGreaterThan(-.30);expect(minGap).toBeLessThan(.05);}
 });
 it('pauses a queued move and keeps the requested route when the hand preference is polled',()=>{
  const m=new DribbleMotion(1,'low');m.requestMove('behind-back');const before=snap(m);expect(m.advance(.06,0,'low',false,true)).toEqual(before);
  let seen=false;for(let i=0;i<240;i++){m.requestHand(1);const p=m.advance(1/120);if(p.move==='behind-back')seen=true;}
  expect(seen).toBe(true);
 });
 it('does not stack repeated commands while a creative move is queued',()=>{
  const m=new DribbleMotion();m.requestMove('between-legs');m.requestMove('behind-back');let routes=0;let previous='crossover';
  for(let i=0;i<310;i++){const p=m.advance(1/120);if(p.move!==previous&&p.move!=='crossover')routes++;previous=p.move;}
  expect(routes).toBe(1);
 });
});

describe('rear-route ball clearance during the rising catch',()=>{
 it('clears the actual left running thigh as it opens into the rear gather',()=>{
  const m=new DribbleMotion(-1,'wide');m.requestMove('behind-back');let checked=false;
  const hip=[-.10257208,.73430679,1.57610948],knee=[-.47340781,.56043566,1.48214878],ab=knee.map((v,i)=>v-hip[i]);
  for(let i=0;i<4400;i++){
   const p=m.advance(1/2400,3.38665,'wide',true);if(p.move!=='behind-back'||Math.abs(p.phase-.1959756)>.0005)continue;
   const ball=[p.ball.x,p.ball.y,p.ball.z+1.5656651],t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(ball[i]-hip[i]),0)/ab.reduce((s,v)=>s+v*v,0)));
   expect(Math.hypot(...ball.map((v,i)=>v-hip[i]-t*ab[i]))).toBeGreaterThanOrEqual(.175);checked=true;
  }
  expect(checked).toBe(true);
 });
 it('keeps margin at the early rear-entry thigh frame',()=>{
  const m=new DribbleMotion(1,'balanced');m.requestMove('behind-back');let checked=false;
  const hip=[.0950971,.8165775,4.0022481],knee=[.3555703,.5100265,3.8807609],ab=knee.map((v,i)=>v-hip[i]);
  for(let i=0;i<4400;i++){
   const p=m.advance(1/2400);if(p.move!=='behind-back'||Math.abs(p.phase-.19829268)>.0005)continue;
   const ball=[p.ball.x,p.ball.y,p.ball.z+4],t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(ball[i]-hip[i]),0)/ab.reduce((s,v)=>s+v*v,0)));
   expect(Math.hypot(...ball.map((v,i)=>v-hip[i]-t*ab[i]))).toBeGreaterThanOrEqual(.175);checked=true;
  }
  expect(checked).toBe(true);
 });
 for(const style of ['balanced','low','wide'] as const)it(`${style} releases the rear free bounce instead of dragging a wrist behind the low ball`,()=>{
  const m=new DribbleMotion(1,style);m.requestMove('behind-back');let free=false,caught=false;
  for(let i=0;i<4400;i++){
   const p=m.advance(1/2400,0,style);
   if(p.move==='behind-back'&&p.phase>.30&&p.phase<.65){
    free=true;expect(p.leftPalm.z).toBeLessThan(.20);expect(p.rightPalm.z).toBeLessThan(.20);
    expect(p.leftPalm.y).toBeGreaterThan(.85);expect(p.rightPalm.y).toBeGreaterThan(.85);
   }
   if(free&&p.move==='crossover'&&p.hand===-1&&p.phase<.005){
    caught=true;expect(Math.hypot(p.leftPalm.x-p.ball.x,p.leftPalm.z-p.ball.z)).toBeLessThan(.01);
   }
  }
  expect(free&&caught).toBe(true);
 });
 it('also clears the outward knee at the actual entering-back frame',()=>{
  const m=new DribbleMotion(1,'balanced');m.requestMove('behind-back');let checked=false;
  const hip=[.09507,.81606,4.002],knee=[.37104,.51639,3.89898],ab=knee.map((v,i)=>v-hip[i]);
  for(let i=0;i<3200;i++){
   const p=m.advance(1/2400);if(p.move!=='behind-back'||Math.abs(p.phase-.232683)>.0005)continue;
   const ball=[p.ball.x,p.ball.y,p.ball.z+4],t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(ball[i]-hip[i]),0)/ab.reduce((s,v)=>s+v*v,0)));
   expect(Math.hypot(...ball.map((v,i)=>v-hip[i]-t*ab[i]))).toBeGreaterThanOrEqual(.175);checked=true;
  }
  expect(checked).toBe(true);
 });
 it('keeps the descending ball outside the captured source thigh before crossing behind',()=>{
  const m=new DribbleMotion(1,'balanced');m.requestMove('behind-back');let checked=false;
  const hip=[.0950379,.8164907,4.0024327],knee=[.2011921,.4798485,3.7744366],ab=knee.map((v,i)=>v-hip[i]);
  for(let i=0;i<3200;i++){
   const p=m.advance(1/2400);if(p.move!=='behind-back'||Math.abs(p.phase-.228)>.0005)continue;
   const ball=[p.ball.x,p.ball.y,p.ball.z+4],t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(ball[i]-hip[i]),0)/ab.reduce((s,v)=>s+v*v,0)));
   expect(Math.hypot(...ball.map((v,i)=>v-hip[i]-t*ab[i]))).toBeGreaterThanOrEqual(.175);checked=true;
  }
  expect(checked).toBe(true);
 });
 it('keeps the rising ball behind the hip until it is beside the receiving hand',()=>{
  for(const style of ['balanced','low','wide'] as const){
   const m=new DribbleMotion(1,style);m.requestMove('behind-back');
   let caught=false;
   for(let i=0;i<400;i++){
    const p=m.advance(1/240,0,style);
    if(p.move==='behind-back'&&p.phase>=.40&&p.phase<=.80&&Math.abs(p.ball.x)<motionPacks.dribble[style].spread*.9){caught=true;expect(p.ball.z).toBeGreaterThan(.15);}
   }
   expect(caught).toBe(true);
  }
 });
});

describe('between-legs transfer follows the actual low bounce',()=>{
 const segmentDistance=(p:number[],a:number[],b:number[])=>{
  const ab=b.map((v,i)=>v-a[i]),ap=p.map((v,i)=>v-a[i]);
  const t=Math.max(0,Math.min(1,ap.reduce((s,v,i)=>s+v*ab[i],0)/ab.reduce((s,v)=>s+v*v,0)));
  return Math.hypot(...p.map((v,i)=>v-a[i]-t*ab[i]));
 };
 // Real native frames that previously penetrated the incoming calf and receiving thigh.
 for(const frame of [
  {phase:.3033846,hip:[.095118,.816569,4.002153],knee:[.304917,.469560,3.891935],foot:[.315799,.112,4.107669]},
  {phase:.6778462,hip:[-.090905,.821496,3.999149],knee:[-.312519,.522403,3.804190],foot:[-.329616,.112,3.880251]},
 ])it(`clears the actual leg segments at phase ${frame.phase}`,()=>{
  const m=new DribbleMotion(1,'balanced');m.requestMove('between-legs');let checked=false;
  for(let i=0;i<6000;i++){
   const p=m.advance(1/2400,0,'balanced');if(p.move!=='between-legs'||Math.abs(p.phase-frame.phase)>.0005)continue;
   const ball=[p.ball.x,p.ball.y,p.ball.z+4];
   expect(segmentDistance(ball,frame.hip,frame.knee)).toBeGreaterThanOrEqual(.165);
   expect(segmentDistance(ball,frame.knee,frame.foot)).toBeGreaterThanOrEqual(.165);checked=true;
  }
  expect(checked).toBe(true);
 });
 for(const hand of [-1,1])it(`hand ${hand} stays outside the thigh before descent and after rise`,()=>{
  const m=new DribbleMotion(hand,'balanced');m.requestMove('between-legs');let descent=false,rise=false,low=false;
  for(let i=0;i<1200;i++){
   const p=m.advance(1/480,0,'balanced');if(p.move!=='between-legs')continue;
   if(p.phase>=.29&&p.phase<=.31){descent=true;expect(p.ball.x*hand).toBeGreaterThan(.26);expect(p.ball.z).toBeLessThan(-.35);}
   if(p.phase>=.67&&p.phase<=.69){rise=true;expect(p.ball.x*hand).toBeLessThan(-.30);expect(p.ball.z).toBeLessThan(-.35);}
   if(Math.abs(p.phase-.44)<.004){low=true;expect(Math.abs(p.ball.x)).toBeLessThan(.02);expect(p.ball.y).toBeLessThan(.15);expect(p.ball.z).toBeGreaterThan(-.28);expect(p.ball.z).toBeLessThan(-.22);}
  }
  expect(descent&&rise&&low).toBe(true);
 });
});
