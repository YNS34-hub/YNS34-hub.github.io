import {describe,it,expect,vi} from "vitest";
import {MeshStandardMaterial,Texture} from "three";
import {dryRoadMaterial,weatheredEdgePaint} from "../src/worlds/scenery/roadFinish";

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
