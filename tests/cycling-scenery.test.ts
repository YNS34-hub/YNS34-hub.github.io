import {describe,it,expect,vi} from "vitest";
import {BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,Texture} from "three";
import {dryRoadMaterial,weatheredEdgePaint} from "../src/worlds/scenery/roadFinish";
import {habitat,terrainSampler} from "../src/worlds/scenery/ecology";

describe("scenic materials retain asset ownership and metre scale",()=>{
  it("rejects zero / non-finite UV scales before creating a broken surface",()=>{
    const map=new Texture();
    for(const metres of [[0,5],[2,NaN],[-1,6]] as [number,number][])expect(()=>dryRoadMaterial(map,map,metres,6.4)).toThrow(RangeError);
    expect(()=>dryRoadMaterial(map,map,[2,5],Infinity)).toThrow(RangeError);
  });
  it("disposing either route material leaves the shared photograph usable",()=>{
    const map=new Texture(),normal=new Texture(),dispose=vi.fn();map.addEventListener("dispose",dispose);normal.addEventListener("dispose",dispose);
    const forest=dryRoadMaterial(map,normal,[2,5],6.4),alpine=dryRoadMaterial(map,normal,[3,6],6.4);
    forest.dispose();expect(dispose).not.toHaveBeenCalled();expect(alpine.map).toBe(map);expect(alpine.normalMap).toBe(normal);
    expect(map.repeat.toArray()).toEqual([1,1]);alpine.dispose();expect(dispose).not.toHaveBeenCalled();
  });
  it("repeated React updates do not wrap the paint shader indefinitely",()=>{
    const material=new MeshStandardMaterial();weatheredEdgePaint(material,[2,5]);const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
    weatheredEdgePaint(material,[2,5]);expect(material.onBeforeCompile).toBe(compile);expect(material.customProgramCacheKey()).toBe(key);
  });
});

describe("stable scenic ecology follows visible ground",()=>{
  it("keeps the same bounded habitat across negative cells and a sector boundary",()=>{
    for(let x=-320;x<400;x+=13.7){const value=habitat(x,-181.3);expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(1);expect(habitat(x,-181.3)).toBe(value);}
    expect(Math.abs(habitat(159.999,-310)-habitat(160.001,-310))).toBeLessThan(.001);
  });
  it("samples sloped mesh triangles and their shared diagonal rather than an analytic approximation",()=>{
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute([-24,0,-24,24,12,-24,-24,6,24,24,18,24],3));g.setIndex([0,1,2,1,3,2]);
    const ground=terrainSampler(g,()=>-999);
    expect(ground(-12,-12)).toBeCloseTo(4.5);expect(ground(12,12)).toBeCloseTo(13.5);expect(ground(0,0)).toBeCloseTo(9);
    expect(ground(0,30)).toBe(-999);expect(g.index?.count).toBe(6);g.dispose();
  });
});
