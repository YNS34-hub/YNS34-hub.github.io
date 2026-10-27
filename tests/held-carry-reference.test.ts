import {describe,expect,it} from 'vitest';
import {Group,Vector3} from 'three';
import {heldCarryReference} from '../src/worlds/presence/heldBallPose';

describe('the carry reference follows court facing while the stepping hips turn',()=>{
 for(const facing of[-1.4,0,.9])it(`keeps the neutral chest reference fixed at facing${facing}`,()=>{
  const rest=new Vector3(.03,1.52,.05),body=new Vector3(1,-.08,2),expected=rest.clone().applyAxisAngle(new Vector3(0,1,0),facing).add(body);
  for(const hip of[-2,-.4,.7,2.1]){
   const root=new Group();root.position.copy(body);root.rotation.y=hip;root.updateWorldMatrix(true,true);
   const actual=root.localToWorld(heldCarryReference(new Vector3(),rest,facing-hip));
   expect(actual.distanceTo(expected),`hip=${hip}`).toBeLessThan(1e-10);
  }
 });
 it('accepts an aliased reference without feeding its transformed X into Z',()=>{
  const rest=new Vector3(.03,1.52,.05),expected=heldCarryReference(new Vector3(),rest,1.3);
  expect(heldCarryReference(rest,rest,1.3)).toBe(rest);expect(rest.distanceTo(expected)).toBeLessThan(1e-12);
 });
});
