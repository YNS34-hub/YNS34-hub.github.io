import {Vector3} from "three";
import type {RideMap} from "./mapTypes";
import {closestRoad} from "./route";
import {nearestAlpine} from "../alpine/route";

const a=new Vector3(),b=new Vector3(),c=new Vector3(),tangent=new Vector3();
export function walkingSurface(map:RideMap,x:number,z:number){
  // 地形刻意低于铺装面 12–16 cm；步行在路面时必须采用同一条道路的高度，不能把鞋埋入路基。
  let distance:number,height:number;
  if(map.id==="alpine-ride"){const near=nearestAlpine(x,z);distance=near.distance;height=near.point.y;}
  else{
    const near=closestRoad(x,z),d=near.progress*map.length;
    map.sample(Math.max(0,d-6),a,tangent);map.sample(d,b,tangent);map.sample(Math.min(map.length,d+6),c,tangent);
    distance=Infinity;height=near.point.y;
    // 森林索引返回离散点，投影到相邻线段后才判断 6.4 m 铺装范围，避免每隔一个样点换错地面。
    for(const [p,q]of [[a,b],[b,c]]){const dx=q.x-p.x,dz=q.z-p.z,span=dx*dx+dz*dz,u=span?Math.max(0,Math.min(1,((x-p.x)*dx+(z-p.z)*dz)/span)):0;
      const gap=Math.hypot(x-p.x-dx*u,z-p.z-dz*u);if(gap<distance){distance=gap;height=p.y+(q.y-p.y)*u;}}
  }
  return distance<=3.2?height+.01:map.ground(x,z);
}
