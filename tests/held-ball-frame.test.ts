import {describe,expect,it} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {heldElbowPole} from '../src/worlds/presence/heldBallPose';
import {LimbIK} from '../src/worlds/presence/ik';
import {motionPacks} from '../src/worlds/court/motionPacks';
import {loadAthleteMotion} from './fixtures/athleteMotion';

// The actual shoulder line includes the walk/run clip's chest rotation.
// A pelvis or camera axis alone incorrectly flares the carrying arm during a turn.
describe('natural two-hand carry uses the real upper-body frame',()=>{
 for(const [id,pack] of Object.entries(motionPacks.hands))
  for(const hand of [-1,1])
   for(const clip of ['idle','walk','run'])
    it(`${id}/${hand}/${clip} lowers both elbows and retains ball contact at each heading`,()=>{
     for(const facing of [-1.8,0,1.4]){
      const rig=loadAthleteMotion(),ik=new LimbIK();
      rig.actions.forEach(a=>a.setEffectiveWeight(Number(a.getClip().name===clip)));
      rig.mixer.setTime(.31);rig.root.rotation.y=facing;
      rig.root.position.y=-.08;rig.model.rotation.y=Math.PI;
      rig.root.updateWorldMatrix(true,true);
      const ls=rig.bones.get('Bip01_L_UpperArm')!.getWorldPosition(new Vector3());
      const rs=rig.bones.get('Bip01_R_UpperArm')!.getWorldPosition(new Vector3());
      const armFacing=Math.atan2(ls.z-rs.z,rs.x-ls.x),right=rs.sub(ls).normalize();
      try{
       for(const side of [-1,1]){
        const prefix='Bip01_'+(side<0?'L':'R')+'_';
        const top=rig.bones.get(prefix+'UpperArm')!,middle=rig.bones.get(prefix+'Forearm')!,end=rig.bones.get(prefix+'Hand')!;
        const shoulder=top.getWorldPosition(new Vector3());
        const target=new Vector3(hand*pack.holdX,pack.holdY-.045,pack.holdZ)
         .applyAxisAngle(new Vector3(0,1,0),facing)
         .addScaledVector(new Vector3(Math.cos(armFacing),0,-Math.sin(armFacing)),side*pack.spread);
        const pole=heldElbowPole(new Vector3(),shoulder,target,right,side,shoulder.distanceTo(middle.getWorldPosition(new Vector3())),middle.getWorldPosition(new Vector3()).distanceTo(end.getWorldPosition(new Vector3())));
        const first=middle.getWorldPosition(new Vector3()).sub(shoulder);
        const second=end.getWorldPosition(new Vector3()).sub(middle.getWorldPosition(new Vector3()));
        const hinge=new Vector3().crossVectors(first,second).normalize()
         .applyQuaternion(top.getWorldQuaternion(new Quaternion()).invert());
        ik.solve(top,middle,end,target,pole,true);
        const elbow=middle.getWorldPosition(new Vector3()),upper=elbow.clone().sub(shoulder);
        const lower=end.getWorldPosition(new Vector3()).sub(elbow);
        expect(side*upper.dot(right),'elbow lateral offset from actual shoulder').toBeLessThan(.12);
        expect(-upper.y,'elbow drops below the shoulder').toBeGreaterThan(.20);
        expect(end.getWorldPosition(new Vector3()).distanceTo(target),'original wrist reach').toBeLessThan(.035);
        const anatomical=hinge.applyQuaternion(top.getWorldQuaternion(new Quaternion()));
        expect(new Vector3().crossVectors(upper,lower).normalize().dot(anatomical),'original bend plane').toBeGreaterThan(.995);
       }
      }finally{rig.dispose();}
     }
    });
 it('supports aliased shoulder and output vectors',()=>{
  const shoulder=new Vector3(.22,1.4,-3),wrist=new Vector3(.14,1.1,-3.29),right=new Vector3(1,0,0),expected=heldElbowPole(new Vector3(),shoulder,wrist,right,-1,.3,.285);
  expect(heldElbowPole(shoulder,shoulder,wrist,right,-1,.3,.285)).toBe(shoulder);
  expect(shoulder.distanceTo(expected)).toBeLessThan(1e-12);
 });
});
