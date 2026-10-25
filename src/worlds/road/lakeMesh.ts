import {BufferGeometry,Float32BufferAttribute} from "three";
import {lake,lakeDistance,terrainHeight,closestRoad} from "./route";
import {terrainSampler,habitat} from "../scenery/ecology";
import type {Instance} from "../Instances";
import {createValleyFloor} from "./valleyFloor";
import {shoreUphill} from './shoreDirection';

type Point={x:number;z:number;depth:number};
// 直接裁共享地表的原三角面，保留已验收的岸线；独立重采样会在地表对角线处漏出细缝。
export function createLakeMesh(sharedFloor?:BufferGeometry){
  const floor=sharedFloor??createValleyFloor(),source=floor.getAttribute('position'),index=floor.index!,positions:number[]=[],depths:number[]=[],indices:number[]=[];
  const point=(i:number):Point=>({x:source.getX(i),z:source.getZ(i),depth:lake.y-source.getY(i)});
  function triangle(points:Point[]){
    if(points.every(p=>lakeDistance(p.x,p.z)>1.43)||points.every(p=>p.depth<0))return;
    const clipped:Point[]=[];let a=points.at(-1)!;
    for(const b of points){
      if((a.depth>=0)!==(b.depth>=0)){const t=a.depth/(a.depth-b.depth);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,depth:0});}
      if(b.depth>=0)clipped.push(b);a=b;
    }
    const start=positions.length/3;
    for(const p of clipped){positions.push(p.x,lake.y,p.z);depths.push(Math.max(0,p.depth));}
    for(let i=1;i<clipped.length-1;i++)indices.push(start,start+i,start+i+1);
  }
  for(let i=0;i<index.count;i+=3)triangle([point(index.getX(i)),point(index.getX(i+1)),point(index.getX(i+2))]);
  if(!sharedFloor)floor.dispose();const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("waterDepth",new Float32BufferAttribute(depths,1));g.setIndex(indices);g.computeBoundingSphere();return g;
}

// 少量静态岸边实拍草簇与扫描石块：位置从真实零水深边界取样，避免整圈均匀排布。
export function createLakeShore(geometry:BufferGeometry,sharedGround?:(x:number,z:number)=>number){
  const floor=sharedGround?null:createValleyFloor(),ground=sharedGround??terrainSampler(floor!,terrainHeight),p=geometry.getAttribute("position"),depth=geometry.getAttribute("waterDepth"),seen=new Set<string>();
  const rocks:Instance[]=[],grass:Instance[][]=[[],[],[]];
  for(let i=0;i<p.count;i++){
    if(depth.getX(i)!==0)continue;
    const sx=p.getX(i),sz=p.getZ(i),key=Math.floor(sx/13)+":"+Math.floor(sz/13);if(seen.has(key))continue;seen.add(key);
    const patch=habitat(sx*1.7,sz*1.7);if(patch<.42)continue;
    const [nx,nz]=shoreUphill(sx,sz,ground,(sx-lake.x)/lake.rx**2,(sz-lake.z)/lake.rz**2),offset=1.7+patch*1.8,x=sx+nx*offset,z=sz+nz*offset,y=ground(x,z);
    if(y<lake.y+.03||y>lake.y+1.8||closestRoad(x,z).distance<85)continue;
    const width=.55+patch*.7;
    grass[i%3].push({position:[x,y-.02,z],scale:[width,.45+patch*.4,width],rotation:[0,patch*17,0]});
    if(patch>.62&&rocks.length<48)rocks.push({position:[x,y-.14,z],scale:[1.2+patch,.45+patch*.4,.9+patch],rotation:[0,patch*23,0]});
  }
  floor?.dispose();return{rocks,grass};
}
