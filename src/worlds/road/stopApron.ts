import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { lake, roadLength, roadSample, roadStops, sectorLength, terrainHeight } from "./route";

type Vertex = { x:number; y:number; z:number; d:number; o:number };
const patches = new Map<number, Vertex[][]>();
function terrainTriangles(distance:number) {
  const existing=patches.get(distance);if(existing)return existing;
  const triangles:Vertex[][]=[];
  const point = new Vector3(), tangent = new Vector3();
  // 与现有 makeTerrain 的 4 米纵向网格、170/28 米横向网格及对角线一致。
  // 只重建停靠点相邻几行，避免拿连续高度函数冒充实际可见的三角面。
  for(let sector=Math.floor((distance-4)/sectorLength);sector<=Math.floor((distance+4)/sectorLength);sector++){
    const start=sector*sectorLength,end=Math.min(roadLength,start+sectorLength),n=Math.ceil((end-start)/4),step=(end-start)/n;
    const first=Math.max(0,Math.floor((distance-4-start)/step)),last=Math.min(n,Math.ceil((distance+4-start)/step));
    const rows:Vertex[][]=[];
    for(let i=first;i<=last;i++){
      const d=start+step*i;roadSample(d,point,tangent);const r=Math.hypot(tangent.x,tangent.z),row:Vertex[]=[];
      for(let j=0;j<=28;j++){
        const o=(j/28-.5)*170,x=point.x-tangent.z/r*o,z=point.z+tangent.x/r*o;
        row.push({x,y:terrainHeight(x,z),z,d,o});
      }
      rows.push(row);
    }
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<28;j++)triangles.push([rows[i][j],rows[i][j+1],rows[i+1][j]],[rows[i][j+1],rows[i+1][j+1],rows[i+1][j]]);
  }
  if(patches.size>=4)patches.delete(patches.keys().next().value!);patches.set(distance,triangles);return triangles;
}
export function stopGroundHeight(x:number,z:number,distance:number){
  for(const [a,b,c] of terrainTriangles(distance)){
    const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
    if(Math.abs(den)<1e-8)continue;
    const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)return u*a.y+v*b.y+(1-u-v)*c.y;
  }
  return terrainHeight(x,z);
}
function clip(points:Vertex[],axis:"d"|"o",bound:number,positive:boolean){
  const result:Vertex[]=[];if(!points.length)return result;
  let previous=points.at(-1)!;
  for(const point of points){
    const a=(previous[axis]-bound)*(positive?1:-1),b=(point[axis]-bound)*(positive?1:-1);
    if((a>=0)!==(b>=0)){
      const t=a/(a-b);result.push({x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t,z:previous.z+(point.z-previous.z)*t,d:previous.d+(point.d-previous.d)*t,o:previous.o+(point.o-previous.o)*t});
    }
    if(b>=0)result.push(point);previous=point;
  }
  return result;
}
// 将原地形三角面裁成路外的小型铺装，表面与土壤共用拓扑，避免穿出或局部盖住台面。
export function createStopApron(distance:number,side:-1|1){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],edges:Vertex[][]=[];
  const d0=distance-2.5,d1=distance+2.5,o0=side===1?3.35:-6.7,o1=side===1?6.7:-3.35;
  for(const triangle of terrainTriangles(distance)){
    const polygon=clip(clip(clip(clip(triangle,"d",d0,true),"d",d1,false),"o",o0,true),"o",o1,false);
    if(polygon.length<3)continue;const n=positions.length/3;
    for(const p of polygon){positions.push(p.x,p.y+.045,p.z);uv.push(p.x/2,p.z/2);}
    for(let i=1;i<polygon.length-1;i++)indices.push(n,n+i,n+i+1);
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      if([["d",d0],["d",d1],["o",o0],["o",o1]].some(([axis,bound])=>Math.abs(a[axis as "d"|"o"]-(bound as number))<1e-5&&Math.abs(b[axis as "d"|"o"]-(bound as number))<1e-5))edges.push([a,b]);
    }
  }
  const topVertexCount=positions.length/3;
  for(const [a,b] of edges){const n=positions.length/3;positions.push(a.x,a.y+.045,a.z,b.x,b.y+.045,b.z,a.x,a.y-.115,a.z,b.x,b.y-.115,b.z);uv.push(0,1,1,1,0,0,1,0);indices.push(n,n+3,n+1,n,n+2,n+3);}
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.topVertexCount = topVertexCount; geometry.computeBoundingSphere(); return geometry;
}

const stops=roadStops.map(stop=>{const p=new Vector3(),t=new Vector3();roadSample(stop.distance,p,t);const r=Math.hypot(t.x,t.z),nx=-t.z/r,nz=t.x/r;return{x:p.x,z:p.z,tx:t.x/r,tz:t.z/r,nx,nz,side:nx*(lake.x-p.x)+nz*(lake.z-p.z)>=0?1:-1};});
export function insideStopApron(x:number,z:number){
  return stops.some(stop=>{const dx=x-stop.x,dz=z-stop.z;if(dx*dx+dz*dz>60)return false;const along=dx*stop.tx+dz*stop.tz,across=(dx*stop.nx+dz*stop.nz)*stop.side;return Math.abs(along)<2.8&&across>3.2&&across<6.85;});
}
