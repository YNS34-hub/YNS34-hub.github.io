import {dribblePose} from './dribblePose';
import {motionPacks,type MotionPackSelection} from '../court/motionPacks';
type Vec={x:number;y:number;z:number};
export type CoordinatedDribble={ball:Vec;leftPalm:Vec;rightPalm:Vec;phase:number;hand:number;torso:number;twist:number;crossover:number;crouch:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export class DribbleMotion{
 hand:number;private requested:number;private time=0;private period:number;
 private style:MotionPackSelection['dribble'];private initialHeight:number|undefined;
 private seed:Vec|null=null;private palmSeeds:{left:Vec;right:Vec}|null=null;private stanceSeed:number|undefined;
 private crossing=false;private target:number;private startPhase=0;
 private readonly scratch=dribblePose(0,0);
 private readonly result:CoordinatedDribble={ball:{x:0,y:0,z:0},leftPalm:{x:0,y:0,z:0},rightPalm:{x:0,y:0,z:0},phase:0,hand:1,torso:0,twist:0,crossover:0,crouch:0};
 constructor(hand=1,style:MotionPackSelection['dribble']='balanced'){this.hand=hand<0?-1:1;this.requested=this.target=this.hand;this.style=style;this.period=motionPacks.dribble[style].period;}
 seedHeight(height:number){if(Number.isFinite(height)&&height>.1)this.initialHeight=height;}
 seedPosition(p:Vec,stance=.08){if(Object.values(p).every(Number.isFinite)&&p.y>=.12){this.seed={...p};this.initialHeight=p.y-.12;this.stanceSeed=Number.isFinite(stance)?Math.max(0,Math.min(.36,stance)):.08;}}
 requestHand(hand:number){this.requested=hand<0?-1:1;const phase=this.time/this.period;if(!this.crossing&&this.requested!==this.hand&&phase<=.72){this.crossing=true;this.target=this.requested;this.startPhase=phase;}}
 advance(raw:number,speed=0,style=this.style,turbo=false,paused=false){
  if(paused)return this.sample(speed);
  const dt=Math.min(.06,Math.max(0,Number.isFinite(raw)?raw:0));this.time+=dt;
  if(this.time>=this.period){
   const remainder=this.time-this.period;this.time=this.period;const end=this.sample(speed);
   const catchBall={...end.ball},palms={left:{...end.leftPalm},right:{...end.rightPalm}},stance=end.crouch;
   if(this.crossing)this.hand=this.target;
   this.crossing=false;this.target=this.hand;this.startPhase=0;this.initialHeight=undefined;this.seed=null;this.palmSeeds=null;this.stanceSeed=undefined;
   if(style!==this.style){this.seed=catchBall;this.palmSeeds=palms;this.initialHeight=catchBall.y-.12;this.stanceSeed=stance;}
   this.style=style;this.period=turbo?motionPacks.dribble[style].sprintPeriod:motionPacks.dribble[style].period;this.time=remainder;
   this.requestHand(this.requested);
  }
  return this.sample(speed);
 }
 sample(speed=0){
  const p=this.time/this.period,style=motionPacks.dribble[this.style],entry=ease(p/.35);
  const transfer=this.crossing?ease((p-this.startPhase)/Math.max(.01,1-this.startPhase)):0,side=this.hand+(this.target-this.hand)*transfer;
  const pose=dribblePose(p,speed,side,this.scratch,this.period,{...style,initialHeight:this.initialHeight}),r=this.result;
  Object.assign(r.ball,pose.ball);
  if(this.seed){r.ball.x=this.seed.x+(r.ball.x-this.seed.x)*entry;r.ball.z=this.seed.z+(r.ball.z-this.seed.z)*entry;}
  for(const sign of [-1,1]){const weight=(this.hand===sign?1:0)*(1-transfer)+(this.target===sign?1:0)*transfer;
   const palm=sign<0?r.leftPalm:r.rightPalm,rest={x:sign*.34,y:Math.max(1.02,style.height-.015),z:-.29};
   palm.x=rest.x+(r.ball.x-rest.x)*weight;palm.y=rest.y+(pose.palm.y-rest.y)*weight;palm.z=rest.z+(r.ball.z+pose.palm.z-pose.ball.z-rest.z)*weight;
   if(this.palmSeeds){const seed=sign<0?this.palmSeeds.left:this.palmSeeds.right;palm.x=seed.x+(palm.x-seed.x)*entry;palm.y=seed.y+(palm.y-seed.y)*entry;palm.z=seed.z+(palm.z-seed.z)*entry;}
  }
  const crouch=Math.min(.36,.12+Math.max(0,.95-style.height)*.72+clamp(speed/6.2)*.16);
  r.phase=p;r.hand=this.hand;r.torso=pose.torso;r.twist=this.hand*style.twist*(1-transfer*2)*Math.sin(Math.PI*p);r.crossover=this.crossing?Math.sin(Math.PI*transfer):0;r.crouch=this.stanceSeed===undefined?crouch:this.stanceSeed+(crouch-this.stanceSeed)*entry;return r;
 }
}
