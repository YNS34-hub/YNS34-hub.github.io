export type CourtFingerContext=Readonly<{held:boolean;dribbling:boolean;shot:number;dribblePhase:number;dribbleLeftInfluence:number;dribbleRightInfluence:number}>;
export const createCourtFingerGrip=()=>({left:0,right:0,ready:false});
type FingerGrip=ReturnType<typeof createCourtFingerGrip>;

const clamp=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));

export function advanceCourtFingerGrip(state:FingerGrip,pose:CourtFingerContext,dt:number){
  let left=pose.shot>0?.05:0,right=left;
  if(pose.held){
    if(pose.dribbling){
      const t=clamp(1-Math.min(clamp(pose.dribblePhase),1-clamp(pose.dribblePhase))/.15);
      // The physical contact phase already owns the clock. Its smooth window
      // closes only participating fingers, leaving a free hand on its clip.
      const contact=.19*t*t*(3-2*t);
      left=contact*clamp(pose.dribbleLeftInfluence);right=contact*clamp(pose.dribbleRightInfluence);
    }else left=right=.30;
  }
  if(!state.ready){state.left=left;state.right=right;state.ready=true;}
  else if(Number.isFinite(dt)&&dt>0){
    const alpha=1-Math.exp(-26*Math.min(.06,dt));
    state.left+=(left-state.left)*alpha;state.right+=(right-state.right)*alpha;
  }
  return state;
}
