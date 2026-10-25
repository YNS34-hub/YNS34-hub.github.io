export interface ImageAtlas {zoom:number;left:number;top:number;width:number;height:number;latitude:number;longitude:number;eastMetresPerDegree:number}
// 先在 CPU 双精度中减去千万级的 Mercator 原点，GPU 只计算局部米制差值。
// 三阶纬度项保留投影曲率，避免高分辨率航拍在移动中出现像素跳格。
export function atlasProjection(image:ImageAtlas){
  const scale=2**image.zoom*256,latitude=image.latitude*Math.PI/180,sec=1/Math.cos(latitude),tan=Math.tan(latitude),r=Math.PI/180/111320;
  const x=(image.longitude+180)/360*scale,y=(1-Math.asinh(tan)/Math.PI)/2*scale;
  return {origin:[(x-image.left)/image.width,(y-image.top)/image.height] as const,
    x:scale/(360*image.eastMetresPerDegree*image.width),z:scale*sec*r/(2*Math.PI*image.height),
    quadratic:-scale*sec*tan*r*r/(4*Math.PI*image.height),cubic:scale*(sec*tan*tan+sec**3)*r**3/(12*Math.PI*image.height)};
}
export function atlasUV(image:ImageAtlas,x:number,z:number){
  const p=atlasProjection(image);return[p.origin[0]+x*p.x,1-(p.origin[1]+z*p.z+z*z*p.quadratic+z*z*z*p.cubic)];
}
