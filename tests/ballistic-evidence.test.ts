import {describe,expect,it} from 'vitest';
import {BallPhysics,shotVelocity} from '../src/worlds/basketballPhysics';

describe('native free-flight evidence follows the real physical clock',()=>{
 it('retains exact gravity when a three-point release exceeds the hand-motion speed envelope',()=>{
  const ball=new BallPhysics(),from={x:-.12,y:2.14,z:.79};ball.launch(from,shotVelocity(from,{x:0,y:.08,z:-1},.55,true));
  expect(Math.hypot(ball.velocity.x,ball.velocity.y,ball.velocity.z)).toBeGreaterThan(9);
  for(const dt of [.0135,.0167,.018,.0231,.0092,.0167]){
   const old={...ball.position},velocity={...ball.velocity},time=ball.elapsed;ball.step(dt);
   const elapsed=ball.elapsed-time;expect(ball.responses).toBe(0);expect(elapsed*120).toBeCloseTo(Math.round(elapsed*120),9);
   expect(ball.position.x).toBeCloseTo(old.x+velocity.x*elapsed,10);
   expect(ball.position.y).toBeCloseTo(old.y+velocity.y*elapsed-4.905*elapsed*elapsed,10);
   expect(ball.position.z).toBeCloseTo(old.z+velocity.z*elapsed,10);
  }
 });
 it('marks real floor, board, rim and wall responses without changing the existing solver',()=>{
  const cases=[{p:{x:0,y:.13,z:0},v:{x:0,y:-2,z:0}}, {p:{x:.5,y:3.6,z:-12.2},v:{x:0,y:0,z:-4}}, {p:{x:.22,y:3.3,z:-12.1},v:{x:0,y:-2,z:0}}, {p:{x:11.69,y:2,z:0},v:{x:5,y:0,z:0}}];
  for(const input of cases){const ball=new BallPhysics();ball.launch(input.p,input.v);for(let i=0;i<25;i++)ball.step(1/120);expect(ball.responses).toBeGreaterThan(0);ball.launch({x:0,y:2,z:0},{x:0,y:2,z:0});expect(ball.responses).toBe(0);}
 });
});
