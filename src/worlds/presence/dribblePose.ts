import type {DribbleMotionPack} from '../court/motionPacks';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
type DribbleOptions=Partial<DribbleMotionPack>&{initialHeight?:number};
type DribblePose={ball:{x:number;y:number;z:number};palm:{x:number;y:number;z:number};push:number;torso:number};
// 下落和回弹分别按重力解算；换包的第一弹保留原高度。
export function dribblePose(phase:number,speed:number,side=1,result:DribblePose={ball:{x:0,y:0,z:0},palm:{x:0,y:0,z:0},push:0,torso:0},period=.65,options:DribbleOptions={}){
 const p=clamp(phase),running=clamp(speed/6.2),height=(options.height??.95)-running*(options.height===undefined?.14:.08);
 const initial=options.initialHeight??height,duration=Math.max(.25,Math.min(1.2,Number.isFinite(period)?period:.65)),down=duration*.44,up=duration*.56;
 const time=(p<=.44?p:p-.44)*duration,velocity=p<=.44?(-initial+9.81*down*down/2)/down:(height+9.81*up*up/2)/up;
 const y=(p<=.44?.12+initial:.12)+velocity*time-9.81*time*time/2,lead=Math.sin(Math.PI*p)**2*.06*running;
 const x=side*((options.spread??.31)+running*.045),z=-(options.front??.40)-running*.10-lead;
 const palmFloor=options.height===undefined?Math.max(.85,height-.03):.98-Math.max(0,.95-options.height)*.30;
 const palmY=Math.max(y+.075,Math.min(palmFloor+.025*Math.cos(2*Math.PI*p),.12+height+.075));
 const palmZ=z+(options.height===undefined?0:(running*.10+.045)*Math.sin(Math.PI*p)**2);
 Object.assign(result.ball,{x,y,z});Object.assign(result.palm,{x,y:palmY,z:palmZ});result.push=clamp(1-p/.23);result.torso=(options.torso??-.08)-running*.09;return result;
}
