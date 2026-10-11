import type {BufferGeometry} from "three";

const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function hash(x:number,z:number){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);}
// 不依赖加载顺序的世界坐标生态场，回头、分块交接和刷新保留同一片疏密关系。
export function habitat(x:number,z:number){
  const px=x/31,pz=z/31,ix=Math.floor(px),iz=Math.floor(pz),fx=px-ix,fz=pz-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return mix(mix(hash(ix,iz),hash(ix+1,iz),u),mix(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}

// 植物与石块贴合已经渲染的三角面。仅创建分块时建 12 米空间桶，查询不做全地形扫描。
export function terrainSampler(geometry:BufferGeometry,fallback:(x:number,z:number)=>number){
  const pos=geometry.getAttribute("position"),index=geometry.index;
  if(!index)throw new Error("Ground sampler needs indexed terrain");
  const cells=new Map<string,number[]>(),size=12;
  for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
    const minX=Math.floor(Math.min(pos.getX(a),pos.getX(b),pos.getX(c))/size),maxX=Math.floor(Math.max(pos.getX(a),pos.getX(b),pos.getX(c))/size);
    const minZ=Math.floor(Math.min(pos.getZ(a),pos.getZ(b),pos.getZ(c))/size),maxZ=Math.floor(Math.max(pos.getZ(a),pos.getZ(b),pos.getZ(c))/size);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+":"+z,list=cells.get(key)??[];list.push(i);cells.set(key,list);}
  }
  return (x:number,z:number)=>{
    for(const i of cells.get(Math.floor(x/size)+":"+Math.floor(z/size))??[]){
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),ax=pos.getX(a),az=pos.getZ(a),bx=pos.getX(b),bz=pos.getZ(b),cx=pos.getX(c),cz=pos.getZ(c);
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-8)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)return u*pos.getY(a)+v*pos.getY(b)+(1-u-v)*pos.getY(c);
    }
    return fallback(x,z);
  };
}
