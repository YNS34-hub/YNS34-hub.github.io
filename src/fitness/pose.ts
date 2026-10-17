import {Quaternion,Vector3} from 'three';
import type {Exercise} from './exercises';
export function createFitnessPose(){return{position:new Vector3(),rotation:new Quaternion(),torso:0,leftWrist:new Vector3(),rightWrist:new Vector3(),leftFoot:new Vector3(),rightFoot:new Vector3(),leftElbow:new Vector3(),rightElbow:new Vector3(),leftKnee:new Vector3(),rightKnee:new Vector3(),palm:new Vector3(),bar:new Vector3(),equipment:'mat' as 'mat'|'dumbbells'|'bench'|'rack'};}
export type FitnessPose=ReturnType<typeof createFitnessPose>;
const axis=new Vector3(1,0,0),anchor=new Vector3(0,1.16,0),a=new Vector3(),b=new Vector3(),targetRotation=new Quaternion(),palmRotation=new Quaternion(),palmStep=new Quaternion();
export function sampleFitnessPose(out:FitnessPose,id:Exercise,phase:number):FitnessPose{
 const p=Number.isFinite(phase)?phase%1:0,s=.5-.5*Math.cos(2*Math.PI*p),squat=id==='squat'||id==='weighted-squat',floor=id==='push-up'||id==='plank',bench=id==='bench-press';
 out.position.set(0,0,0);out.rotation.identity();out.torso=0;out.palm.set(0,0,1);out.equipment='mat';
 if(squat){out.position.set(0,-.36*s,-.12*s);out.torso=.23*s;}
 if(floor){const shoulder=id==='plank'?.45:.57-.22*s,angle=Math.acos((shoulder-.13)/1.377);out.rotation.setFromAxisAngle(axis,angle);out.position.set(0,.13-.107*Math.cos(angle)-.02*Math.sin(angle),-.75-.107*Math.sin(angle)+.02*Math.cos(angle));out.palm.set(0,-1,0);}
 if(bench){out.rotation.setFromAxisAngle(axis,-Math.PI/2);out.position.set(0,.62,.75);out.equipment='bench';out.palm.set(0,-1,0);}
 if(id==='weighted-squat')out.equipment='rack';
 if(id==='curl'||id==='shoulder-press')out.equipment='dumbbells';
 for(const side of [-1,1]){
  // The source asset faces +Z: its anatomical left is positive world X.
  const sign=-side,wrist=side<0?out.leftWrist:out.rightWrist,foot=side<0?out.leftFoot:out.rightFoot,elbow=side<0?out.leftElbow:out.rightElbow,knee=side<0?out.leftKnee:out.rightKnee;
  wrist.set(sign*.30,.94,.22);foot.set(sign*(squat?.23:.13),.112,.02);elbow.set(sign*.38,1.12,.12);knee.set(sign*.23,.6,.5);
  if(id==='squat')wrist.set(sign*.20,1.12-.36*s,.29+.08*s);
  if(id==='weighted-squat'){wrist.set(sign*.45,1.45-.36*s,-.16);elbow.set(sign*.55,1.16-.36*s,-.24);out.bar.set(0,wrist.y,wrist.z);}
  if(id==='curl'){wrist.set(sign*.31,.91+.43*s,.10+.19*Math.sin(Math.PI*s/2));elbow.set(sign*.33,1.13,.09);out.palm.set(0,s,1-s).normalize();}
  if(id==='shoulder-press'){wrist.set(sign*(.35-.08*s),1.42+.56*s,.09-.04*s);elbow.set(sign*.56,1.42,.12);out.palm.set(0,0,1);}
  if(bench){wrist.set(sign*.43,.82+.31*s,-.68);elbow.set(sign*.62,.69,-.43);foot.set(sign*.28,.112,.40);knee.set(sign*.28,.6,.42);out.bar.set(0,wrist.y,wrist.z);}
  if(floor){wrist.set(sign*(id==='plank'?.19:.30),.08,id==='plank'?.70:.58);elbow.set(sign*(id==='plank'?.23:.42),id==='plank'?.09:.3,id==='plank'?.34:.3);foot.set(sign*.13,.14,-.75);knee.set(sign*.13,.24,-.25);}
 }
 return out;
}
export function copyFitnessPose(out:FitnessPose,source:FitnessPose):FitnessPose{out.position.copy(source.position);out.rotation.copy(source.rotation);out.torso=source.torso;out.equipment=source.equipment;for(const key of ['leftWrist','rightWrist','leftFoot','rightFoot','leftElbow','rightElbow','leftKnee','rightKnee','palm','bar'] as const)out[key].copy(source[key]);return out;}
/** Rotate around a body anchor during stand/lie changes, keeping limbs reachable. */
export function blendFitnessPose(out:FitnessPose,from:FitnessPose,t:number):FitnessPose{
 const u=Math.max(0,Math.min(1,t)),s=u*u*(3-2*u);
 a.copy(anchor).applyQuaternion(from.rotation).add(from.position);b.copy(anchor).applyQuaternion(out.rotation).add(out.position);
 targetRotation.copy(out.rotation);out.rotation.copy(from.rotation).slerp(targetRotation,s);
 // Position and rotation are blended together around the same torso anchor.
 return blendPoseFromTarget(out,from,s,a,b);
}
function blendPoseFromTarget(out:FitnessPose,from:FitnessPose,s:number,origin:Vector3,target:Vector3){
 out.position.copy(origin).lerp(target,s).sub(b.copy(anchor).applyQuaternion(out.rotation));
 out.torso=from.torso+(out.torso-from.torso)*s;
 for(const key of ['leftWrist','rightWrist','leftFoot','rightFoot','leftElbow','rightElbow','leftKnee','rightKnee','bar'] as const)out[key].lerp(from[key],1-s);
 palmRotation.setFromUnitVectors(from.palm,out.palm);palmStep.identity().slerp(palmRotation,s);out.palm.copy(from.palm).applyQuaternion(palmStep).normalize();return out;
}
