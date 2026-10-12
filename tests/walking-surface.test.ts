import {describe,it,expect} from "vitest";
import {walkingSurface} from "../src/worlds/road/walkingSurface";
import {forestMap,getRideMap} from "../src/worlds/road/maps";
import {roadRibbon,closestRoad} from "../src/worlds/road/route";
import {alpineRibbon,nearestAlpine} from "../src/worlds/alpine/route";
import {Vector3} from "three";

describe("walking on the visible road instead of buried terrain",()=>{
 for(const map of [forestMap,getRideMap("alpine-ride")]){
  it(map.id+" follows actual road mesh vertices, preserving original off-road height",()=>{
   const p=new Vector3(),t=new Vector3();let offRoadChecks=0;
   for(let d=12;d<map.length-12;d+=map.length/60){
    const mesh=(map.id==="cycling"?roadRibbon:alpineRibbon)(d-2,d+2,6.4,0,.01),v=mesh.getAttribute("position");
    // 参考实际展面顶点的左右平均高度，而非把被测函数的表达式复制到期望值。
    const i=Math.floor(v.count/4)*2,x=(v.getX(i)+v.getX(i+1))/2,z=(v.getZ(i)+v.getZ(i+1))/2,y=(v.getY(i)+v.getY(i+1))/2;
    expect(Math.abs(walkingSurface(map,x,z)-y)).toBeLessThan(.025);mesh.dispose();
    map.sample(d,p,t);const r=Math.hypot(t.x,t.z),offX=p.x-t.z/r*12,offZ=p.z+t.x/r*12;
    // 高山发夹弯的路侧点可能落在另一条真实路面上；只用确实离开铺装的点验证地形不变。
    const nearest=map.id==="cycling"?closestRoad(offX,offZ):nearestAlpine(offX,offZ);
    if(nearest.distance>6){expect(walkingSurface(map,offX,offZ)).toBe(map.ground(offX,offZ));offRoadChecks++;}
   }
   expect(offRoadChecks).toBeGreaterThan(20);
  });
 }
});
