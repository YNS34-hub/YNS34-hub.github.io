import type {Quaternion} from 'three';

type Axis=Readonly<{x:number;y:number;z:number}>;
const clamp=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
const validRotation=(q:Readonly<Quaternion>)=>q!=null&&Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z)&&Number.isFinite(q.w)
 &&Math.abs(q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w-1)<.001;

/**
 * The post-release palm is a frozen real world rotation with explicit wrist flex.
 * Its recovery uses the same tail as shotRecovery.reach. No direction is inferred
 * from the solved wrist-to-goal distance, which can be floating-point zero.
 * All inputs remain unchanged; out must be distinct from the release/rest snapshots.
 */
export function sampleShotHandRotation(
 out:Quaternion,releaseQ:Readonly<Quaternion>,animatedRestQ:Readonly<Quaternion>,worldWristAxis:Axis,remaining:number,wristFlex:number,
):Quaternion{
 if(!validRotation(releaseQ)||!validRotation(animatedRestQ)||!Number.isFinite(remaining)||worldWristAxis==null)return out;
 const axisLength=Math.hypot(worldWristAxis.x,worldWristAxis.y,worldWristAxis.z);
 if(!Number.isFinite(axisLength)||axisLength<1e-12)return out;
 const recovery=smooth((.65-remaining-.15)/.50);
 if(recovery===1)return out.copy(animatedRestQ);
 out.copy(releaseQ);
 const halfAngle=-.21*clamp(wristFlex),sine=Math.sin(halfAngle)/axisLength;
 const x=worldWristAxis.x*sine,y=worldWristAxis.y*sine,z=worldWristAxis.z*sine,w=Math.cos(halfAngle);
 const qx=out.x,qy=out.y,qz=out.z,qw=out.w;
 // World-axis premultiplication, using scalars rather than a per-frame scratch quaternion.
 out.set(w*qx+x*qw+y*qz-z*qy,w*qy+y*qw+z*qx-x*qz,w*qz+z*qw+x*qy-y*qx,w*qw-x*qx-y*qy-z*qz);
 return recovery===0?out:out.slerp(animatedRestQ,recovery);
}

/** Limit this frame from the previous actual world wrist, including release and tail boundaries. */
export function advanceShotHandRotation(out:Quaternion,target:Readonly<Quaternion>,dt:number):Quaternion{
 if(!Number.isFinite(dt)||dt<=0||!validRotation(target))return out;
 return out.rotateTowards(target,10*Math.min(.06,dt));
}
