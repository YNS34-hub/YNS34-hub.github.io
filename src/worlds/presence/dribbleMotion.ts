import {dribblePose} from './dribblePose';
import {dribbleContact} from './dribblePalm';
import {motionPacks,type MotionPackSelection} from '../court/motionPacks';
type Vec={x:number;y:number;z:number};
export type DribbleMove="crossover"|"between-legs"|"behind-back"|"hesitation";
export type CoordinatedDribble={ball:Vec;leftPalm:Vec;rightPalm:Vec;contactPalm:Vec;leftInfluence:number;rightInfluence:number;phase:number;hand:number;torso:number;twist:number;crossover:number;crouch:number;leftWeight:number;rightWeight:number;move:DribbleMove};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
/** Pass low between forward-facing knees; high approach/return stay in front. */
export function betweenLegsDepthOffset(phase:number):number{
 const p=clamp(Number.isFinite(phase)?phase:0),transfer=ease((p-.24)/.40),pass=Math.sin(Math.PI*transfer)**4;
 return .14*pass-.25*Math.sin(Math.PI*p)**2*(1-pass);
}
export class DribbleMotion{
 hand:number;private requested:number;private time=0;private period:number;
 private style:MotionPackSelection['dribble'];private initialHeight:number|undefined;
 private seed:Vec|null=null;private palmSeeds:{left:Vec;right:Vec}|null=null;private stanceSeed:number|undefined;
 private pendingMove:Exclude<DribbleMove,"crossover">|null=null;private activeMove:DribbleMove="crossover";
 private crossing=false;private target:number;private startPhase=0;
 private readonly scratch=dribblePose(0,0);
 private readonly result:CoordinatedDribble={ball:{x:0,y:0,z:0},leftPalm:{x:0,y:0,z:0},rightPalm:{x:0,y:0,z:0},contactPalm:{x:0,y:0,z:0},leftInfluence:0,rightInfluence:1,phase:0,hand:1,torso:0,twist:0,crossover:0,crouch:0,leftWeight:0,rightWeight:1,move:"crossover"};
 constructor(hand=1,style:MotionPackSelection['dribble']='balanced'){this.hand=hand<0?-1:1;this.requested=this.target=this.hand;this.style=style;this.period=motionPacks.dribble[style].period;}
 seedHeight(height:number){if(Number.isFinite(height)&&height>.1)this.initialHeight=height;}
 seedPosition(p:Vec,stance=.08){if(Object.values(p).every(Number.isFinite)&&p.y>=.12){this.seed={...p};this.initialHeight=p.y-.12;this.stanceSeed=Number.isFinite(stance)?Math.max(0,Math.min(.36,stance)):.08;}}
 requestMove(move:Exclude<DribbleMove,"crossover">){if(this.pendingMove||this.activeMove!=="crossover"||this.crossing)return false;this.pendingMove=move;return true;}
 requestHand(hand:number){if(this.activeMove!=="crossover")return;this.requested=hand<0?-1:1;const phase=this.time/this.period;if(!this.crossing&&this.requested!==this.hand&&phase<=.72){this.crossing=true;this.target=this.requested;this.startPhase=phase;}}
 advance(raw:number,speed=0,style=this.style,turbo=false,paused=false){
  if(paused)return this.sample(speed);
  const dt=Math.min(.06,Math.max(0,Number.isFinite(raw)?raw:0));this.time+=dt;
  if(this.time>=this.period){
   const remainder=this.time-this.period;this.time=this.period;const end=this.sample(speed);
   const catchBall={...end.ball},palms={left:{...end.leftPalm},right:{...end.rightPalm}},stance=end.crouch;
   const previousMove=this.activeMove;
   if(this.crossing)this.hand=this.target;
   this.activeMove=this.pendingMove??"crossover";this.pendingMove=null;
   if(previousMove!=="crossover")this.requested=this.hand;
   this.crossing=false;this.target=this.hand;this.startPhase=0;this.initialHeight=undefined;this.seed=null;this.palmSeeds=null;this.stanceSeed=undefined;
   if(style!==this.style||previousMove!==this.activeMove){this.seed=catchBall;this.palmSeeds=palms;this.initialHeight=catchBall.y-.12;this.stanceSeed=stance;}
   this.style=style;const basic=turbo?motionPacks.dribble[style].sprintPeriod:motionPacks.dribble[style].period;this.period=this.activeMove==="between-legs"?Math.max(1.10,basic):this.activeMove==="behind-back"?Math.max(.82,basic):basic*(this.activeMove==="hesitation"?1.35:1);this.time=remainder;
   if(this.activeMove==="between-legs"||this.activeMove==="behind-back"){this.crossing=true;this.target=-this.hand;this.requested=this.target;}else this.requestHand(this.requested);
  }
  return this.sample(speed);
 }
 sample(speed=0){
  const p=this.time/this.period,style=motionPacks.dribble[this.style],entry=ease(p/.35);
  // The physical bounce bottoms at .44. Thread the leg gap only near that
  // low point; high descending/rising segments stay beside the outside hand.
  const transfer=this.crossing?(this.activeMove==="between-legs"?ease((p-.24)/.40):this.activeMove==="behind-back"?ease((p-.30)/.42):ease((p-this.startPhase)/Math.max(.01,1-this.startPhase))):0,side=this.hand+(this.target-this.hand)*transfer;
  const pose=dribblePose(p,speed,side,this.scratch,this.period,{...style,initialHeight:this.initialHeight}),r=this.result;
  Object.assign(r.ball,pose.ball);
  // The route returns to the same catch plane at both ends. Free bounces travel
  // through the leg gap or behind the hip without a teleport or a second ball clock.
  if(this.activeMove==="between-legs")r.ball.z+=betweenLegsDepthOffset(p);
  else if(this.activeMove==="behind-back"){
   r.ball.z+=ease(p/.32)*(1-ease((p-.56)/.44));
   // Keep the high approach/return beside the thigh before crossing the rear gap.
   r.ball.x+=side*.25*Math.sin(Math.PI*clamp(p))**2;
  }
  else if(this.activeMove==="hesitation")r.ball.x+=side*.025*Math.sin(Math.PI*clamp(p))**2;
  if(this.seed){r.ball.x=this.seed.x+(r.ball.x-this.seed.x)*entry;r.ball.z=this.seed.z+(r.ball.z-this.seed.z)*entry;}
  // The renderer mixes this raw contact with its actual animated arm once.
  // Bone targets never feed back into the physical bounce or hand commit.
  r.contactPalm.x=r.ball.x;r.contactPalm.y=pose.palm.y;r.contactPalm.z=r.ball.z+pose.palm.z-pose.ball.z;
  if(this.palmSeeds){
   const seed=this.hand<0?this.palmSeeds.left:this.palmSeeds.right;
   r.contactPalm.x=seed.x+(r.contactPalm.x-seed.x)*entry;r.contactPalm.y=seed.y+(r.contactPalm.y-seed.y)*entry;r.contactPalm.z=seed.z+(r.contactPalm.z-seed.z)*entry;
  }
  for(const sign of [-1,1]){const weight=(this.hand===sign?1:0)*(1-transfer)+(this.target===sign?1:0)*transfer;
   if(sign<0)r.leftWeight=weight;else r.rightWeight=weight;
   const creative=this.activeMove==="between-legs"||this.activeMove==="behind-back";
   const contact=creative?dribbleContact(p):1;
   const reach=weight*contact;
   if(sign<0)r.leftInfluence=reach;else r.rightInfluence=reach;
   const palm=sign<0?r.leftPalm:r.rightPalm,rest={x:sign*.34,y:Math.max(1.02,style.height-.015),z:-.29+(this.activeMove==="behind-back"?.16*Math.sin(Math.PI*p)**2:0)};
   // Once the ball leaves the pushing hand, the arm follows through beside the
   // hip. The receiving hand reaches the real ball again on the catching phase.
   palm.x=rest.x+(r.ball.x-rest.x)*reach;palm.y=rest.y+(pose.palm.y-rest.y)*reach;palm.z=rest.z+(r.ball.z+pose.palm.z-pose.ball.z-rest.z)*reach;
   if(this.palmSeeds){const seed=sign<0?this.palmSeeds.left:this.palmSeeds.right;palm.x=seed.x+(palm.x-seed.x)*entry;palm.y=seed.y+(palm.y-seed.y)*entry;palm.z=seed.z+(palm.z-seed.z)*entry;}
  }
  const crouch=Math.min(.36,.12+Math.max(0,.95-style.height)*.72+clamp(speed/6.2)*.03);
  r.move=this.activeMove;r.phase=p;r.hand=this.hand;r.torso=pose.torso;r.twist=this.hand*style.twist*(1-transfer*2)*Math.sin(Math.PI*p);r.crossover=this.crossing?Math.sin(Math.PI*transfer):0;r.crouch=this.stanceSeed===undefined?crouch:this.stanceSeed+(crouch-this.stanceSeed)*entry;return r;
 }
}
