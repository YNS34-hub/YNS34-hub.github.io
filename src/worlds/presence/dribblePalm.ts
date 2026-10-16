import {Quaternion} from 'three';
const normalizedTarget=new Quaternion();
type Point={x:number;y:number;z:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function dribbleContact(phase:number):number{
 const p=clamp(phase);return ease(1-p/.18)+ease((p-.78)/.22);
}
/** The released hand relaxes with the elbow below and behind its shoulder. */
export function sampleDribbleElbowPole<T extends Point>(out:T,side:number,phase:number,creative:boolean):T{
 const free=creative?1-dribbleContact(phase):0;
 out.x=(side<0?-1:1)*.48;out.y=1.04-.26*free;out.z=-.28+.42*free;return out;
}
/** Participation belongs to each palm, independent of the catch's hand commit. */
export function sampleDribblePalmNormal(out:Point,side:number,phase:number,participation:number):Point{
 const p=clamp(phase),weight=clamp(participation),sign=side<0?-1:1;
 const contact=Math.max(0,1-Math.min(p,1-p)/.18);
 out.x=sign*.55*(1-weight)-sign*.12*(1-contact)*weight;
 out.y=-contact*.65*(1-weight)-weight;
 out.z=-.55*(1-weight);
 const length=Math.hypot(out.x,out.y,out.z)||1;
 out.x/=length;out.y/=length;out.z/=length;return out;
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
