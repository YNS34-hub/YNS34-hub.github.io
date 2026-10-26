import {Quaternion} from 'three';
import {advanceShotHandRotation} from './shotHandRotation';

export const createCourtWristFrame=()=>({parent:new Quaternion(),delta:new Quaternion(),ready:false,free:false});
type WristFrame=ReturnType<typeof createCourtWristFrame>;

export function advanceCourtHandRotation(out:Quaternion,target:Quaternion,parent:Quaternion,frame:WristFrame,free:boolean,dt:number){
  // An empty wrist belongs to its forearm. Carry the previous local pose with
  // that forearm before limiting articulation; body yaw is not wrist flexion.
  if(free&&!frame.ready)out.copy(target);
  else{
    // IK can relinquish a very different forearm at release/finish exit. Keep
    // that boundary in world space, then carry only consecutive free frames.
    if(free&&frame.free){frame.delta.copy(frame.parent).invert().premultiply(parent);out.premultiply(frame.delta);}
    advanceShotHandRotation(out,target,dt);
  }
  frame.parent.copy(parent);frame.ready=true;frame.free=free;
  return out;
}
