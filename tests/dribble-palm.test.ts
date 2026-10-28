import {describe,it,expect} from 'vitest';
import {DribbleMotion} from '../src/worlds/presence/dribbleMotion';
import {sampleDribblePalmNormal,advanceDribbleHandRotation,sampleDribbleElbowPole,dribbleContact} from '../src/worlds/presence/dribblePalm';
import {Bone,Group,Quaternion,Vector3} from 'three';
import {LimbIK} from '../src/worlds/presence/ik';
describe('palm participation follows the same transfer as the ball',()=>{
 for(const move of ['crossover','between-legs','behind-back','hesitation'] as const)for(const hand of [-1,1])it(`${move}/${hand} does not flip wrists when the catch commits`,()=>{
  const m=new DribbleMotion(hand);if(move==='crossover')m.requestHand(-hand);else m.requestMove(move);
  let previous:{x:number;y:number;z:number}[]|null=null,changed=false;
  for(let i=0;i<500;i++){
   const p=m.advance(1/240);expect(p.leftWeight+p.rightWeight).toBeCloseTo(1,12);
   const normals=[-1,1].map(side=>sampleDribblePalmNormal({x:0,y:0,z:0},side,p.phase,side<0?p.leftWeight:p.rightWeight));
   if(previous)for(let s=0;s<2;s++)expect(Math.acos(Math.min(1,Math.max(-1,normals[s].x*previous[s].x+normals[s].y*previous[s].y+normals[s].z*previous[s].z)))).toBeLessThan(.13);
   previous=normals;if(p.hand!==hand)changed=true;
  }
  expect(changed).toBe(move!=='hesitation');
 });
 it('reuses finite unit normals without mutating other samples',()=>{
  const out={x:0,y:0,z:0};expect(sampleDribblePalmNormal(out,1,.5,.5)).toBe(out);
  for(const phase of [0,1,.44,Number.NaN])for(const weight of [0,1,.5,Number.NaN]){
   sampleDribblePalmNormal(out,-1,phase,weight);expect(Math.hypot(out.x,out.y,out.z)).toBeCloseTo(1,12);
  }
 });
});

describe('wrist entry follows a continuous rotating target',()=>{
 it('does not change the interpolation arc when the desired wrist crosses 180 degrees from the entry seed',()=>{
  const q=new Quaternion(.0214341,.5739809,.2987206,.7621368).normalize();
  const desired=new Quaternion(.8184613,-.0106412,-.5222003,.2394049).normalize(),before=q.clone();
  advanceDribbleHandRotation(q,desired,.0062);expect(q.angleTo(before)).toBeLessThanOrEqual(.062+1e-10);
  expect(q.angleTo(desired)).toBeLessThan(before.angleTo(desired));
 });
 it('tracks a complete smooth revolution without a half-arc flip or a release-window jump',()=>{
  const q=new Quaternion(),axis=new Vector3(0,1,0),target=new Quaternion();let previous=q.clone();
  for(let i=0;i<500;i++){
   target.setFromAxisAngle(axis,i*.018);advanceDribbleHandRotation(q,target,1/240);
   expect(q.angleTo(previous)).toBeLessThanOrEqual(10/240+1e-9);previous=q.clone();
  }
  expect(q.angleTo(target)).toBeLessThan(.001);
 });
 it('freezes a paused clock and ignores a damaged target',()=>{
  const q=new Quaternion(),target=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),1);
  expect(advanceDribbleHandRotation(q,target,0)).toBe(q);expect(q.angleTo(new Quaternion())).toBe(0);
  advanceDribbleHandRotation(q,new Quaternion(Number.NaN,0,0,1),.01);expect(q.toArray().every(Number.isFinite)).toBe(true);
 });
 it('respects the actual angular budget when real bone decomposition has minute unit-length drift',()=>{
  const axis=new Vector3(.4,.8,-.2).normalize(),q=new Quaternion().setFromAxisAngle(axis,.9),target=new Quaternion().setFromAxisAngle(axis,1.8);
  q.set(q.x*1.0000001,q.y*1.0000001,q.z*1.0000001,q.w*1.0000001);
  target.set(target.x*.9999999,target.y*.9999999,target.z*.9999999,target.w*.9999999);
  const before=q.clone().normalize(),snapshot=target.toArray();advanceDribbleHandRotation(q,target,1/240);
  expect(q.angleTo(before)).toBeLessThanOrEqual(10/240+1e-7);expect(q.length()).toBeCloseTo(1,12);expect(target.toArray()).toEqual(snapshot);
 });
});

describe('released arms use a natural low elbow plane',()=>{
 for(const side of [-1,1])it(`keeps the ${side} elbow below the shoulder without moving the palm`,()=>{
  const root=new Group(),shoulder=new Bone(),elbow=new Bone(),wrist=new Bone();root.position.y=-.2;
  const a=new Vector3(side*.18,1.3,0),b=new Vector3(side*.35,1.15,-.20),c=new Vector3(side*.34,1.02,-.13);
  shoulder.position.copy(a).sub(root.position);elbow.position.copy(b).sub(a);wrist.position.copy(c).sub(b);
  root.add(shoulder);shoulder.add(elbow);elbow.add(wrist);root.updateMatrixWorld(true);
  const pole=sampleDribbleElbowPole(new Vector3(),side,.5,true,0,a,0);
  new LimbIK().solve(shoulder,elbow,wrist,c,pole);
  expect(wrist.getWorldPosition(new Vector3()).distanceTo(c)).toBeLessThan(1e-8);
  const actual=elbow.getWorldPosition(new Vector3());expect(actual.y).toBeLessThan(a.y-.10);expect(actual.x*side).toBeGreaterThan(.20);
 });
 it('returns to the same shoulder-relative plane at each catch',()=>{
  const shoulder=new Vector3(.20,1.5,-3),first=sampleDribbleElbowPole(new Vector3(),1,0,true,0,shoulder,0);
  expect(sampleDribbleElbowPole(new Vector3(),1,1,true,0,shoulder,0).distanceTo(first)).toBeLessThan(1e-12);
  expect(first.y).toBeLessThan(shoulder.y-.5);
  for(let p=0;p<=1;p+=.001)expect(dribbleContact(p)).toBeGreaterThanOrEqual(0);
 });
});
