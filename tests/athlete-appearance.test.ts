import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAvatarProfile } from "../src/worlds/presence/avatarProfile.mjs";
import { gripPoint, riderPosture } from "../src/worlds/presence/riderPose";
import { reshapeAthlete, reshapeAthletePoint, sleeveCoverage } from "../src/worlds/presence/appearanceRig";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerPersonalAvatar } from "../scripts/register-personal-avatar.mjs";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("local avatar and wardrobe", () => {
  it("clamps malformed profile values and drops any paths or executable data", () => {
    expect(validateAvatarProfile(null)).toBeNull(); expect(validateAvatarProfile({ version: 2 })).toBeNull();
    const value = validateAvatarProfile({ version: 1, arms: Infinity, chest: 4, nose: -8, skin: "javascript:alert(1)", hair: "#141819", photo: "C:/private/photo.jpg", script: "evil" })!;
    expect(value.chest).toBe(1.15); expect(value.nose).toBe(.75); expect(value.arms).toBe(1); expect(value.hair).toBe("#141819");
    expect(JSON.stringify(value)).not.toMatch(/private|script|evil/);
  });
  it("retains selected outfits per map and all existing library data after refresh", async () => {
    const data = new Map([["old-library", "untouched"]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    let module = await import("../src/worlds/presence/appearance");
    module.useAppearance.getState().select("basketball", "training-blue");
    module.useAppearance.getState().select("cycling", "cap-denim");
    vi.resetModules(); module = await import("../src/worlds/presence/appearance");
    expect(module.useAppearance.getState().selected).toEqual({ basketball: "training-blue", cycling: "cap-denim", "alpine-ride": "road-pearl" });
    expect(data.get("old-library")).toBe("untouched");
    vi.stubGlobal("localStorage", { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("denied"); } });
    module.useAppearance.getState().select("basketball", "street-black"); expect(module.useAppearance.getState().selected.basketball).toBe("street-black");
  });
  it("compiles a clean public stub without reading / copying original photos or a private profile", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "palace-avatar-")), output = path.join(root, "public/personal-media");
    try {
      await mkdir(path.join(root, "personal-media/avatar"), { recursive: true }); await mkdir(output, { recursive: true });
      const privateFile = path.join(root, "personal-media/avatar/profile.json"), original = JSON.stringify({ version: 1, shoulders: 1.09, photo: "private.jpg" });
      await writeFile(privateFile, original); await writeFile(path.join(root, "personal-media/avatar/private.jpg"), "unchanged private source");
      const atlas=path.join(root,"personal-media/avatar/head-color.png"), png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==","base64");await writeFile(atlas,png);
      await registerPersonalAvatar(root, output, false); expect(JSON.parse(await readFile(path.join(output, "avatar.json"), "utf8")).profile.shoulders).toBe(1.09);
      expect(JSON.parse(await readFile(path.join(output,"avatar.json"),"utf8")).head).toBe("/personal-media/avatar-head.png");expect(await readFile(path.join(output,"avatar-head.png"))).toEqual(png);
      // 独立的干净 public 输出不能读取或复制私人 atlas，旧图库数据库也不涉及此流程。
      const clean=path.join(root,"release");await mkdir(clean);await registerPersonalAvatar(root,clean,true);expect(await readdir(clean)).toEqual(["avatar.json"]);
      await registerPersonalAvatar(root, output, true); expect(JSON.parse(await readFile(path.join(output, "avatar.json"), "utf8"))).toEqual({ profile: null });
      expect(await readdir(output)).toEqual(["avatar.json"]);
      expect(await readFile(privateFile, "utf8")).toBe(original); expect(await readFile(path.join(root, "personal-media/avatar/private.jpg"), "utf8")).toBe("unchanged private source");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("changes visible body / hair outline while preserving bounded, finite topology positions", () => {
    const profile = validateAvatarProfile({ version: 1, chest: 1.08, waist: .94, hairCrop: .46 })!;
    const chest = reshapeAthletePoint(20, -8, 134, profile), waist = reshapeAthletePoint(18, -6, 105, profile), head = reshapeAthletePoint(0, -6, 180, profile);
    expect(chest[0]).toBeGreaterThan(20); expect(waist[0]).toBeLessThan(18); expect(head[2]).toBeLessThan(180);
    for (let h = 0; h < 185; h += 4) expect(reshapeAthletePoint(12, -9, h, profile).every(Number.isFinite)).toBe(true);
  });
  it("preserves authored smooth normals on split triangles and owns the deformed geometry", () => {
    const source = new BufferGeometry(); source.setAttribute("position", new Float32BufferAttribute([1,0,80,2,0,80,1,0,81], 3)); source.setAttribute("normal", new Float32BufferAttribute([.6,.8,0,.6,.8,0,.6,.8,0], 3));
    const profile = validateAvatarProfile({ version:1 })!, own = reshapeAthlete(source,profile);
    expect(own).not.toBe(source); expect(own.getAttribute("position")).not.toBe(source.getAttribute("position"));
    for (let i=0;i<3;i++) { expect(own.getAttribute("normal").getX(i)).toBeCloseTo(.6); expect(own.getAttribute("normal").getY(i)).toBeCloseTo(.8); }
    own.dispose(); expect(source.getAttribute("normal").getY(0)).toBeCloseTo(.8); source.dispose();
  });
  it("keeps sleeve coverage across separate UV islands while leaving palms and fingers uncovered", () => {
    const source = new BufferGeometry(); source.setAttribute("position", new Float32BufferAttribute([0,0,0,1,1,1,2,2,2],3));
    source.setAttribute("skinIndex", new Float32BufferAttribute([0,1,0,0,2,0,0,0,3,0,0,0],4));
    source.setAttribute("skinWeight", new Float32BufferAttribute([.6,.4,0,0,1,0,0,0,1,0,0,0],4));
    const names = ["Bip01_L_Clavicle","Bip01_L_UpperArm","Bip01_L_Hand","Bip01_L_Finger1"], mask=sleeveCoverage(source,names);
    expect(mask.getX(0)).toBeCloseTo(1); expect(mask.getX(1)).toBe(0); expect(mask.getX(2)).toBe(0);
    expect(source.getAttribute("skinWeight").getX(0)).toBeCloseTo(.6); source.dispose();
  });
});
describe("video-informed cycling posture", () => {
  it("uses a more upright torso and the actual matching higher city grips", () => {
    const city = riderPosture("city", 1, 0, .5, false), road = riderPosture("road", 1, 0, .5, false), a = new Vector3(), b = new Vector3();
    expect(Math.abs(city.spine)).toBeLessThan(Math.abs(road.spine));
    gripPoint("city", 1, 0, a); gripPoint("road", 1, 0, b); expect(a.y).toBeGreaterThan(b.y + .18); expect(a.z).toBeGreaterThan(b.z);
    expect(a.toArray()).toEqual([.265, 1.185, -.41000000000000003]);
  });
  it("drives secondary motion only from real cadence phase, and settles in silence / comfort", () => {
    expect(riderPosture("city", 0, 0, 1, false).hipShift).toBe(0);
    expect(riderPosture("city", 1, 0, 1, true).hipShift).toBe(0); expect(riderPosture("city", 1, 0, 1, true).ankle).toBe(0);
    const a = riderPosture("city", 1, 0, .8, false), b = riderPosture("city", 1, 0, .8 + Math.PI, false);
    expect(a.hipShift).toBeCloseTo(-b.hipShift); expect(Math.abs(a.hipShift)).toBeLessThan(.0061);
  });
});
