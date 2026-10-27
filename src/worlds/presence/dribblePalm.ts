import {Matrix4,Quaternion,Vector3} from 'three';
import {dribbleRecoveryWindow} from './dribblePose';
const normalizedTarget=new Quaternion();
const palmNormal=new Vector3(),fingers=new Vector3(),width=new Vector3(),up=new Vector3(0,1,0),handMatrix=new Matrix4();
type Point={x:number;y:number;z:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function dribbleContact(phase:number):number{
 const p=clamp(phase);return ease(1-p/.18)+ease((p-.75)/.25);
}
/** The released hand relaxes with the elbow below and behind its shoulder. */
export function sampleDribbleElbowPole<T extends Point>(out:T,side:number,phase:number,creative:boolean,recovery:number,shoulder:Readonly<Point>,facing:number):T{
 const free=creative?1-dribbleContact(phase):0;
 const recover=creative?0:clamp(recovery);
 const sign=side<0?-1:1,{x,y,z}=shoulder,c=Math.cos(facing),s=Math.sin(facing);
 const lateral=sign*(.30-.03*recover),forward=-.12+.04*free+.04*recover;
 out.x=x+lateral*c+forward*s;out.y=y-.55-.08*free;out.z=z-lateral*s+forward*c;return out;
}
/** Participation belongs to each palm, independent of the catch's hand commit. */
export function sampleDribblePalmNormal<T extends Point>(out:T,side:number,phase:number,participation:number):T{
 const p=clamp(phase),weight=clamp(participation),sign=side<0?-1:1;
 const contact=Math.max(0,1-Math.min(p,1-p)/.18);
 out.x=sign*.55*(1-weight)-sign*.12*(1-contact)*weight;
 out.y=-contact*.65*(1-weight)-weight;
 out.z=-.55*(1-weight)+.55*dribbleRecoveryWindow(p)*weight;
 const length=Math.hypot(out.x,out.y,out.z)||1;
 out.x/=length;out.y/=length;out.z/=length;return out;
}

/** The production hand's palm pad is 5cm along +X and 3cm toward local +Y. */
export function dribbleWristTarget(out:Vector3,palm:Readonly<Vector3>,rotation:Readonly<Quaternion>):Vector3{
 return out.set(-.05,-.03,0).applyQuaternion(rotation).add(palm);
}
export function dribblePalmPoint(out:Vector3,wrist:Readonly<Vector3>,rotation:Readonly<Quaternion>):Vector3{
 return out.set(.05,.03,0).applyQuaternion(rotation).add(wrist);
}
/** Use the same world frame for the real palm pad and its wrist target. */
export function sampleDribbleHandRotation(out:Quaternion,side:number,phase:number,facing:number,aim:Readonly<Vector3>):Quaternion{
 sampleDribblePalmNormal(palmNormal,side,phase,1).applyAxisAngle(up,facing);
 fingers.copy(aim).addScaledVector(palmNormal,-aim.dot(palmNormal));
 if(fingers.lengthSq()<.01){
  const x=Math.abs(palmNormal.x),y=Math.abs(palmNormal.y),z=Math.abs(palmNormal.z);
  fingers.set(x<=y&&x<=z?1:0,y<x&&y<=z?1:0,z<x&&z<y?1:0);
 }
 fingers.normalize();width.crossVectors(fingers,palmNormal).normalize();palmNormal.crossVectors(width,fingers);
 return out.setFromRotationMatrix(handMatrix.makeBasis(fingers,palmNormal,width));
}

/** Follow the previous real wrist each frame, avoiding moving-target half-arc flips. */
export function advanceDribbleHandRotation(out:Quaternion,target:Readonly<Quaternion>,dt:number):Quaternion{
 if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(target.x)||!Number.isFinite(target.y)||!Number.isFinite(target.z)||!Number.isFinite(target.w))return out;
 if(target.x*target.x+target.y*target.y+target.z*target.z+target.w*target.w<1e-8)return out;
 // Matrix decomposition can leave minute scale roundoff. angleTo/rotateTowards
 // require unit rotations, especially when a freely swinging wrist nearly aligns.
 normalizedTarget.copy(target).normalize();out.normalize();
 return out.rotateTowards(normalizedTarget,10*Math.min(.06,dt));
}
