import type {Quaternion} from 'three';

type Point=Readonly<{x:number;y:number;z:number}>;
const clampInfluence=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const validPoint=(point:Point)=>point!=null&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z);
const validRotation=(q:Readonly<Quaternion>)=>q!=null&&validPoint(q)&&Number.isFinite(q.w)
 &&Math.abs(q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w-1)<.001;

/** Blend the current animated wrist/elbow into contact without allocating or easing twice. */
export function blendDribbleArmTarget<T extends {x:number;y:number;z:number}>(out:T,animated:Point,contact:Point,influence:number):T{
 const t=clampInfluence(influence);
 if((t<1&&!validPoint(animated))||(t>0&&!validPoint(contact)))return out;
 if(t===0){out.x=animated.x;out.y=animated.y;out.z=animated.z;}
 else if(t===1){out.x=contact.x;out.y=contact.y;out.z=contact.z;}
 else{out.x=animated.x+(contact.x-animated.x)*t;out.y=animated.y+(contact.y-animated.y)*t;out.z=animated.z+(contact.z-animated.z)*t;}
 return out;
}

/** Snapshots remain unchanged; out is the caller's distinct, reusable world rotation. */
export function blendDribbleArmRotation(out:Quaternion,animatedQ:Readonly<Quaternion>,contactQ:Readonly<Quaternion>,influence:number):Quaternion{
 const t=clampInfluence(influence);
 if((t<1&&!validRotation(animatedQ))||(t>0&&!validRotation(contactQ)))return out;
 if(t===0)return out.copy(animatedQ);
 if(t===1)return out.copy(contactQ);
 return out.copy(animatedQ).slerp(contactQ,t);
}
