import { CatmullRomCurve3, Vector3, BufferGeometry, Float32BufferAttribute } from "three";

// 这是同一片湖谷内的固定环路。坐标为米，海拔起伏服务真实爬坡，不用章节传送拼接风景。
const knots = [
  [0,18,0],[8,18,-80],[-10,20,-180],[35,22,-290],[0,24,-385],[65,22,-495],
  [160,19,-560],[275,20,-585],[405,24,-780],[520,31,-805],[575,37,-850],
  [640,43,-950],[755,51,-1050],[810,60,-1150],[825,63,-1210],[910,65,-1245],
  [1040,65,-1190],[1130,59,-1115],[1145,50,-1005],[1230,43,-935],[1320,34,-865],
  [1330,25,-745],[1275,17,-645],[1150,15,-580],[1010,15,-450],[885,16,-350],
  [750,18,-310],[680,19,-255],[555,20,-220],[415,19,-235],[295,18,-140],
  [180,18,-110],[65,18,-40],
] as const;
export const roadRoute = new CatmullRomCurve3(knots.map(p => new Vector3(...p)), true, "centripetal");
roadRoute.arcLengthDivisions = 5000;
export const roadLength = roadRoute.getLength();
export const sectorLength = 160;
export const sectorCount = Math.ceil(roadLength / sectorLength);
export const lake = { x: 650, z: -565, rx: 305, rz: 225, y: 10.6 };
export function lakeDistance(x: number, z: number) { return Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz); }
export const roadStops = [.23,.47,.81].map((t,i) => ({ distance: t*roadLength, title: ["LAKE EDGE","HIGH MEADOW","LAST LIGHT"][i] }));
export const roadChapters = [
  [0,"TRAILHEAD"],[.025,"CEDAR SHADE"],[.075,"FIRST LIGHT"],[.12,"FOREST ROLLERS"],
  [.19,"LAKE REVEAL"],[.245,"SHORE ROAD"],[.30,"THE CLIMB"],[.415,"CREST"],
  [.46,"HIGH MEADOW"],[.51,"GOLDEN VALLEY"],[.555,"THE DESCENT"],[.715,"WATERLINE"],[.82,"LAST LIGHT"],
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
  const plateau=40*Math.exp(-Math.pow((x-930)/370,2)-Math.pow((z+1150)/280,2));
  const natural=(hills+plateau)*(smooth(.87,1.42,radius)) + (lake.y-3)*(1-smooth(.87,1.42,radius));
  const nearest=closestRoad(x,z), blend=1-smooth(5,65,nearest.distance);
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
  for(let i=-2;i<=3;i++)result.add((current+i+sectorCount)%sectorCount);
  return [...result].sort((a,b)=>a-b);
}
export function roadForestDensity(t:number) {
  if(t<.17) return .92;
  if(t<.30) return .43;
  if(t<.395) return .85;
  if(t<.44) return .85*(1-smooth(.395,.44,t));
  if(t<.54) return .04;
  if(t<.70) return .25;
  if(t<.83) return .32;
  return .65;
}
