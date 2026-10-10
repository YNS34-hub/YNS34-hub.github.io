import {Box3,BufferGeometry,Float32BufferAttribute,Sphere,Vector3} from "three";
import {alpineGround,nearestAlpine,type AlpineHeightfield} from "./route";

// 构建时共享边界顶点与法线；渲染时按 2 公里地块剔除远离视野或阴影区域的山体。
export function buildAlpineTerrain(field:Pick<AlpineHeightfield,"width"|"height"|"step"|"x0"|"z0">,quality:string,
  height=alpineGround,distance=(x:number,z:number)=>nearestAlpine(x,z).distance,tileSize=2000){
  const step=quality==="low"?80:40,nx=Math.ceil((field.width-1)*field.step/step),nz=Math.ceil((field.height-1)*field.step/step);
  const divisions=new Uint8Array(nx*nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const d=distance(field.x0+(i+.5)*step,field.z0+(j+.5)*step);
    divisions[j*nx+i]=d<50?16:d<150?8:d<1600?4:quality==="low"?1:2;
  }
  const points:number[]=[],uv:number[]=[],indices:number[]=[],lookup=new Map<number,number>(),tiles=new Map<string,number[]>(),rowWidth=Math.ceil(nx*step*.8)+1;
  const vertex=(x:number,z:number)=>{
    // 最细单元的中心仍落在 1.25 米整数格。数字键避免百万个临时字符串及冷启动 GC。
    const key=Math.round((z-field.z0)*.8)*rowWidth+Math.round((x-field.x0)*.8),prior=lookup.get(key);if(prior!==undefined)return prior;
    const index=points.length/3;points.push(x,height(x,z)-.035,z);uv.push(x/3,z/3);lookup.set(key,index);return index;
  };
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const n=divisions[j*nx+i],size=step/n,baseX=field.x0+i*step,baseZ=field.z0+j*step,key=Math.floor(i*step/tileSize)+":"+Math.floor(j*step/tileSize);
    let tile=tiles.get(key);if(!tile){tile=[];tiles.set(key,tile);}
    const adjacent=(di:number,dj:number)=>i+di<0||i+di>=nx||j+dj<0||j+dj>=nz?n:divisions[(j+dj)*nx+i+di];
    for(let b=0;b<n;b++)for(let a=0;a<n;a++){
      const x=baseX+a*size,z=baseZ+b*size,ring:number[]=[];
      // 每条粗边显式纳入相邻细边的点。三角形不重叠，没有依赖雾隐藏的 T 接缝。
      const edge=(x0:number,z0:number,x1:number,z1:number,neighbor:number)=>{
        const count=Math.max(1,neighbor/n);for(let k=0;k<count;k++)ring.push(vertex(x0+(x1-x0)*k/count,z0+(z1-z0)*k/count));
      };
      edge(x,z,x,z+size,a===0?adjacent(-1,0):n);edge(x,z+size,x+size,z+size,b===n-1?adjacent(0,1):n);
      edge(x+size,z+size,x+size,z,a===n-1?adjacent(1,0):n);edge(x+size,z,x,z,b===0?adjacent(0,-1):n);
      const start=indices.length;
      if(ring.length===4)indices.push(ring[0],ring[1],ring[3],ring[3],ring[1],ring[2]);
      else {const centre=vertex(x+size/2,z+size/2);for(let k=0;k<ring.length;k++)indices.push(centre,ring[k],ring[(k+1)%ring.length]);}
      for(let k=start;k<indices.length;k++)tile.push(indices[k]);
    }
  }
  const master=new BufferGeometry();master.setAttribute("position",new Float32BufferAttribute(points,3));master.setAttribute("uv",new Float32BufferAttribute(uv,2));master.setIndex(indices);master.computeVertexNormals();
  const position=master.getAttribute("position");
  const chunks=[...tiles].map(([name,list])=>{
    const g=new BufferGeometry(),box=new Box3(),point=new Vector3();g.name=name;
    for(const key of ["position","uv","normal"])g.setAttribute(key,master.getAttribute(key));
    g.setIndex(list);for(const i of list)box.expandByPoint(point.fromBufferAttribute(position,i));
    g.boundingBox=box;g.boundingSphere=new Sphere();box.getBoundingSphere(g.boundingSphere);return g;
  });
  // 所有地块同生同灭，几何副本共用不可变顶点缓冲，卸载时一并释放。
  master.dispose();return chunks;
}
