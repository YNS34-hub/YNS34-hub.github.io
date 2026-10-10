import { Vector3 } from "three";
import { roadLength, roadSample } from "./route";

export type RidingState="stopped"|"mounting"|"starting"|"accelerating"|"cruising"|"coasting"|"climbing"|"braking"|"cornering"|"descending"|"scenic-stop"|"dismounting";
export const sprockets=[34,30,27,24,22,20,18,16,15,14,12,11];
export const wheelCircumference=2.14;
export interface RoadInput { pedal?:boolean; strong?:boolean; brake?:boolean; steer?:number; blocked?:boolean; effort?:number }
export class RoadPhysics {
  distance=0;speed=0;gear=7;cadence=0;grade=0;offset=0;steering=0;heading=0;lean=0;braking=0;
  state:RidingState="stopped"; stopAt:number|null=null; atStop=false; ended=false; recovered=false; lastSafe=0;
  private point=new Vector3();private tangent=new Vector3();private nextPoint=new Vector3();private nextTangent=new Vector3();
  // 默认值逐字沿用旧路线；新地图只注入采样器和终点，动力、档位与刹车规则保持共用。
  constructor(private geography:{length:number;sample:typeof roadSample}={length:roadLength,sample:roadSample}){}
  shift(direction:number){const before=this.gear;this.gear=Math.max(1,Math.min(12,this.gear+direction));return before!==this.gear;}
  step(delta:number,input:RoadInput,gradeOverride?:number) {
    const {length:roadLength,sample:roadSample}=this.geography;
    if(input.blocked)return;
    const dt=Math.max(0,Math.min(.06,Number.isFinite(delta)?delta:0));
    if(!Number.isFinite(this.distance)||!Number.isFinite(this.offset)||!Number.isFinite(this.speed)||Math.abs(this.offset)>8) {
      // 仅真正无效状态恢复最近安全点；正常偏离在路肩内渐进纠正，不传送访问者。
      this.distance=Math.min(roadLength,Math.max(0,this.lastSafe));this.offset=0;this.heading=0;this.speed=0;this.recovered=true;
    }
    roadSample(this.distance,this.point,this.tangent);
    this.grade=gradeOverride??this.tangent.y/Math.hypot(this.tangent.x,this.tangent.z);
    let brake=!!input.brake, pedal=!!input.pedal;
    const remaining=this.stopAt===null?Infinity:Math.max(0,this.stopAt-this.distance);
    if(remaining<this.speed*this.speed/4+2)brake=true;
    if(this.ended||this.atStop){pedal=false;brake=true;}
    this.braking+=(Number(brake)-this.braking)*(1-Math.exp(-dt*4.5));
    const ratio=48/sprockets[this.gear-1],wheelCadence=this.speed/wheelCircumference*60/ratio;
    // 起步的低踏频仍能施加踏板扭矩；不能用零轮速推断访问者没有做功。
    const efficiency=Math.max(.70,Math.exp(-Math.pow((wheelCadence-88)/68,2)));
    const power=(input.strong?430:285)*(input.effort??1);
    const traction=pedal&&!brake?Math.min(190/ratio,power*efficiency/Math.max(2.4,this.speed)):0;
    const resistance=86*9.81*.004+.5*1.2*.31*this.speed*this.speed;
    const acceleration=(traction-resistance)/86-9.81*this.grade-this.braking*3.3;
    // 55 km/h 是这段风景公路的上限。惯性与坡度决定速度，不向一个固定目标速度插值。
    this.speed=Math.max(0,Math.min(55/3.6,this.speed+acceleration*dt));
    if(this.speed<.035&&(!pedal||brake))this.speed=0;
    const authority=.17/(1+(this.speed/4.5)**2);
    const targetSteer=Math.max(-1,Math.min(1,input.steer??0))*authority;
    this.steering+=(targetSteer-this.steering)*(1-Math.exp(-dt*5));
    this.heading+=((this.speed/1.01)*Math.tan(this.steering)-this.heading*2.6-this.offset*.17)*dt;
    this.heading=Math.max(-.18,Math.min(.18,this.heading));
    this.offset+=Math.sin(this.heading)*this.speed*dt;
    if(Math.abs(this.offset)>1.85){this.heading-=Math.sign(this.offset)*(.03+Math.abs(this.offset)*.08)*dt;this.offset=Math.max(-2.24,Math.min(2.24,this.offset));}
    roadSample(Math.min(roadLength,this.distance+2),this.nextPoint,this.nextTangent);
    const yaw=Math.atan2(-this.tangent.x,-this.tangent.z),nextYaw=Math.atan2(-this.nextTangent.x,-this.nextTangent.z);
    const curvature=-Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw))/2;
    // 曲线本身也产生侧倾；头部只保留其中很小一部分，不能把转弯全部转嫁给镜头。
    this.lean+=(Math.atan(this.speed*this.speed*(curvature+this.steering/1.01)/9.81)*.42-this.lean)*(1-Math.exp(-dt*5));
    this.lean=Math.max(-.15,Math.min(.15,this.lean));
    this.distance=Math.min(roadLength,this.distance+this.speed*Math.cos(this.heading)*dt);
    if((remaining<4&&this.speed<.1)||this.distance>=roadLength){this.speed=0;this.stopAt=null;this.atStop=true;this.ended=this.distance>=roadLength;}
    this.cadence+=(pedal&&!brake?Math.min(108,Math.max(72,wheelCadence))-this.cadence:-this.cadence)*(1-Math.exp(-dt*3));
    this.state=this.atStop?"scenic-stop":this.speed===0?"stopped":brake?"braking":pedal&&this.grade>.025?"climbing":!pedal&&this.grade<-.02?"descending":Math.abs(this.steering)>.008?"cornering":!pedal?"coasting":this.speed<2.8?"starting":acceleration>.15?"accelerating":"cruising";
    this.lastSafe=this.distance;
  }
}
