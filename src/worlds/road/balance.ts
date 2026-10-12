// 净横向加速度与重力的平衡角；保留公路安全上限，停止 / 直道不伪造倾斜。
export function balancedLean(speed:number,curvature:number){
  if(!Number.isFinite(speed)||!Number.isFinite(curvature))return 0;
  return Math.max(-.52,Math.min(.52,Math.atan(Math.max(0,speed)**2*curvature/9.81)));
}
export function visualSteering(curvature:number,input:number){
  // 逻辑的正输入代表右转；车模朝 -Z，实际车头绕 Y 应转负角。弯道自身也决定车轮朝向。
  if(!Number.isFinite(curvature)||!Number.isFinite(input))return 0;
  return Math.max(-.35,Math.min(.35,-Math.atan(curvature*1.01)-input))||0;
}
