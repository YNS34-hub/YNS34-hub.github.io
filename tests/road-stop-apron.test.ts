import { describe, expect, it } from "vitest";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { closestRoad, roadLength, roadSample, roadStops, sectorLength, terrainHeight } from "../src/worlds/road/route";
import { createStopApron, insideStopApron } from "../src/worlds/road/stopApron";

// 独立重建已接受 makeTerrain 的实际网格，再用 Three 射线验证台面；不复用台面的插值算法。
function acceptedGround(distance:number){
  const start=Math.floor(distance/sectorLength)*sectorLength,end=Math.min(roadLength,start+sectorLength),n=Math.ceil((end-start)/4),p=new Vector3(),t=new Vector3(),positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++){
    roadSample(start+(end-start)*i/n,p,t);const r=Math.hypot(t.x,t.z);
    for(let j=0;j<=28;j++){const o=(j/28-.5)*170,x=p.x-t.z/r*o,z=p.z+t.x/r*o;positions.push(x,terrainHeight(x,z),z);if(i<n&&j<28){const a=i*29+j;indices.push(a,a+1,a+29,a+1,a+30,a+29);}}
  }
  const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material),ray=new Raycaster();mesh.updateMatrixWorld();
  return{height(x:number,z:number){ray.set(new Vector3(x,120,z),new Vector3(0,-1,0));const hit=ray.intersectObject(mesh,false)[0];expect(hit).toBeTruthy();return hit.point.y;},dispose(){geometry.dispose();material.dispose();}};
}

describe("grounded scenic stopping aprons", () => {
  it("keeps all stopping pads outside the actual paved lane on either side", () => {
    for (const stop of roadStops) for (const side of [-1, 1] as const) {
      const geometry = createStopApron(stop.distance, side), positions = geometry.getAttribute("position");
      for (let i = 0; i < geometry.userData.topVertexCount; i++) {
        expect(closestRoad(positions.getX(i), positions.getZ(i)).distance).toBeGreaterThan(3.22);
      }
      geometry.dispose();
    }
  });
  it("follows the actual ground instead of exposing a flat slab through the shoulder", () => {
    let largestRise = 0;
    for (const stop of roadStops) {
      const geometry = createStopApron(stop.distance, 1), p = geometry.getAttribute("position"),ground=acceptedGround(stop.distance);
      let low = Infinity, high = -Infinity;
      for (let i = 0; i < geometry.userData.topVertexCount; i++) {
        const y = p.getY(i); low = Math.min(low, y); high = Math.max(high, y);
        expect(y - ground.height(p.getX(i), p.getZ(i))).toBeCloseTo(.045, 4);
      }
      largestRise = Math.max(largestRise, high - low);
      geometry.dispose();ground.dispose();
    }
    expect(largestRise).toBeGreaterThan(.1);
  });
  it("excludes plants on paving while retaining the adjacent shoulder",()=>{
    for(const stop of roadStops){
      const p=new Vector3(),t=new Vector3();roadSample(stop.distance,p,t);const r=Math.hypot(t.x,t.z),nx=-t.z/r,nz=t.x/r;
      const centerCandidates=[-1,1].map(side=>[p.x+nx*5*side,p.z+nz*5*side]);
      expect(centerCandidates.some(([x,z])=>insideStopApron(x,z))).toBe(true);
      expect(insideStopApron(p.x,p.z)).toBe(false);expect(insideStopApron(p.x+nx*10,p.z+nz*10)).toBe(false);
    }
  });
  it("has upward finite top normals and bounded skirt geometry without altering the route", () => {
    const p = new Vector3(), t = new Vector3(); roadSample(roadStops[0].distance, p, t);
    const before = p.toArray(), geometry = createStopApron(roadStops[0].distance, -1);
    const normals = geometry.getAttribute("normal"), positions = geometry.getAttribute("position");
    for (let i = 0; i < geometry.userData.topVertexCount; i++) expect(normals.getY(i)).toBeGreaterThan(.8);
    for (const value of positions.array) expect(Number.isFinite(value)).toBe(true);
    expect(geometry.index!.count / 3).toBeLessThan(160);
    roadSample(roadStops[0].distance, p, t); expect(p.toArray()).toEqual(before);
    geometry.dispose();
  });
});
