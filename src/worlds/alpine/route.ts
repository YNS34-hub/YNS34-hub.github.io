import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";
import points from "./road-data.json" with { type: "json" };
import type { RideMap } from "../road/mapTypes";

// 使用独立的 OSM 山口公路与 EU-DEM 高程。米制坐标、真实垂直比例；原湖谷路线不参与计算。
export const alpineCurve = new CatmullRomCurve3(points.map(p => new Vector3(...p as [number, number, number])), false, "centripetal");
alpineCurve.arcLengthDivisions = 12000;
export const alpineLength = alpineCurve.getLength();
export const alpineSectorLength = 180;
// 细弯处 Catmull–Rom 的三维插值会放大 DEM 高度噪声。高度按弧长独立限坡，保持镜头与轮胎连续。
const heightStep=4, heights:number[]=[];
for(let i=0;i<=Math.ceil(alpineLength/heightStep);i++){
  const y=alpineCurve.getPointAt(Math.min(1,i*heightStep/alpineLength)).y,prior=heights.at(-1);
  heights.push(prior===undefined?y:Math.max(prior-.115*heightStep,Math.min(prior+.115*heightStep,y)));
}
export function sampleAlpine(distance: number, point: Vector3, tangent: Vector3) {
  const t = Math.max(0, Math.min(1, distance / alpineLength));
  alpineCurve.getPointAt(t, point); alpineCurve.getTangentAt(t, tangent);
  const a=Math.min(heights.length-2,Math.floor(t*alpineLength/heightStep)),f=Math.min(1,(t*alpineLength-a*heightStep)/heightStep);
  point.y=heights[a]+(heights[a+1]-heights[a])*f;
  tangent.y=(heights[a+1]-heights[a])/heightStep*Math.hypot(tangent.x,tangent.z);tangent.normalize();
}
const samples: Vector3[] = [], bins = new Map<string, number[]>(), cell = 60;
for (let i = 0; i <= Math.ceil(alpineLength / 4); i++) {
  const p = new Vector3(); sampleAlpine(i*4,p,new Vector3()); samples.push(p);
  const key = `${Math.floor(p.x / cell)}:${Math.floor(p.z / cell)}`;
  const bin = bins.get(key) ?? []; bin.push(i); bins.set(key, bin);
}
export function nearestAlpine(x: number, z: number) {
  let distance = Infinity, index = 0;
  const bx = Math.floor(x / cell), bz = Math.floor(z / cell);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const i of bins.get(`${bx+a}:${bz+b}`) ?? []) {
    const p = samples[i], d = (p.x-x)**2+(p.z-z)**2;
    if (d < distance) { distance = d; index = i; }
  }
  let along=index*4,xp=samples[index].x,yp=samples[index].y,zp=samples[index].z;
  // 投影到线段而不是最近离散点；急弯和路肩不应每四米产生一道台阶或穿出路面的地形。
  for(const i of [index-1,index])if(i>=0&&i<samples.length-1){
    const a=samples[i],b=samples[i+1],dx=b.x-a.x,dz=b.z-a.z,span=dx*dx+dz*dz;
    const t=span?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/span)):0;
    const px=a.x+dx*t,pz=a.z+dz*t,d=(px-x)**2+(pz-z)**2;
    if(d<distance){distance=d;xp=px;yp=a.y+(b.y-a.y)*t;zp=pz;along=(i+t)*4;}
  }
  return { distance: Math.sqrt(distance), point:new Vector3(xp,yp,zp), distanceAlong:Math.min(alpineLength,along) };
}
export interface AlpineHeightfield {width: number; height: number; step: number; x0: number; z0: number; base: number; values: number[]}
let field: AlpineHeightfield | undefined;
export function setAlpineHeightfield(data: AlpineHeightfield) { field = data; }
export function alpineElevation(x: number, z: number) {
  if (!field) return nearestAlpine(x, z).point.y;
  const { width, height, step, x0, z0, values } = field;
  const u = Math.max(0, Math.min(width-1.001, (x-x0)/step)), v = Math.max(0, Math.min(height-1.001, (z-z0)/step));
  const i = Math.floor(u), j = Math.floor(v), a = u-i, b = v-j;
  const y00 = values[j*width+i], y10 = values[j*width+i+1], y01 = values[(j+1)*width+i], y11 = values[(j+1)*width+i+1];
  return ((y00*(1-a)+y10*a)*(1-b)+(y01*(1-a)+y11*a)*b)*.5;
}
export function alpineGround(x: number, z: number) {
  const natural = alpineElevation(x,z), near = nearestAlpine(x,z);
  // 近公路平整路基，远处回到真实山坡。不能把陡崖全压平成宽阔的游戏平台。
  // DEM 与平滑路面在陡坡上可能相差数米；缓和切坡过渡，避免窄路基变成直立的土柱。
  const radius=Math.min(58,18+Math.abs(near.point.y-.16-natural)*.55);
  const t = Math.max(0, Math.min(1, (near.distance-6.0)/(radius-6))), blend = t*t*(3-2*t);
  return near.distance < radius ? (near.point.y-.16)*(1-blend)+natural*blend : natural;
}
export function alpineSectors(distance: number) {
  const count = Math.ceil(alpineLength/alpineSectorLength), current = Math.max(0, Math.min(count-1, Math.floor(distance/alpineSectorLength)));
  return [-2,-1,0,1,2,3].map(n=>current+n).filter(n=>n>=0&&n<count);
}
export function alpineRibbon(start: number, end: number, width: number, offset=0, lift=0) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], n = Math.ceil((end-start)/2);
  const p = new Vector3(), tangent = new Vector3();
  for (let i=0; i<=n; i++) {
    const d = start+(end-start)*i/n; sampleAlpine(d,p,tangent); const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);
    for (const side of [-1,1]) { const a=offset+side*width/2; positions.push(p.x+nx/r*a,p.y+lift,p.z+nz/r*a); uvs.push(side<0?0:width/3,d/6); }
    if (i<n) { const a=i*2; indices.push(a,a+1,a+2,a+1,a+3,a+2); }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
const chapters = [[0,"THE HIGH PASS"],[.09,"ABOVE THE VALLEY"],[.24,"ROCK & LIGHT"],[.38,"THE LONG DESCENT"],[.55,"THE SWITCHBACKS"],[.73,"VALLEY MEADOWS"],[.90,"A QUIET ARRIVAL"]] as const;
export const alpineMap: RideMap = {
  id:"alpine-ride",title:"THE ALPINE DESCENT",subtitle:"高山下坡 · 草甸、山壁与深谷",sceneName:"alpine-descent-world",saveKey:"memory-palace:alpine:v1",
  length:alpineLength,sample:sampleAlpine,ground:alpineGround,
  chapter:d=>[...chapters].reverse().find(([t])=>d/alpineLength>=t)?.[1]??"THE HIGH PASS",
  forest:t=>t>.78?.28:0,water:()=>0,
  stops:[.14,.43,.83].map((t,i)=>({distance:t*alpineLength,title:["VALLEY OVERLOOK","STONE & SKY","LOWER MEADOW"][i]})),sectors:alpineSectors,
};
