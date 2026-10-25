import {describe,it,expect} from 'vitest';
import {creativeDribbleWindow,creativeDribbleSpeed} from '../src/worlds/court/controls';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';
describe('physical creative-dribble change of pace',()=>{
 for(const style of ['balanced','low','wide'] as const)for(const hz of [24,30,60,120])it(`${style} keeps the new forward approach continuous through a long rendered interval at ${hz}Hz`,()=>{
  const m=new DribbleMotion(-1,style);m.requestMove('between-legs');let speed=6.2,body=0,previous:{ball:{x:number;y:number;z:number};move:string}|null=null;
  for(let i=0;i<hz*4;i++){
   const dt=i%7===0?.0373:1/hz,old=m.sample(speed),active=old.move==='between-legs';
   speed+=(creativeDribbleSpeed(6.2,old.move,old.phase,active)-speed)*(1-Math.exp(-dt*(7+28*creativeDribbleWindow(old.move,old.phase,active))));body-=speed*dt;
   const p=m.advance(dt,speed,style,true),ball={...p.ball,z:p.ball.z+body};
   if(previous&&(previous.move==='between-legs'||p.move==='between-legs'))expect(Math.hypot(ball.x-previous.ball.x,ball.y-previous.ball.y,ball.z-previous.ball.z)).toBeLessThan(.025+9*dt);
   previous={ball,move:p.move};
  }
 });
 for(const style of ['balanced','low','wide'] as const)for(const move of ['between-legs','behind-back'] as const)for(const hz of [60,120])it(`${style}/${move} includes actual braking and late acceleration at ${hz}Hz`,()=>{
  const m=new DribbleMotion(1,style),dt=1/hz;let speed=6.2,body=0;
  let prior:({ball:{x:number;y:number;z:number};leftPalm:{x:number;y:number;z:number};rightPalm:{x:number;y:number;z:number};move:string})|null=null;
  m.requestMove(move);
  for(let i=0;i<hz*3;i++){
   const old=m.sample(speed),active=old.move==='between-legs'||old.move==='behind-back',window=creativeDribbleWindow(old.move,old.phase,active);
   const desired=creativeDribbleSpeed(6.2,old.move,old.phase,active);
   speed+=(desired-speed)*(1-Math.exp(-dt*(7+28*window)));body-=speed*dt;
   const p=structuredClone(m.advance(dt,speed,style,true));
   const world={ball:{...p.ball,z:p.ball.z+body},leftPalm:{...p.leftPalm,z:p.leftPalm.z+body},rightPalm:{...p.rightPalm,z:p.rightPalm.z+body}};
   if(prior&&(p.move===move||prior.move===move))for(const key of ['ball','leftPalm','rightPalm'] as const){
    const a=world[key],b=prior[key];expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeLessThan(.025+9*dt);
   }
   prior={...world,move:p.move};
  }
 });
 it('preserves ordinary movement and cycle endpoints',()=>{
  for(const phase of [0,1,Number.NaN])expect(creativeDribbleSpeed(6.2,'between-legs',phase,true)).toBe(6.2);
  for(const p of [.2,.5,.8])expect(creativeDribbleSpeed(6.2,'crossover',p,true)).toBe(6.2);
  expect(creativeDribbleSpeed(6.2,'hesitation',.5,true)).toBe(3);
  expect(creativeDribbleSpeed(6.2,'behind-back',.5,false)).toBe(6.2);
  expect(creativeDribbleSpeed(2.7,'between-legs',.5,true)).toBe(2.7);
 });
 for(const hz of [60,120,240])it(`decelerates through actual velocity integration at ${hz}Hz without a clamp`,()=>{
  const dt=1/hz;let v=6.2,position=0;
  for(let t=0;t<=.82;t+=dt){
   const phase=t/.82,w=creativeDribbleWindow('behind-back',phase,true),desired=creativeDribbleSpeed(6.2,'behind-back',phase,true),old=v;
   v+=(desired-v)*(1-Math.exp(-dt*(7+28*w)));position+=v*dt;
   expect(v).toBeGreaterThanOrEqual(3-1e-9);expect(v).toBeLessThanOrEqual(6.2);
   expect(Math.abs(v-old)).toBeLessThan(.65);
   if(phase>=.44&&phase<=.64)expect(v).toBeLessThan(3.2);
  }
  expect(position).toBeGreaterThan(2.4);expect(v).toBeGreaterThan(4);
 });
 for(const style of ['balanced','low','wide'] as const)for(const move of ['between-legs','behind-back'] as const)it(`${style}/${move} leaves world-speed margin during controlled running`,()=>{
  const m=new DribbleMotion(1,style);m.requestMove(move);const dt=1/120;let body=0,prior:({ball:{x:number;y:number;z:number};leftPalm:{x:number;y:number;z:number};rightPalm:{x:number;y:number;z:number};move:string})|null=null,seen=false;
  for(let i=0;i<350;i++){
   const p=structuredClone(m.advance(dt,3.2,style,true));body-=3.2*dt;
   const world={ball:{...p.ball,z:p.ball.z+body},leftPalm:{...p.leftPalm,z:p.leftPalm.z+body},rightPalm:{...p.rightPalm,z:p.rightPalm.z+body}};
   if(prior&&(p.move===move||prior.move===move))for(const k of ['ball','leftPalm','rightPalm'] as const){
    const a=world[k],b=prior[k];expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeLessThan(.025+9*dt);
   }
   if(p.move===move)seen=true;prior={...world,move:p.move};
  }
  expect(seen).toBe(true);
 });
});
