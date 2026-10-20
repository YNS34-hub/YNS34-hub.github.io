import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {followPose} from '../src/worlds/presence/math';
function pose(detail:boolean,pitch=0,riding=false){const eye=new Vector3(0,1.65,0),direction=new Vector3(0,Math.sin(pitch),-Math.cos(pitch)),position=new Vector3(),target=new Vector3();followPose(eye,direction,'third',riding,position,target,detail);return{eye,direction,position,target};}
describe('basketball action framing',()=>{
 it('offers a closer view without changing the logical body or direction',()=>{const wide=pose(false),near=pose(true);expect(near.position.distanceTo(near.eye)).toBeLessThan(wide.position.distanceTo(wide.eye)*.85);expect(near.eye.toArray()).toEqual(wide.eye.toArray());expect(near.direction.toArray()).toEqual(wide.direction.toArray());expect(wide.position.z).toBe(4.2);});
 it('keeps grounded feet and the head in view at ordinary shooting pitch',()=>{for(const pitch of[0,.16]){const p=pose(true,pitch),camera=new PerspectiveCamera(60,16/9,.12,200);camera.position.copy(p.position);camera.lookAt(p.target);camera.updateMatrixWorld(true);for(const y of[0,1.82])expect(Math.abs(new Vector3(0,y,0).project(camera).y)).toBeLessThan(1);}});
 it('preserves the original cycling framing even with the optional detail flag',()=>{const a=pose(false,.16,true),b=pose(true,.16,true);expect(a.position.toArray()).toEqual(b.position.toArray());expect(a.target.toArray()).toEqual(b.target.toArray());});
 it('preserves the exact first-person eye and never writes its input vectors',()=>{const eye=new Vector3(2,1.65,3),direction=new Vector3(.2,.1,-1).normalize(),before=eye.toArray(),heading=direction.toArray(),position=new Vector3(),target=new Vector3();followPose(eye,direction,'first',false,position,target,true);expect(position.toArray()).toEqual(before);expect(eye.toArray()).toEqual(before);expect(direction.toArray()).toEqual(heading);});
});
