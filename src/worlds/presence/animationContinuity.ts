import {Quaternion,Vector3,type AnimationAction,type AnimationMixer} from 'three';

export type AnimatedBonePose={position:Vector3;quaternion:Quaternion};
type ActionPose={time:number;weight:number;timeScale:number;paused:boolean;enabled:boolean};
export function createAnimationContinuity(){
 return {initialized:false,time:0,actions:new Map<string,ActionPose>(),bones:new Map<string,AnimatedBonePose>()};
}
export type AnimationContinuity=ReturnType<typeof createAnimationContinuity>;

/** Save the unconstrained clip pose, never the IK layer or owned render resources. */
export function captureAnimationContinuity(state:AnimationContinuity,mixer:AnimationMixer,actions:AnimationAction[],bones:ReadonlyMap<string,AnimatedBonePose>){
 state.time=mixer.time;
 for(const action of actions){
  const name=action.getClip().name;
  let saved=state.actions.get(name);if(!saved){saved={time:0,weight:0,timeScale:1,paused:false,enabled:true};state.actions.set(name,saved);}
  saved.time=action.time;saved.weight=action.weight;saved.timeScale=action.timeScale;saved.paused=action.paused;saved.enabled=action.enabled;
 }
 for(const [name,pose]of bones){
  let saved=state.bones.get(name);if(!saved){saved={position:new Vector3(),quaternion:new Quaternion()};state.bones.set(name,saved);}
  saved.position.copy(pose.position);saved.quaternion.copy(pose.quaternion);
 }
 state.initialized=true;
}

/** An outfit's fresh mixer resumes the same clip times, weights and local pose. */
export function restoreAnimationContinuity(state:AnimationContinuity,mixer:AnimationMixer,actions:AnimationAction[],bones:ReadonlyMap<string,AnimatedBonePose>){
 if(!state.initialized)return false;
 mixer.time=state.time;
 for(const action of actions){const saved=state.actions.get(action.getClip().name);if(saved){action.time=saved.time;action.setEffectiveWeight(saved.weight);action.setEffectiveTimeScale(saved.timeScale);action.paused=saved.paused;action.enabled=saved.enabled;}}
 for(const [name,pose]of bones){const saved=state.bones.get(name);if(saved){pose.position.copy(saved.position);pose.quaternion.copy(saved.quaternion);}}
 return true;
}
