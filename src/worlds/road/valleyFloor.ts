import {BufferGeometry,Float32BufferAttribute} from "three";
import {terrainHeight} from "./route";

// 与既有远景地表相同的边界和网格；湖岸与远树共享此表面，不把连续高度冒充渲染三角面。
export const valleyFloor={n:145,x:-1050,z:-2200,width:3000,depth:3000};
export function createValleyFloor(){
  const {n,x,z,width,depth}=valleyFloor,p:number[]=[],uv:number[]=[],index:number[]=[];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const px=x+i/n*width,pz=z+j/n*depth;p.push(px,terrainHeight(px,pz)-2.2,pz);uv.push(px/8,pz/8);
    if(i<n&&j<n){const a=j*(n+1)+i;index.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
  }
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(p,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
