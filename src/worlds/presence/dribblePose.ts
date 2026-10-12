const clamp=(v:number)=>Math.max(0,Math.min(1,v));
// 下落与回弹有不同飞行时间；掌心在放球后留在腰旁，不跟着自由球一路伸到地面。
// 相位由原持球控制器驱动，位置是球员局部坐标，.12 m 对应现有真实球半径。
type DribblePose={ball:{x:number;y:number;z:number};palm:{x:number;y:number;z:number};push:number;torso:number};
export function dribblePose(phase:number,speed:number,side=1,result:DribblePose={ball:{x:0,y:0,z:0},palm:{x:0,y:0,z:0},push:0,torso:0}){
  const p=Math.max(0,Math.min(1,phase)),running=clamp(speed/6.2),height=.95-running*.14;
  const flight=p<=.44?p/.44:(1-p)/.56;
  const y=.12+height*(1-flight*flight),lead=Math.sin(Math.PI*p)**2*.06*running;
  const x=side*(.31+running*.045),z=-.40-running*.10-lead;
  const palmY=Math.max(y+.075,.92+.025*Math.cos(2*Math.PI*p));
  result.ball.x=x;result.ball.y=y;result.ball.z=z;result.palm.x=x;result.palm.y=palmY;result.palm.z=z;result.push=clamp(1-p/.23);result.torso=-.08-running*.09;return result;
}
