import {describe,it,expect,vi} from "vitest";
import {Texture} from "three";
import {createShoulders,createVergeGrass,shoulderMaterial,type RoadsideSite} from "../src/worlds/scenery/roadside";
import {terrainSampler} from "../src/worlds/scenery/ecology";

const site:RoadsideSite={kind:"forest",sample:(d,p,t)=>{p.set(0,12,-d);t.set(0,0,-1);},ground:()=>11.88,nearest:(x)=>Math.abs(x)};
describe("bounded roadside surface geometry",()=>{
  it("keeps the rideable width, outer ground contact, upward normals and a fixed sector budget",()=>{
    const g=createShoulders(0,160,site),p=g.getAttribute("position"),n=g.getAttribute("normal"),edge=g.getAttribute("shoulderEdge");
    expect(g.index!.count/3).toBeLessThan(700);expect(g.boundingSphere!.radius).toBeLessThan(100);
    for(let i=0;i<p.count;i++){
      expect(Math.abs(p.getX(i))).toBeGreaterThanOrEqual(3.1599);expect(Math.abs(p.getX(i))).toBeLessThan(4.5);
      expect(Number.isFinite(p.getY(i))).toBe(true);expect(n.getY(i)).toBeGreaterThan(.3);
      if(edge.getX(i)===1)expect(p.getY(i)).toBeCloseTo(site.ground(p.getX(i),p.getZ(i))+.014,4);
    }g.dispose();
  });
  it("keeps deterministic boundaries across adjacent streamed sectors",()=>{
    const a=createShoulders(0,160,site),b=createShoulders(160,320,site);
    const boundary=(g:typeof a)=>{const p=g.getAttribute("position"),out=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i)+160)<.001)out.push([p.getX(i),p.getY(i),p.getZ(i)]);return out.sort((a,b)=>a[0]-b[0]);};
    expect(boundary(a)).toEqual(boundary(b));expect(boundary(a)).toHaveLength(6);a.dispose();b.dispose();
  });
  it("leaves scenic aprons and neighbouring switchback pavement uncovered",()=>{
    const blocked=createShoulders(0,160,{...site,blocked:()=>true}),overlap=createShoulders(0,160,{...site,nearest:()=>2});
    expect(blocked.index!.count).toBe(0);expect(overlap.index!.count).toBe(0);blocked.dispose();overlap.dispose();
  });
  it("owns only the shoulder material, leaving both shared textures alive",()=>{
    const map=new Texture(),normal=new Texture(),soil=new Texture(),dispose=vi.fn();for(const t of[map,normal,soil])t.addEventListener("dispose",dispose);
    const m=shoulderMaterial(map,normal,soil);m.dispose();expect(dispose).not.toHaveBeenCalled();expect(m.transparent).toBe(false);expect(m.map).toBe(map);
  });
  it("roots deterministic sparse grass in the actual shoulder triangles and respects the scenic exclusion",()=>{
    const g=createShoulders(0,160,site),ground=terrainSampler(g,site.ground),grass=createVergeGrass(0,160,site,g);
    expect(createVergeGrass(0,160,site,g)).toEqual(grass);
    expect(grass.flat().length).toBeGreaterThan(0);expect(grass.flat().length).toBeLessThan(28);
    for(const item of grass.flat()){
      const [x,y,z]=item.position;expect(Math.abs(x)).toBeGreaterThan(3.4);expect(y).toBeCloseTo(ground(x,z)-.02,6);expect(item.scale[1]).toBeLessThan(.26);
    }
    expect(createVergeGrass(0,160,{...site,blocked:()=>true},g).flat()).toEqual([]);g.dispose();
  });
});
