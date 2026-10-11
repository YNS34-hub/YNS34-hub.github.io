import {BufferGeometry,Float32BufferAttribute} from "three";
import {lake,lakeDistance,terrainHeight,closestRoad} from "./route";
import {terrainSampler,habitat} from "../scenery/ecology";
import type {Instance} from "../Instances";
import {createValleyFloor} from "./valleyFloor";

type Point={x:number;z:number;depth:number};
// 静态水面按实际地表三角面裁到等高岸线；不再用固定椭圆遮住不相交的岸线。
export function createLakeMesh(){
  const floor=createValleyFloor(),ground=terrainSampler(floor,terrainHeight),positions:number[]=[],depths:number[]=[],indices:number[]=[];
  const nx=178,nz=132,x0=lake.x-lake.rx*1.45,z0=lake.z-lake.rz*1.45,dx=lake.rx*2.9/nx,dz=lake.rz*2.9/nz;
  const point=(i:number,j:number):Point=>{const x=x0+i*dx,z=z0+j*dz;return{x,z,depth:lake.y-ground(x,z)};};
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
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=point(i,j),b=point(i+1,j),c=point(i,j+1),d=point(i+1,j+1);triangle([a,c,b]);triangle([b,c,d]);}
  floor.dispose();const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("waterDepth",new Float32BufferAttribute(depths,1));g.setIndex(indices);g.computeBoundingSphere();return g;
}

// 少量静态岸边实拍草簇与扫描石块：位置从真实零水深边界取样，避免整圈均匀排布。
export function createLakeShore(geometry:BufferGeometry){
  const floor=createValleyFloor(),ground=terrainSampler(floor,terrainHeight),p=geometry.getAttribute("position"),depth=geometry.getAttribute("waterDepth"),seen=new Set<string>();
  const rocks:Instance[]=[],grass:Instance[][]=[[],[],[]];
  for(let i=0;i<p.count;i++){
    if(depth.getX(i)!==0)continue;
    const sx=p.getX(i),sz=p.getZ(i),key=Math.floor(sx/13)+":"+Math.floor(sz/13);if(seen.has(key))continue;seen.add(key);
    const patch=habitat(sx*1.7,sz*1.7);if(patch<.42)continue;
    const nx=(sx-lake.x)/lake.rx**2,nz=(sz-lake.z)/lake.rz**2,n=Math.hypot(nx,nz),offset=1.7+patch*1.8,x=sx+nx/n*offset,z=sz+nz/n*offset,y=ground(x,z);
    if(y<lake.y+.03||y>lake.y+1.8||closestRoad(x,z).distance<85)continue;
    const width=.55+patch*.7;
    grass[i%3].push({position:[x,y-.02,z],scale:[width,.45+patch*.4,width],rotation:[0,patch*17,0]});
    if(patch>.62&&rocks.length<48)rocks.push({position:[x,y-.14,z],scale:[1.2+patch,.45+patch*.4,.9+patch],rotation:[0,patch*23,0]});
  }
  floor.dispose();return{rocks,grass};
}
