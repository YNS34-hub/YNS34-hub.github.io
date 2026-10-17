import {describe,it,expect,vi} from 'vitest';
import {Matrix4,Object3D,Vector3,Vector4,type WebGLRenderer} from 'three';
import {captureLakeReflection,lakeWorldProjection,lakeReflectionTier} from '../src/worlds/road/lakeReflection';
import {ReflectionBudget} from '../src/rooms/atrium/budget';
import {shoreUphill} from '../src/worlds/road/shoreDirection';
import {terrainSkirtHeight,terrainSkirtWeight} from '../src/worlds/road/terrainTransition';

describe('lake reflection projection and renderer lifetime',()=>{
 it('projects real world water points through a translated rotated mirror without modifying matrices',()=>{
  const world=new Matrix4().makeRotationX(-Math.PI/2).setPosition(93,12.08,-280),projection=new Matrix4().makePerspective(-.4,.4,.3,-.3,.1,2000),view=new Matrix4().makeTranslation(-10,-20,25),bias=new Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const texture=bias.clone().multiply(projection).multiply(view).multiply(world),before=[world.toArray(),texture.toArray()],out=new Matrix4();
  lakeWorldProjection(out,texture,world);
  for(const point of [new Vector3(93,12.08,-280),new Vector3(193,12.08,-430)]){
   const actual=new Vector4(...point.toArray(),1).applyMatrix4(out),expected=new Vector4(...point.toArray(),1).applyMatrix4(world.clone().invert()).applyMatrix4(texture);
   expect(actual.toArray()).toEqual(expect.arrayContaining(expected.toArray().map(n=>expect.closeTo(n,9))));
  }
  expect([world.toArray(),texture.toArray()]).toEqual(before);
 });
 for(const throws of [false,true])it(`restores original render target, viewport, scissor, XR and shadows after ${throws?'a failed':'a successful'} capture`,()=>{
  const originalTarget={},viewport=new Vector4(4,8,1024,600),scissor=new Vector4(2,3,90,100),water=new Object3D(),mirror=new Object3D();
  const r={xr:{enabled:true},shadowMap:{autoUpdate:true},getRenderTarget:()=>originalTarget,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,getViewport:(v:Vector4)=>v.copy(viewport),getScissor:(v:Vector4)=>v.copy(scissor),getScissorTest:()=>true,setRenderTarget:vi.fn(),setViewport:vi.fn(),setScissor:vi.fn(),setScissorTest:vi.fn()};
  const capture=()=>captureLakeReflection(r as unknown as WebGLRenderer,water,mirror,()=>{expect(water.visible).toBe(false);r.xr.enabled=false;r.shadowMap.autoUpdate=false;mirror.visible=true;if(throws)throw Error('asset load');});
  if(throws)expect(capture).toThrow('asset load');else capture();
  expect(water.visible).toBe(true);expect(mirror.visible).toBe(false);expect(r.xr.enabled&&r.shadowMap.autoUpdate).toBe(true);
  expect(r.setRenderTarget).toHaveBeenLastCalledWith(originalTarget,2,1);expect(r.setViewport).toHaveBeenLastCalledWith(viewport);expect(r.setScissor).toHaveBeenLastCalledWith(scissor);expect(r.setScissorTest).toHaveBeenLastCalledWith(true);
 });
 it('caps resolution, skips low quality and stops quiet stationary captures after settling',()=>{
  expect(lakeReflectionTier('low')).toBeNull();expect(lakeReflectionTier('medium')).toEqual({size:512,hz:4});expect(lakeReflectionTier('high')).toEqual({size:768,hz:6});
  const camera=new Object3D(),budget=new ReflectionBudget(4);let count=0;
  for(let i=0;i<120;i++)count+=Number(budget.take(i/60,camera.position,camera.quaternion,false,true));expect(count).toBe(2);
  camera.position.x=1;expect(budget.take(2,camera.position,camera.quaternion,false,true)).toBe(true);
  budget.invalidate();expect(budget.take(2.1,camera.position,camera.quaternion,false,true)).toBe(false);expect(budget.take(2.3,camera.position,camera.quaternion,false,false)).toBe(false);expect(budget.take(2.3,camera.position,camera.quaternion,false,true)).toBe(true);
 });
});
describe('real contour shore and terrain boundary',()=>{
 it('places a shore patch uphill even when the ellipse points into the water',()=>{
  const ground=(x:number,z:number)=>12.08-.3*x+.1*z,[x,z]=shoreUphill(0,0,ground,1,0);
  expect(x).toBeLessThan(0);expect(ground(x*3,z*3)).toBeGreaterThan(12.08);expect(Math.hypot(x,z)).toBeCloseTo(1,12);
 });
 it('keeps the walkable strip exact and meets the real far mesh with a zero-slope transition weight',()=>{
  for(const sign of [-1,1]){
   expect(terrainSkirtHeight(24,18,sign*65)).toBe(24);expect(terrainSkirtHeight(24,18,sign*85)).toBe(18);
   expect(terrainSkirtWeight(sign*75)).toBe(.5);
   expect(Math.abs(terrainSkirtHeight(24,18,sign*65.001)-24)).toBeLessThan(1e-6);expect(Math.abs(terrainSkirtHeight(24,18,sign*84.999)-18)).toBeLessThan(1e-6);
  }
 });
});
