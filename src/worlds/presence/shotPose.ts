import type {ShotMotionPack} from '../court/motionPacks';
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function prepareShot(charge:number,options?:ShotMotionPack){
 const c=clamp(charge);
 if(!options){const lift=smooth(c/.56),air=clamp((c-.30)/.65);return{x:.23-lift*.10,y:1.07+lift*.96,z:-.40+lift*.13,jump:c<.30?-.105*Math.sin(Math.PI*c/.30):.30*Math.sin(Math.PI*air),pitch:-.12*(1-lift),guide:1-smooth((c-.65)/.25)*.25,verticalVelocity:0,stance:0};}
 const lift=smooth((c-options.liftStart)/(options.liftEnd-options.liftStart)),launch=Math.sqrt(2*9.81*options.jump),takeoff=.64-launch/9.81/options.chargeDuration,time=Math.max(0,(c-takeoff)*options.chargeDuration),flight=launch*2/9.81;
 // 身体在释放提示的高点附近达到顶点，离手后仍使用同一真实竖直速度，不能换成另一条弹跳曲线。
 const jump=c<takeoff?-options.crouch*Math.sin(Math.PI*clamp(c/takeoff)):time<flight?Math.max(0,launch*time-4.905*time*time):0;
 return{x:.23+(options.releaseX-.23)*lift,y:1.13+(options.releaseHeight-1.13)*lift,z:-.35+(options.releaseZ+.35)*lift,jump,
  stance:.08*(1-lift),pitch:options.torsoPitch*(1-lift),guide:1-smooth((c-options.guidePeel)/.20),verticalVelocity:c>=takeoff&&time<flight?launch-9.81*time:0};
}
export function shotRecovery(remaining:number,initialJump:number,options?:ShotMotionPack,initialVelocity=0){
 const time=Math.max(0,.65-remaining);
 if(!options){const down=smooth(time/.35);return{jump:Math.max(0,initialJump)*(1-down)-.065*Math.sin(Math.PI*clamp((time-.35)/.23)),reach:1-smooth((time-.17)/.48),guide:1-smooth(time/.12),wrist:smooth(time/.08)*(1-smooth((time-.38)/.27))};}
 const height=Math.max(0,initialJump),landing=(initialVelocity+Math.sqrt(initialVelocity*initialVelocity+19.62*height))/9.81;
 const jump=initialJump<0?initialJump*(1-smooth(time/.16)):time<landing?Math.max(0,height+initialVelocity*time-4.905*time*time):-.060*Math.sin(Math.PI*clamp((time-landing)/.18));
 return{jump,reach:1-smooth((time-.15)/.50),guide:1-smooth(time/.24),wrist:smooth(time*options.wristRate)*(1-smooth((time-.38)/.27))};
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
