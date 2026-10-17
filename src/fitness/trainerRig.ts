import {Bone,Group,Matrix4,Quaternion,Vector3,type Object3D} from 'three';
import {LimbIK} from '../worlds/presence/ik';
import type {FitnessPose} from './pose';
export function createFitnessRig(model:Object3D){
 const container=new Group(),bones=new Map<string,Bone>();container.add(model);model.rotation.set(0,0,0);container.updateWorldMatrix(true,true);
 model.traverse(node=>{if(node instanceof Bone)bones.set(node.name,node);});
 const base=new Map([...bones].map(([name,bone])=>[name,{position:bone.position.clone(),rotation:bone.quaternion.clone()}]));
 const footRotation=new Map([-1,1].map(side=>[side,bones.get(`Bip01_${side<0?'L':'R'}_Foot`)!.getWorldQuaternion(new Quaternion())]));
 const hips=new Map([-1,1].map(side=>[side,new Vector3()]));
 return{model,container,bones,base,footRotation,hips,ik:new LimbIK(),target:new Vector3(),pole:new Vector3(),point:new Vector3(),normal:new Vector3(),finger:new Vector3(),cross:new Vector3(),axis:new Vector3(1,0,0),q:new Quaternion(),parent:new Quaternion(),matrix:new Matrix4(),metrics:{leftWrist:0,rightWrist:0,leftFoot:0,rightFoot:0}};
}
export type FitnessRig=ReturnType<typeof createFitnessRig>;
/** Apply independent joints; no basketball/riding clock or cached GLTF is mutated. */
export function applyFitnessRig(rig:FitnessRig,pose:FitnessPose,frame:Group){
 for(const [name,base]of rig.base){const bone=rig.bones.get(name)!;bone.position.copy(base.position);bone.quaternion.copy(base.rotation);}
 rig.container.position.copy(pose.position);rig.container.quaternion.copy(pose.rotation);frame.updateWorldMatrix(true,true);
 for(const side of [-1,1])rig.bones.get(`Bip01_${side<0?'L':'R'}_Thigh`)!.getWorldPosition(rig.hips.get(side)!);
 const spine=rig.bones.get('Bip01_Spine')!;
 if(pose.torso){rig.axis.set(1,0,0).transformDirection(frame.matrixWorld);spine.getWorldQuaternion(rig.q);rig.q.premultiply(rig.parent.setFromAxisAngle(rig.axis,pose.torso));spine.parent!.getWorldQuaternion(rig.parent);spine.quaternion.copy(rig.parent.invert().multiply(rig.q));spine.updateWorldMatrix(true,true);}
 for(const side of [-1,1]){
  const prefix=`Bip01_${side<0?'L':'R'}_`,hip=rig.bones.get(prefix+'Thigh')!;
  hip.position.copy(hip.parent!.worldToLocal(rig.target.copy(rig.hips.get(side)!)));hip.updateWorldMatrix(true,true);
  for(const kind of ['arm','leg'] as const){
   const top=rig.bones.get(prefix+(kind==='arm'?'UpperArm':'Thigh'))!,middle=rig.bones.get(prefix+(kind==='arm'?'Forearm':'Calf'))!,end=rig.bones.get(prefix+(kind==='arm'?'Hand':'Foot'))!;
   const goal=kind==='arm'?(side<0?pose.leftWrist:pose.rightWrist):(side<0?pose.leftFoot:pose.rightFoot),pole=kind==='arm'?(side<0?pose.leftElbow:pose.rightElbow):(side<0?pose.leftKnee:pose.rightKnee);
   frame.localToWorld(rig.target.copy(goal));frame.localToWorld(rig.pole.copy(pole));rig.ik.solve(top,middle,end,rig.target,rig.pole);
   const key=(side<0?'left':'right')+(kind==='arm'?'Wrist':'Foot') as keyof typeof rig.metrics;rig.metrics[key]=end.getWorldPosition(rig.point).distanceTo(rig.target);
   if(kind==='arm'){
    middle.getWorldPosition(rig.pole);rig.finger.subVectors(rig.point,rig.pole).normalize();rig.normal.copy(pose.palm).transformDirection(frame.matrixWorld);
    rig.finger.addScaledVector(rig.normal,-rig.finger.dot(rig.normal));if(rig.finger.lengthSq()<1e-5)rig.finger.set(0,0,1).transformDirection(frame.matrixWorld).addScaledVector(rig.normal,-rig.finger.dot(rig.normal));
    if(rig.finger.lengthSq()<1e-5)rig.finger.set(1,0,0);rig.finger.normalize();rig.cross.crossVectors(rig.finger,rig.normal).normalize();rig.normal.crossVectors(rig.cross,rig.finger).normalize();
    rig.matrix.makeBasis(rig.finger,rig.normal,rig.cross);rig.q.setFromRotationMatrix(rig.matrix);
   }else{
    frame.getWorldQuaternion(rig.q);if(pose.rotation.x>.3)rig.q.multiply(rig.parent.setFromAxisAngle(rig.axis.set(1,0,0),.7));rig.q.multiply(rig.footRotation.get(side)!);
   }
   end.parent!.getWorldQuaternion(rig.parent);end.quaternion.copy(rig.parent.invert().multiply(rig.q));end.updateWorldMatrix(true,true);
  }
  const grip=pose.equipment==='mat'?.04:.65;
  for(let finger=1;finger<=4;finger++)for(let joint=0;joint<=2;joint++){const bone=rig.bones.get(prefix+'Finger'+finger+(joint||''));if(bone)bone.quaternion.multiply(rig.q.setFromAxisAngle(rig.axis.set(0,0,1),grip*(joint===0?.4:joint===1?.75:.6)));}
 }
 return rig.metrics;
}
