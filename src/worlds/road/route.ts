import { CatmullRomCurve3, Vector3, BufferGeometry, Float32BufferAttribute } from "three";

// 这是同一片湖谷内的固定公路。坐标为米，海拔起伏服务真实爬坡，不用章节传送拼接风景。
const knots = [
  [0,18,0],[8,18,-80],[-10,20,-180],[35,22,-290],[0,24,-385],[65,22,-495],
  [160,19,-560],[275,20,-585],[405,24,-780],[520,31,-805],[575,37,-850],
  [640,43,-950],[755,51,-1050],[810,60,-1150],[880,63,-1180],[990,65,-1100],
  [1070,65,-990],[1060,65,-875],[980,63,-805],[1100,54,-735],[1230,44,-700],[1320,37,-645],
  [1330,31,-555],[1275,23,-495],[1150,18,-580],[1010,15,-450],[885,16,-350],
  [750,18,-310],[680,19,-255],[555,20,-220],[415,19,-235],[295,18,-140],
  [180,18,-110],[100,18,30],[50,18,140],[0,18,240],
] as const;
export const roadRoute = new CatmullRomCurve3(knots.map(p => new Vector3(p[0]*.8,18+(p[1]-18)*.8,p[2]*.8)), false, "centripetal");
roadRoute.arcLengthDivisions = 5000;
export const roadLength = roadRoute.getLength();
export const sectorLength = 160;
export const sectorCount = Math.ceil(roadLength / sectorLength);
export const lake = { x: 520, z: -452, rx: 244, rz: 180, y: 12.08 };
export function lakeDistance(x: number, z: number) { return Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz); }
export const roadStops = [.23,.487,.89].map((t,i) => ({ distance: t*roadLength, title: ["LAKE EDGE","HIGH MEADOW","LAST LIGHT"][i] }));
export const roadChapters = [
  [0,"TRAILHEAD"],[.025,"CEDAR SHADE"],[.075,"FIRST LIGHT"],[.12,"FOREST ROLLERS"],
  [.185,"LAKE REVEAL"],[.23,"SHORE ROAD"],[.27,"THE CLIMB"],[.46,"CREST"],
  [.475,"HIGH MEADOW"],[.50,"GOLDEN VALLEY"],[.535,"THE DESCENT"],[.70,"WATERLINE"],[.83,"LAST LIGHT"],
] as const;
export function roadChapter(distance: number) { const t=distance/roadLength; return [...roadChapters].reverse().find(p=>t>=p[0])?.[1] ?? "TRAILHEAD"; }
export function roadSample(distance: number, point: Vector3, tangent: Vector3) {
  const t=Math.max(0,Math.min(1,distance/roadLength)); roadRoute.getPointAt(t,point); roadRoute.getTangentAt(t,tangent);
}
const samples: Vector3[] = [], bins = new Map<string, number[]>();
const cell=48;
for(let i=0;i<=Math.ceil(roadLength/3);i++) {
  const p=roadRoute.getPointAt(i/Math.ceil(roadLength/3)); samples.push(p);
  const key=Math.floor(p.x/cell)+":"+Math.floor(p.z/cell); const group=bins.get(key)??[]; group.push(i); bins.set(key,group);
}
// 地形与道路使用同一条真实曲线。空间分桶限定搜索，避免每个草叶/地形顶点遍历整条路线。
export function closestRoad(x:number,z:number) {
  const bx=Math.floor(x/cell),bz=Math.floor(z/cell);let distance=Infinity,index=0;
  for(let a=-2;a<=2;a++) for(let b=-2;b<=2;b++) for(const i of bins.get((bx+a)+":"+(bz+b))??[]) {
    const d=(samples[i].x-x)**2+(samples[i].z-z)**2;if(d<distance){distance=d;index=i;}
  }
  return { distance:Math.sqrt(distance), point:samples[index], progress:index/(samples.length-1) };
}
const smooth=(a:number,b:number,v:number)=> {const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function terrainHeight(x:number,z:number) {
  const radius=lakeDistance(x,z);
  const hills=16 + 8*Math.sin(x*.005)*Math.cos(z*.006) + 5*Math.sin(x*.019+z*.011);
  const plateau=32*Math.exp(-Math.pow((x-744)/296,2)-Math.pow((z+920)/224,2));
  const natural=(hills+plateau)*(smooth(.87,1.42,radius)) + (lake.y-3)*(1-smooth(.87,1.42,radius));
  const nearest=closestRoad(x,z),towardLake=(x-nearest.point.x)*(lake.x-nearest.point.x)+(z-nearest.point.z)*(lake.z-nearest.point.z)>0;
  const overlook=nearest.progress>.41&&nearest.progress<.53&&towardLake;
  const blend=1-smooth(overlook?3.5:5,overlook?22:65,nearest.distance);
  return natural*(1-blend)+(nearest.point.y-.12)*blend;
}
export function roadRibbon(start:number,end:number,width:number,offset=0,lift=0) {
  const positions:number[]=[],uvs:number[]=[],index:number[]=[],n=Math.ceil((end-start)/2.5);
  const p=new Vector3(),tangent=new Vector3();
  for(let i=0;i<=n;i++) {
    const d=start+(end-start)*i/n;roadSample(d,p,tangent);const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);
    for(const side of [-1,1]) {const a=offset+side*width/2;positions.push(p.x+nx/r*a,p.y+lift,p.z+nz/r*a);uvs.push(side<0?0:width/2,d/5);}
    if(i<n){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geo=new BufferGeometry();geo.setAttribute("position",new Float32BufferAttribute(positions,3));geo.setAttribute("uv",new Float32BufferAttribute(uvs,2));geo.setIndex(index);geo.computeVertexNormals();return geo;
}
export function activeRoadSectors(distance:number) {
  const current=Math.min(sectorCount-1,Math.floor(distance/sectorLength)),result=new Set<number>();
  for(let i=-2;i<=3;i++)if(current+i>=0&&current+i<sectorCount)result.add(current+i);
  return [...result].sort((a,b)=>a-b);
}
export function roadForestDensity(t:number) {
  if(t<.17) return .92;
  if(t<.30) return .43;
  if(t<.385) return .85;
  if(t<.445) return .85*(1-smooth(.385,.445,t));
  if(t<.59) return .035;
  if(t<.73) return .25;
  if(t<.83) return .32;
  return .65;
}
