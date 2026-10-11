import {describe,it,expect} from "vitest";
import {createLakeMesh,createLakeShore} from "../src/worlds/road/lakeMesh";
import {createValleyFloor} from "../src/worlds/road/valleyFloor";
import {terrainSampler} from "../src/worlds/scenery/ecology";
import {lake,terrainHeight} from "../src/worlds/road/route";

describe("the lake meets rendered valley triangles",()=>{
  it("has a horizontal bounded surface, actual depths and a clipped zero-depth shoreline",()=>{
    const floor=createValleyFloor(),ground=terrainSampler(floor,terrainHeight),g=createLakeMesh();
    const p=g.getAttribute("position"),depth=g.getAttribute("waterDepth");let shore=0,heightError=0,shoreError=0,minimumDepth=Infinity,finite=true;
    expect(g.index!.count/3).toBeLessThan(60000);expect(g.boundingSphere!.radius).toBeLessThan(500);
    for(let i=0;i<p.count;i++){
      heightError=Math.max(heightError,Math.abs(p.getY(i)-lake.y));finite&&=Number.isFinite(depth.getX(i));minimumDepth=Math.min(minimumDepth,depth.getX(i));
      if(depth.getX(i)===0){shore++;shoreError=Math.max(shoreError,Math.abs(ground(p.getX(i),p.getZ(i))-lake.y));}
    }
    expect(heightError).toBeLessThan(.0001);expect(finite).toBe(true);expect(minimumDepth).toBeGreaterThanOrEqual(0);
    expect(shore).toBeGreaterThan(200);expect(shoreError).toBeLessThan(.18);
    const plants=createLakeShore(g),again=createLakeShore(g);expect(plants).toEqual(again);expect(plants.rocks.length).toBeLessThanOrEqual(48);
    expect(plants.grass.flat().length).toBeGreaterThan(3);expect(plants.grass.flat().length).toBeLessThan(180);
    for(const item of plants.grass.flat())expect(item.position[1]).toBeCloseTo(ground(item.position[0],item.position[2])-.02,4);
    // 地表与湖面分别拥有几何；销毁任一方不影响另一方。
    g.dispose();expect(floor.getAttribute("position").count).toBe(146*146);floor.dispose();
  });
});
