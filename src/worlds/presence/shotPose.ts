import type {ShotMotionPack} from '../court/motionPacks';
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
/** 腰侧双手护球时辅助手掌位于球侧；举高后腕点才移到球心下方。 */
export const shotGuideWristDrop=(height:number)=>.035+.095*smooth(((Number.isFinite(height)?height:2.03)-1.15)/.55);
/** 蹬地末速与真实起跳相接；脚仍由固定的支撑点约束，不用另一个跳跃时钟。 */
function plantedDrive(time:number,takeoff:number,depth:number,velocity:number){
 const push=Math.min(.12,2.7*depth/Math.max(.001,velocity)),load=Math.max(.001,takeoff-push);
 if(time<=load)return-depth*smooth(time/load);
 const u=clamp((time-load)/Math.max(.001,push));
 return-depth*(2*u*u*u-3*u*u+1)+velocity*push*(u*u*u-u*u);
}
/** 落地先吸收同一竖直速度，随后抬回零点；位移和末速均连续。 */
function landingCompression(time:number,velocity:number,duration=.18){
 if(time<=0||time>=duration)return 0;
 const t=time,remaining=1-t/duration;
 return-Math.max(0,velocity)*t*remaining*remaining;
}
export function prepareShot(charge:number,options?:ShotMotionPack){
 const c=clamp(charge);
 if(!options){const lift=smooth(c/.56),air=clamp((c-.30)/.65);return{x:.23-lift*.10,y:1.07+lift*.96,z:-.40+lift*.13,jump:c<.30?-.105*Math.sin(Math.PI*c/.30):.30*Math.sin(Math.PI*air),pitch:-.12*(1-lift),guide:1-smooth((c-.65)/.25)*.25,verticalVelocity:0,stance:0,turn:0,roll:0};}
 const lift=smooth((c-options.liftStart)/(options.liftEnd-options.liftStart)),launch=Math.sqrt(2*9.81*options.jump),takeoff=.64-launch/9.81/options.chargeDuration,time=Math.max(0,(c-takeoff)*options.chargeDuration),flight=launch*2/9.81;
 // 身体在释放提示的高点附近达到顶点，离手后仍使用同一真实竖直速度，不能换成另一条弹跳曲线。
 const settle=Math.min(.18,Math.max(.01,(1-takeoff)*options.chargeDuration-flight));
 const jump=c<takeoff?plantedDrive(c*options.chargeDuration,takeoff*options.chargeDuration,options.crouch,launch):time<flight?Math.max(0,launch*time-4.905*time*time):landingCompression(time-flight,launch,settle);
 const load=smooth(c/.16),arc=Math.sin(Math.PI*lift)**2,dipPhase=Math.sin(Math.PI*clamp(c/.20))**2;
 return{x:.23+(options.releaseX-.23)*lift+.03*arc-.04*dipPhase,y:1.13+(options.releaseHeight-1.13)*lift-.065*dipPhase,z:-.35+(options.releaseZ+.35)*lift-.055*arc+.10*dipPhase,jump,
  stance:.08*(1-lift),pitch:options.torsoPitch*(1-lift)*load,turn:(.10*(1-lift)+.035*lift)*load,roll:.025*arc*load,guide:1-smooth((c-options.guidePeel)/.20),verticalVelocity:c>=takeoff&&time<flight?launch-9.81*time:0};
}
export function shotRecovery(remaining:number,initialJump:number,options?:ShotMotionPack,initialVelocity=0,initialGuide=1){
 const time=Math.max(0,.65-remaining);
 if(!options){const down=smooth(time/.35);return{jump:Math.max(0,initialJump)*(1-down)-.065*Math.sin(Math.PI*clamp((time-.35)/.23)),reach:1-smooth((time-.17)/.48),guide:1-smooth(time/.12),wrist:smooth(time/.08)*(1-smooth((time-.38)/.27))};}
 const height=Math.max(0,initialJump),landing=(initialVelocity+Math.sqrt(initialVelocity*initialVelocity+19.62*height))/9.81;
 const impact=Math.sqrt(initialVelocity*initialVelocity+19.62*height);
 const jump=initialJump<0?initialJump*(1-smooth(time/.16)):time<landing?Math.max(0,height+initialVelocity*time-4.905*time*time):landingCompression(time-landing,impact);
 return{jump,reach:1-smooth((time-.15)/.50),guide:clamp(initialGuide)*(1-smooth(time/.24)),wrist:smooth(time*options.wristRate)*(1-smooth((time-.38)/.27))};
}

type ShotWorldPoint = { x: number; y: number; z: number };
const finiteCoordinate = (value: number) => Number.isFinite(value) ? value : 0;

/**
 * Moves the released hand's goal with the actor as the jump and stance settle.
 * Body positions exclude the visual jump/stance offsets. Only the supplied output
 * is written; release snapshots remain unchanged and no point is allocated.
 * The output must be distinct from the read-only release and body inputs.
 */
export function shotFollowThroughTarget<Point extends ShotWorldPoint>(
  out: Point,
  releaseHand: Readonly<ShotWorldPoint>,
  releaseBody: Readonly<ShotWorldPoint>,
  body: Readonly<ShotWorldPoint>,
  releasedJump: number,
  currentJump: number,
  releasedStance: number,
  currentStance: number,
): Point {
  const releaseX = finiteCoordinate(releaseHand.x), releaseY = finiteCoordinate(releaseHand.y), releaseZ = finiteCoordinate(releaseHand.z);
  const x = releaseX + (finiteCoordinate(body.x) - finiteCoordinate(releaseBody.x));
  const y = releaseY + (finiteCoordinate(body.y) - finiteCoordinate(releaseBody.y))
    + (finiteCoordinate(currentJump) - finiteCoordinate(releasedJump))
    + (finiteCoordinate(releasedStance) - finiteCoordinate(currentStance));
  const z = releaseZ + (finiteCoordinate(body.z) - finiteCoordinate(releaseBody.z));
  out.x = Number.isFinite(x) ? x : releaseX;
  out.y = Number.isFinite(y) ? y : releaseY;
  out.z = Number.isFinite(z) ? z : releaseZ;
  return out;
}

/** Release from the actual guide wrist, including a hand already peeled on a late hold.
 * out is distinct from all read-only input points; no snapshots are changed or allocated. */
export function shotGuideTarget<Point extends ShotWorldPoint>(
  out:Point, releaseWrist:Readonly<ShotWorldPoint>, releaseBody:Readonly<ShotWorldPoint>, body:Readonly<ShotWorldPoint>,
  releasedJump:number,currentJump:number,releasedStance:number,currentStance:number,
  restWrist:Readonly<ShotWorldPoint>,remaining:number,
):Point{
  shotFollowThroughTarget(out,releaseWrist,releaseBody,body,releasedJump,currentJump,releasedStance,currentStance);
  const fade=smooth((.65-finiteCoordinate(remaining))/.24);
  out.x+=(finiteCoordinate(restWrist.x)-out.x)*fade;
  out.y+=(finiteCoordinate(restWrist.y)-out.y)*fade;
  out.z+=(finiteCoordinate(restWrist.z)-out.z)*fade;
  return out;
}
