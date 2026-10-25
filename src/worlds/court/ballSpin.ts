import {Quaternion,Vector3} from 'three';
import {BALL_RADIUS,type BallPhysics,type Vec} from '../basketballPhysics';
import type {FinishKind} from './finishing';

/** Owns only the visible ball's orientation. Linear physics and scoring remain authoritative. */
export class BallVisualSpin {
 readonly orientation=new Quaternion();
 readonly angularVelocity=new Vector3();
 private readonly axis=new Vector3();
 private readonly delta=new Quaternion();
 private readonly rolling=new Vector3();

 launch(velocity:Readonly<Vec>,kind:FinishKind|'shot'='shot'){
  const length=Math.hypot(velocity.x,velocity.z),rate=Math.PI*(kind==='shot'?4:kind==='layup'?3:1.2);
  // 回旋轴随出手方向转动；两端篮筐和左右手都不会反成前旋。
  this.angularVelocity.set(length>1e-6?-velocity.z/length:1,0,length>1e-6?velocity.x/length:0).multiplyScalar(rate);
 }

 step(rawDelta:number,mode:BallPhysics['mode'],position:Readonly<Vec>,velocity:Readonly<Vec>){
  const dt=Number.isFinite(rawDelta)?Math.min(.06,Math.max(0,rawDelta)):0;if(dt===0)return;
  if(mode!=='flight'){this.angularVelocity.set(0,0,0);return;}
  if(position.y<=BALL_RADIUS+.004&&Math.abs(velocity.y)<.8){
   this.rolling.set(velocity.z/BALL_RADIUS,0,-velocity.x/BALL_RADIUS);
   this.angularVelocity.lerp(this.rolling,1-Math.exp(-dt*12));
  }
  const speed=this.angularVelocity.length();if(speed<1e-6)return;
  this.axis.copy(this.angularVelocity).multiplyScalar(1/speed);
  this.delta.setFromAxisAngle(this.axis,speed*dt);this.orientation.premultiply(this.delta).normalize();
 }
}
