import { describe,it,expect } from "vitest";
import { Vector3 } from "three";
import { RoadPhysics } from "../src/worlds/road/physics";
import { roadLength, roadSample, roadRibbon, activeRoadSectors, lakeDistance } from "../src/worlds/road/route";
const advance=(bike:RoadPhysics,seconds:number,input:{pedal?:boolean;brake?:boolean;steer?:number},grade=0)=>{for(let i=0;i<seconds*90;i++)bike.step(1/90,input,grade);};
describe("authored road ride",()=>{
  it("has a continuous paved 5–8 minute scale route, safe water separation and a real climb",()=>{
    expect(roadLength).toBeGreaterThan(2800);expect(roadLength).toBeLessThan(4500);
    const p=new Vector3(),t=new Vector3();let max=0,min=0;
    for(let d=0;d<roadLength;d+=4){roadSample(d,p,t);expect(lakeDistance(p.x,p.z)).toBeGreaterThan(1.01);const g=t.y/Math.hypot(t.x,t.z);max=Math.max(g,max);min=Math.min(g,min);expect(Math.abs(g)).toBeLessThan(.12);}
    expect(max).toBeGreaterThan(.06);expect(min).toBeLessThan(-.06);
    const road=roadRibbon(0,160,6.4);const n=road.getAttribute("normal");for(let i=0;i<n.count;i++)expect(n.getY(i)).toBeGreaterThan(.95);road.dispose();
  });
  it("pedals through traction and drag, coasts with momentum and brakes progressively",()=>{
    const b=new RoadPhysics();advance(b,15,{pedal:true});expect(b.speed).toBeGreaterThan(6);expect(b.speed).toBeLessThan(12);
    const v=b.speed;advance(b,2,{});expect(b.speed).toBeGreaterThan(v*.8);expect(b.state).toBe("coasting");
    b.step(1/90,{brake:true},0);expect(b.speed).toBeGreaterThan(v*.7);advance(b,6,{brake:true});expect(b.speed).toBe(0);
  });
  it("gearing changes acceleration, cadence efficiency and climbing, gravity assists descending",()=>{
    const low=new RoadPhysics(),high=new RoadPhysics();low.gear=2;high.gear=12;advance(low,8,{pedal:true},.065);advance(high,8,{pedal:true},.065);expect(low.speed).toBeGreaterThan(high.speed+.5);
    low.speed=8;advance(low,8,{},-.06);expect(low.speed).toBeGreaterThan(10);expect(low.speed).toBeLessThanOrEqual(55/3.6);expect(low.state).toBe("descending");
    expect(low.shift(-100)).toBe(true);expect(low.gear).toBe(1);low.shift(100);expect(low.gear).toBe(12);
  });
  it("smooths steering and keeps high-speed response small within the natural road envelope",()=>{
    const slow=new RoadPhysics(),fast=new RoadPhysics();slow.speed=3;fast.speed=14;
    slow.step(.016,{steer:1},0);fast.step(.016,{steer:1},0);expect(fast.steering).toBeLessThan(slow.steering/3);
    advance(fast,20,{pedal:true,steer:1});expect(Math.abs(fast.offset)).toBeLessThanOrEqual(2.24);expect(Math.abs(fast.lean)).toBeLessThanOrEqual(.15);
  });
  it("bounds sectors and recovers only invalid states without background-tab jumps",()=>{
    for(let d=0;d<roadLength;d+=100){expect(activeRoadSectors(d).length).toBeLessThanOrEqual(6);expect(activeRoadSectors(d)).toContain(Math.floor(d/160));}
    const b=new RoadPhysics();b.speed=10;const d=b.distance;b.step(99,{});expect(b.distance-d).toBeLessThan(.7);
    b.lastSafe=123;b.distance=NaN;b.step(.016,{});expect(b.recovered).toBe(true);expect(b.distance).toBeCloseTo(123);expect(b.speed).toBe(0);
    const before=b.distance;b.step(.06,{blocked:true,pedal:true});expect(b.distance).toBe(before);
  });
});
