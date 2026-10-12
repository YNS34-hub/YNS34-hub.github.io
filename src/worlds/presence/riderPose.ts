import { Vector3, type Quaternion } from "three";

export type BikeStyle = "city" | "road";
export function gripPoint(style: BikeStyle, side: number, steer: number, result: Vector3) {
  result.set(side * (style === "city" ? .265 : .21), style === "city" ? .285 : .09, style === "city" ? -.02 : -.28);
  const x = result.x, z = result.z, angle = steer;
  result.x = x * Math.cos(angle) + z * Math.sin(angle); result.z = z * Math.cos(angle) - x * Math.sin(angle);
  result.y += .90; result.z -= .39; return result;
}
export function riderPosture(style: BikeStyle, effort: number, brake: number, phase: number, comfort: boolean, standing=0) {
  const active = Math.max(0, Math.min(1, effort)), braking = Math.max(0, Math.min(1, brake));
  const stand=Math.max(0,Math.min(1,standing));
  // 站姿的髋部离开鞍座并移至曲柄上方；节奏来自同一实际踏频，滑行不会凭空摇车。
  return { spine: (style === "city" ? -.50-stand*.09 : -1.14+stand*.13) - active * .025 + braking * .035,
    spine1: style === "city" ? -.045 : -.085, head: (style === "city" ? .49+stand*.09 : 1.08-stand*.13) + active * .018,
    // 完整踏圈的最低点暴露左腿 2.9 cm 的不可达间隙；降低骨盆基准 1.5 cm，保留真实腿长。
    hipBase:.05,hipRise:stand*.105+(comfort?0:stand*active*Math.sin(phase*2)*.006),hipForward:.21-stand*.19,
    rock:comfort?0:Math.sin(phase)*.026*active*stand,
    hipShift: comfort ? 0 : Math.sin(phase) * (.006+stand*.008) * active,
    ankle: comfort ? 0 : Math.sin(phase - .25) * .055 * active,
    eyeOffset: style === "city" ? .085 : 0 };
}

export function riderAnkle(side:number,phase:number,effort:number,comfort:boolean){
  return comfort?0:Math.sin(phase+(side<0?Math.PI:0)-.35)*.08*Math.max(0,Math.min(1,effort));
}
// 以鞋底接触点反求踝关节，脚踝俯仰后鞋底仍在真实脚踏上；支持输入与输出共用向量。
export function ankleFromContact(contact:Vector3,soleOffset:Vector3,orientation:Quaternion,output:Vector3){
  const x=contact.x,y=contact.y,z=contact.z;
  output.copy(soleOffset).applyQuaternion(orientation);return output.set(x-output.x,y-output.y,z-output.z);
}

// 滑行时仅把原视觉曲柄缓慢摆回水平；有真实踏频时完全沿用原相位，不修改骑行物理。
export function settleCranks(phase:number,cadence:number,speed:number,delta:number){
  if(cadence>1||speed<.2)return phase;
  const level=Math.round(phase/Math.PI)*Math.PI;
  return phase+(level-phase)*(1-Math.exp(-Math.max(0,Math.min(.06,delta))*4.5));
}
