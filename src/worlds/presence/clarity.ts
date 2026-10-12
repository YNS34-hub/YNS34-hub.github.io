export function sportPixelRatio(device:number,width:number,height:number,quality:string){
  const native=Number.isFinite(device)&&device>0?device:1;
  if(quality==="low")return Math.min(native,.85);
  const desired=quality==="high"?1.5:1.25,budget=quality==="high"?4_700_000:3_400_000;
  // 原生 4K 不往下糊；普通 1080p 提供真实像素超采样，并限制 Retina 的额外代价。
  return Math.max(1,Math.min(Math.max(desired,native),Math.sqrt(budget/Math.max(1,width*height))));
}
