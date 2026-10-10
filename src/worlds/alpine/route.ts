import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";
import points from "./road-data.json" with { type: "json" };
import type { RideMap } from "../road/mapTypes";

// 使用独立的 OSM 山口公路与 swisstopo 实测高程。米制坐标、真实垂直比例；原湖谷路线不参与计算。
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
const samples: Vector3[] = [];
for (let i = 0; i <= Math.ceil(alpineLength / 4); i++) {
  const p = new Vector3(); sampleAlpine(i*4,p,new Vector3()); samples.push(p);
}
// 静态二维索引使近景批量放置与骑行时的高度查询不再遍历整片 60 米路网。
// 搜索不设距离截断，远处弯道也不会错误地关联到起点。
interface RoadNode {index:number;axis:0|1;left:RoadNode|null;right:RoadNode|null;minX:number;maxX:number;minZ:number;maxZ:number}
function roadIndex(indices:number[],depth=0):RoadNode|null {
  if(!indices.length)return null;
  const axis=depth%2 as 0|1,coordinate=(i:number)=>axis?samples[i].z:samples[i].x;
  indices.sort((a,b)=>coordinate(a)-coordinate(b));const middle=Math.floor(indices.length/2);
  const index=indices[middle],left=roadIndex(indices.slice(0,middle),depth+1),right=roadIndex(indices.slice(middle+1),depth+1),p=samples[index];
  return {index,axis,left,right,minX:Math.min(p.x,left?.minX??Infinity,right?.minX??Infinity),maxX:Math.max(p.x,left?.maxX??-Infinity,right?.maxX??-Infinity),minZ:Math.min(p.z,left?.minZ??Infinity,right?.minZ??Infinity),maxZ:Math.max(p.z,left?.maxZ??-Infinity,right?.maxZ??-Infinity)};
}
const tree=roadIndex(samples.map((_,i)=>i));
export function nearestAlpine(x: number, z: number) {
  let distance = Infinity, index = 0;
  const bound=(node:RoadNode|null)=>{
    if(!node)return Infinity;const dx=Math.max(0,node.minX-x,x-node.maxX),dz=Math.max(0,node.minZ-z,z-node.maxZ);return dx*dx+dz*dz;
  };
  const visit=(node:RoadNode|null)=>{
    if(!node||bound(node)>distance)return;
    const p=samples[node.index],dx=p.x-x,dz=p.z-z,d=dx*dx+dz*dz;
    if(d<distance){distance=d;index=node.index;}
    const first=bound(node.left)<bound(node.right)?node.left:node.right,second=first===node.left?node.right:node.left;
    visit(first);visit(second);
  };visit(tree);
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
export interface AlpineHeightfield {width: number; height: number; step: number; x0: number; z0: number; base: number; values: number[] | Int16Array}
let field: AlpineHeightfield | undefined;
let detailField: AlpineHeightfield | undefined;
export function setAlpineHeightfield(data: AlpineHeightfield) { field = data; }
export function setAlpineDetailfield(data: AlpineHeightfield) { detailField = data; }
function heightAt(data: AlpineHeightfield, x: number, z: number) {
  const { width, height, step, x0, z0, values } = data;
  const u = Math.max(0, Math.min(width-1.001, (x-x0)/step)), v = Math.max(0, Math.min(height-1.001, (z-z0)/step));
  const i = Math.floor(u), j = Math.floor(v), a = u-i, b = v-j;
  const y00 = values[j*width+i], y10 = values[j*width+i+1], y01 = values[(j+1)*width+i], y11 = values[(j+1)*width+i+1];
  return ((y00*(1-a)+y10*a)*(1-b)+(y01*(1-a)+y11*a)*b)*.5;
}
export function alpineElevation(x: number, z: number) {
  if (!field) return nearestAlpine(x, z).point.y;
  const broad=heightAt(field,x,z);
  if (!detailField) return broad;
  const d=detailField,edge=Math.min(x-d.x0,z-d.z0,d.x0+(d.width-1)*d.step-x,d.z0+(d.height-1)*d.step-z);
  if(edge<=0)return broad;
  // 两级实测数据以 80 米边带连续衔接，地面、草叶、石块与行走器共用同一高度。
  const t=Math.min(1,edge/80),blend=t*t*(3-2*t);
  return broad+(heightAt(d,x,z)-broad)*blend;
}
export function alpineGround(x: number, z: number, nearby?:ReturnType<typeof nearestAlpine>) {
  const natural = alpineElevation(x,z);
  // 绝大部分远山不可能进入最大 32 米路基；直接取实测高程，避免初始地形构建做百万次远距搜索。
  if(!nearby&&tree&&(x<tree.minX-32||x>tree.maxX+32||z<tree.minZ-32||z>tree.maxZ+32))return natural;
  const near=nearby??nearestAlpine(x,z);
  // 近公路平整路基，远处回到真实山坡。不能把陡崖全压平成宽阔的游戏平台。
  // DEM 与平滑路面在陡坡上可能相差数米；缓和切坡过渡，避免窄路基变成直立的土柱。
  const radius=Math.min(32,11+Math.abs(near.point.y-.16-natural)*.48);
  const t = Math.max(0, Math.min(1, (near.distance-4.15)/(radius-4.15))), blend = t*t*(3-2*t);
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
