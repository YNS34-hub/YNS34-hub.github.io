import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { RoadPhysics } from "../src/worlds/road/physics";
import { alpineMap, alpineLength, alpineCurve, alpineSectors, sampleAlpine, setAlpineHeightfield, alpineGround, alpineRibbon } from "../src/worlds/alpine/route";
import { forestMap, getRideMap } from "../src/worlds/road/maps";

describe("independent alpine world",()=>{
  it("keeps the accepted forest map, namespace and route distinct",()=>{
    expect(getRideMap("cycling")).toBe(forestMap);expect(getRideMap("alpine-ride")).toBe(alpineMap);
    expect(forestMap.saveKey).toBe("memory-palace:road:v2");expect(alpineMap.saveKey).not.toBe(forestMap.saveKey);
    expect(alpineLength).toBeGreaterThan(9500);expect(alpineLength).toBeLessThan(11000);
    const start=alpineCurve.getPointAt(0),end=alpineCurve.getPointAt(1);expect(start.y-end.y).toBeGreaterThan(600);
  });
  it("has a continuous metre-scale road with bounded streamed sectors",()=>{
    const p=new Vector3(),t=new Vector3(),prior=new Vector3();sampleAlpine(0,prior,t);
    for(let d=5;d<alpineLength;d+=5){sampleAlpine(d,p,t);expect(p.distanceTo(prior)).toBeLessThan(5.5);expect(Math.abs(t.y/Math.hypot(t.x,t.z))).toBeLessThan(.14);expect(alpineSectors(d).length).toBeLessThanOrEqual(6);prior.copy(p);}
  });
  it("shares real bicycle physics while stopping at its own route end",()=>{
    const model=new RoadPhysics(alpineMap);model.distance=alpineLength-1;model.lastSafe=model.distance;model.speed=12;
    for(let i=0;i<90;i++)model.step(1/90,{});
    expect(model.distance).toBe(alpineLength);expect(model.ended).toBe(true);expect(model.speed).toBe(0);
  });
  it("can ride the complete independent descent without a stuck bend or invalid simulation",()=>{
    const model=new RoadPhysics(alpineMap);let elapsed=0;
    while(!model.ended&&elapsed<1400){model.step(1/30,{pedal:true});elapsed+=1/30;expect(Number.isFinite(model.speed)).toBe(true);expect(Math.abs(model.offset)).toBeLessThanOrEqual(2.24);}
    expect(model.ended).toBe(true);expect(elapsed).toBeGreaterThan(600);expect(elapsed).toBeLessThan(1400);
  });
  it("aligns the usable roadbed, ground and original image-independent geometry",()=>{
    setAlpineHeightfield(JSON.parse(readFileSync("public/media/alpine/terrain.json","utf8")));
    const p=new Vector3(),t=new Vector3();for(const d of [0,300,1700,4200,7600]){sampleAlpine(d,p,t);expect(Math.abs(alpineGround(p.x,p.z)-p.y)).toBeLessThan(.75);}
    const g=alpineRibbon(0,100,6.4);expect(g.getAttribute("uv").count).toBe(g.getAttribute("position").count);g.dispose();
  });
});
