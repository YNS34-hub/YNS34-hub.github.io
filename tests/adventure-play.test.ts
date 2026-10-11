import { describe, expect, it, vi, afterEach } from "vitest";
import { Bone, Vector3 } from "three";
import { readFileSync } from "node:fs";
import { LimbIK } from "../src/worlds/presence/ik";
import { BallPhysics, HOOPS } from "../src/worlds/basketballPhysics";
import { FinishMotion, finishEligibility } from "../src/worlds/court/finishing";
import { followPose, pedalPoint } from "../src/worlds/presence/math";
import { roadSample, roadRibbon } from "../src/worlds/road/route";
import { sampleAlpine, alpineRibbon } from "../src/worlds/alpine/route";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const approach = { held: true, position: { x: -.35, y: 1.65, z: -9.7 }, direction: { x: 0, y: .1, z: -1 }, speed: 5.2, hand: 1 };
describe("non-destructive outdoor presence", () => {
  it("extends only visible road ribbons behind the unchanged physical route start", () => {
    for(const [sample,ribbon] of [[roadSample,roadRibbon],[sampleAlpine,alpineRibbon]] as const){
      const start=new Vector3(),direction=new Vector3(),clamped=new Vector3();sample(0,start,direction);sample(-12,clamped,new Vector3());
      expect(clamped.distanceTo(start)).toBeLessThan(.001);
      const geometry=ribbon(-12,24,6.4),vertices=geometry.getAttribute("position");
      const centre=new Vector3().fromBufferAttribute(vertices,0).add(new Vector3().fromBufferAttribute(vertices,1)).multiplyScalar(.5);
      expect(centre.distanceTo(start.clone().addScaledVector(direction,-12))).toBeLessThan(.001);
      for(let i=0;i<vertices.count;i++)expect(Number.isFinite(vertices.getY(i))).toBe(true);
      geometry.dispose();
    }
  });
  it("changes only perspective preferences and preserves denied-storage usability", async () => {
    const values = new Map([["existing-library", "untouched"]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    const { usePerspective } = await import("../src/worlds/presence/state");
    usePerspective.getState().setView("basketball", "third");
    expect(usePerspective.getState().views.basketball).toBe("third"); expect(usePerspective.getState().views.cycling).toBe("first");
    expect(values.get("existing-library")).toBe("untouched");
    vi.stubGlobal("localStorage", { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("denied"); } });
    usePerspective.getState().setView("cycling", "third"); expect(usePerspective.getState().views.cycling).toBe("third");
  });
  it("computes a follow pose without moving the logical body or corrupting first-person pitch", () => {
    const eye = new Vector3(3, 1.65, 5), direction = new Vector3(.3, .25, -1).normalize(), point = new Vector3(), target = new Vector3();
    const saved = eye.clone(); followPose(eye, direction, "third", false, point, target);
    expect(eye.equals(saved)).toBe(true); expect(point.distanceTo(eye)).toBeGreaterThan(3); expect(point.y).toBeGreaterThan(eye.y);
    followPose(eye, direction, "first", false, point, target); expect(point.equals(eye)).toBe(true); expect(target.y).toBeGreaterThan(point.y);
  });
  it("keeps both rider feet on opposite phases of the real crank trajectory", () => {
    const left = new Vector3(), right = new Vector3();
    for (let angle = 0; angle < Math.PI * 8; angle += .17) {
      pedalPoint(-1, angle, left); pedalPoint(1, angle, right);
      expect(left.y + right.y).toBeCloseTo(.58); expect(left.z + right.z).toBeCloseTo(.16);
      expect(Math.hypot(right.y - .29, right.z - .08)).toBeCloseTo(.16);
    }
  });
  it("responds to third-person look pitch while keeping the athlete at the same physical eye position",()=>{
    const eye=new Vector3(0,1.65,0),p=new Vector3(),t=new Vector3();
    followPose(eye,new Vector3(0,0,-1),"third",false,p,t);const levelCamera=p.y,levelTarget=t.y;
    followPose(eye,new Vector3(0,.4,-1).normalize(),"third",false,p,t);expect(p.y).toBeLessThan(levelCamera);expect(t.y).toBeGreaterThan(levelTarget);expect(eye.y).toBe(1.65);
  });
  it("solves connected limbs without stretching and safely clamps an unreachable target", () => {
    const top=new Bone(),middle=new Bone(),end=new Bone(),ik=new LimbIK();
    top.add(middle);middle.add(end);middle.position.y=-.42;end.position.y=-.43;top.updateWorldMatrix(true,true);
    const target=new Vector3(.2,-.65,-.2),pole=new Vector3(0,-.2,-1),actual=new Vector3();
    ik.solve(top,middle,end,target,pole);end.getWorldPosition(actual);expect(actual.distanceTo(target)).toBeLessThan(.002);
    expect(middle.position.length()).toBeCloseTo(.42);expect(end.position.length()).toBeCloseTo(.43);
    ik.solve(top,middle,end,new Vector3(2,-2,-2),pole);end.getWorldPosition(actual);
    expect(actual.length()).toBeLessThanOrEqual(.851);expect([...top.quaternion.toArray(),...middle.quaternion.toArray()].every(Number.isFinite)).toBe(true);
  });
  it("ships a credited skinned athlete with real locomotion clips and only local texture references", () => {
    const model=JSON.parse(readFileSync(new URL("../public/media/presence/athlete.gltf",import.meta.url),"utf8"));
    expect(model.skins.length).toBe(1);expect(model.animations.map((a:{name:string})=>a.name)).toEqual(["idle","walk","run"]);
    expect(model.images.every((image:{uri:string})=>/^\.\/?[a-z-]+\.webp$|^[a-z-]+\.webp$/.test(image.uri))).toBe(true);
    expect(readFileSync(new URL("../public/media/presence/SOURCES.md",import.meta.url),"utf8")).toContain("MIT");
  });
});
describe("physical close-range finishes", () => {
  it("requires a held ball, range, facing and a genuine running approach for a dunk", () => {
    expect(finishEligibility("dunk", approach).allowed).toBe(true);
    expect(finishEligibility("dunk", { ...approach, held: false }).allowed).toBe(false);
    expect(finishEligibility("dunk", { ...approach, speed: 0 }).allowed).toBe(false);
    expect(finishEligibility("layup", { ...approach, position: { x: 0, y: 1.65, z: 0 } }).allowed).toBe(false);
    expect(finishEligibility("layup", { ...approach, direction: { x: 0, y: 0, z: 1 } }).allowed).toBe(false);
    for(const z of[-13.5,13.5])expect(finishEligibility("dunk",{...approach,position:{x:0,y:1.65,z},direction:{x:0,y:0,z:-Math.sign(z)}}).reason).toMatch(/court side/);
  });
  for (const kind of ["layup", "dunk"] as const) it(kind + " releases once and scores only after the original ball crosses the rim", () => {
    const motion = new FinishMotion(), ball = new BallPhysics(); ball.pickup();
    expect(motion.start(kind, approach).allowed).toBe(true);
    let launches = 0, events: string[] = [];
    for (let time = 0; time < 3; time += 1 / 120) {
      const pose = motion.advance(1 / 120);
      if (pose?.release) { launches++; ball.launch(pose.release.origin, pose.release.velocity); expect(ball.stats.made).toBe(0); }
      events = events.concat(ball.step(1 / 120));
    }
    expect(launches).toBe(1); expect(ball.stats.shots).toBe(1); expect(ball.stats.made).toBe(1); expect(events.filter(e => e === "made")).toHaveLength(1);
    expect(motion.active).toBe(false); expect(HOOPS[0].y).toBe(3.05);
  });
  it("freezes on pause and can cancel before release without generating a shot", () => {
    const motion = new FinishMotion(); motion.start("dunk", approach); motion.advance(.1);
    const elapsed = motion.elapsed; for (let i = 0; i < 20; i++) expect(motion.advance(.06, true)?.release).toBeUndefined();
    expect(motion.elapsed).toBe(elapsed); motion.cancel(); expect(motion.active).toBe(false); expect(motion.advance(.06)).toBeNull();
  });
});
