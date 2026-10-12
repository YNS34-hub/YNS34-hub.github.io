// 净横向加速度与重力的平衡角；保留公路安全上限，停止 / 直道不伪造倾斜。
export function balancedLean(speed:number,curvature:number){
  if(!Number.isFinite(speed)||!Number.isFinite(curvature))return 0;
  return Math.max(-.52,Math.min(.52,Math.atan(Math.max(0,speed)**2*curvature/9.81)));
}
