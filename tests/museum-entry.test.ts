import { describe, expect, it } from "vitest";
import { Mesh, MeshPhysicalMaterial, Quaternion, Vector3 } from "three";
import { ReflectionBudget } from "../src/rooms/atrium/budget";
import { createEntryRadiance } from "../src/rooms/atrium/environment";
import { finishMemoryGlass } from "../src/rooms/atrium/optics";
import { entryScreens, entrySupportFootprints } from "../src/rooms/atrium/exhibits";
import { keepClear } from "../src/world/collision";

describe("entry screen support collision", () => {
  it("keeps each rotated post solid while leaving the central path clear", () => {
    const posts=entrySupportFootprints();expect(posts).toHaveLength(entryScreens.length*2);
    for(const post of posts){const p=new Vector3(post.x,1.65,post.z);keepClear(p,"atrium");expect(Math.hypot(p.x-post.x,p.z-post.z)).toBeGreaterThan(.3);}
    const path=new Vector3(0,1.65,12);keepClear(path,"atrium");expect(path.toArray()).toEqual([0,1.65,12]);
  });
});

describe("bounded museum reflection", () => {
  it("does not redraw a settled room every frame", () => {
    const budget = new ReflectionBudget(12), position = new Vector3(0,1.65,23), rotation = new Quaternion();
    let renders = 0;
    for (let frame=0;frame<600;frame++) if(budget.take(frame/60,position,rotation,false,true))renders++;
    expect(renders).toBeLessThanOrEqual(3);
    expect(renders).toBeGreaterThan(0);
  });
  it("caps moving captures independently of main render frequency", () => {
    const budget = new ReflectionBudget(12), position = new Vector3(), rotation = new Quaternion();
    let renders = 0;
    for (let frame=0;frame<240;frame++) { position.x=frame*.01; if(budget.take(frame/240,position,rotation,false,true))renders++; }
    expect(renders).toBeLessThanOrEqual(13);
    expect(renders).toBeGreaterThanOrEqual(10);
  });
  it("never captures when hidden, and invalidates for newly ready works", () => {
    const budget=new ReflectionBudget(8), p=new Vector3(),q=new Quaternion();
    expect(budget.take(0,p,q,false,false)).toBe(false);
    expect(budget.take(0,p,q,false,true)).toBe(true);
    expect(budget.take(4,p,q,false,true)).toBe(true);
    expect(budget.take(5,p,q,false,true)).toBe(false);
    budget.invalidate();expect(budget.take(6,p,q,false,true)).toBe(true);
  });
  it("keeps active memory captures bounded and settles when the event ends", () => {
    const budget=new ReflectionBudget(8),p=new Vector3(),q=new Quaternion();let count=0;
    for(let frame=0;frame<120;frame++)if(budget.take(frame/60,p,q,true,true))count++;
    expect(count).toBeLessThanOrEqual(17);expect(count).toBeGreaterThan(12);
    budget.take(4,p,q,false,true);expect(budget.take(5,p,q,false,true)).toBe(false);
  });
});
describe("owned optical resources", () => {
  it("keeps the accepted glass and changes only its owned optical copy", () => {
    const original=new MeshPhysicalMaterial({transmission:1,thickness:3.8,ior:1.46,roughness:.025});
    const finish=finishMemoryGlass(original);
    expect(finish).not.toBe(original);expect(original.roughness).toBe(.025);
    expect(finish.transmission).toBe(1);expect(finish.ior).toBe(original.ior);expect(finish.thickness).toBe(original.thickness);
    let originalDisposed=false;original.addEventListener("dispose",()=>{originalDisposed=true;});finish.dispose();
    expect(originalDisposed).toBe(false);original.dispose();
  });
  it("disposes owned radiance geometry and materials once without retaining GPU resources", () => {
    const probe=createEntryRadiance();const geometry=new Set(),materials=new Set();
    probe.scene.traverse(o=>{if(o instanceof Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    let disposed=0;
    for(const resource of [...geometry,...materials] as {addEventListener(type:"dispose",listener:()=>void):void}[])resource.addEventListener("dispose",()=>disposed++);
    probe.dispose();expect(disposed).toBe(geometry.size+materials.size);probe.dispose();expect(disposed).toBe(geometry.size+materials.size);
  });
});
