import { describe, expect, it } from "vitest";
import { Quaternion, Vector3, Bone, SkinnedMesh, BufferGeometry, MeshStandardMaterial } from "three";
import { riderAnkle, ankleFromContact, settleCranks } from "../src/worlds/presence/riderPose";
import { pedalPoint } from "../src/worlds/presence/math";
import { createRiderOutline } from "../src/worlds/presence/riderOutline";

describe("rider contact and silhouette ownership", () => {
  it("keeps a shoe contact fixed to the real crank circle throughout ankle motion", () => {
    const pedal=new Vector3(),ankle=new Vector3(),offset=new Vector3(0,-.112,-.064),orientation=new Quaternion();
    for(let phase=0;phase<Math.PI*2;phase+=.07)for(const side of[-1,1]){
      pedalPoint(side,phase,pedal);orientation.setFromAxisAngle(new Vector3(1,0,0),riderAnkle(side,phase,1,false));
      ankleFromContact(pedal,offset,orientation,ankle);
      expect(ankle.clone().add(offset.clone().applyQuaternion(orientation)).distanceTo(pedal)).toBeLessThan(1e-9);
    }
  });
  it("uses opposite foot phases and removes cosmetic ankle motion while coasting / in comfort", () => {
    expect(riderAnkle(1,1,0,false)).toBe(0);expect(riderAnkle(1,1,1,true)).toBe(0);
    expect(riderAnkle(1,.8,1,false)).toBeCloseTo(-riderAnkle(-1,.8,1,false));
  });
  it("levels the shared crank while coasting and keeps actual pedaling / parked phases intact", () => {
    let phase=15*Math.PI+.8;for(let i=0;i<240;i++)phase=settleCranks(phase,0,9,1/60);
    expect(phase).toBeCloseTo(15*Math.PI,6);
    expect(settleCranks(1.2,90,9,.06)).toBe(1.2);expect(settleCranks(1.2,0,0,.06)).toBe(1.2);
    expect(settleCranks(1.2,0,9,0)).toBe(1.2);
  });
  it("shares the exact deforming geometry and skeleton and releases only the outline material", () => {
    const geometry=new BufferGeometry(),material=new MeshStandardMaterial(),source=new SkinnedMesh(geometry,material);
    const bone=new Bone();source.add(bone);
    const outline=createRiderOutline(),shell=outline.attach(source);let own=0,shared=0;
    outline.material.addEventListener("dispose",()=>own++);geometry.addEventListener("dispose",()=>shared++);material.addEventListener("dispose",()=>shared++);
    expect(shell.geometry).toBe(source.geometry);expect(shell.skeleton).toBe(source.skeleton);
    expect(shell.castShadow).toBe(false);expect(shell.material).toBe(outline.material);
    outline.dispose();outline.dispose();expect(own).toBe(1);expect(shared).toBe(0);expect(source.children).toEqual([bone]);
    outline.activate();expect(shell.parent).toBe(source);outline.dispose();expect(own).toBe(2);expect(shared).toBe(0);
  });
});
