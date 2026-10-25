import { describe, expect, it, vi, afterEach } from "vitest";
import { courtSets, courtSetLayout, normalizeCourtSet, useCourtSet, type CourtSetId } from "../src/worlds/court/courtSets";
import { worldBounds, worldFootprints } from "../src/worlds/worldConfig";
import { HOOPS } from "../src/worlds/basketballPhysics";
import { courtLines, chainLinkGeometry } from "../src/worlds/court/CourtVenue";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("original selectable court spaces", () => {
  it("adds a persistent rooftop choice alongside every existing venue", () => {
    expect(normalizeCourtSet('rooftop')).toBe('rooftop');
    expect(Object.keys(courtSets)).toEqual(expect.arrayContaining(['park','blacktop','retro-arena','practice-gym']));
    const previous=useCourtSet.getState().selected;
    try{useCourtSet.getState().setCourt(normalizeCourtSet('rooftop'));expect(useCourtSet.getState().selected).toBe('rooftop');}
    finally{useCourtSet.getState().setCourt(previous);}
  });
  it("keeps original hoop obstacles and bounds while removing invisible park benches from other courts", () => {
    const previous = useCourtSet.getState().selected, originalBounds = worldBounds("basketball");
    const hoops = [{ x: 0, z: -14.8, halfWidth: .55, halfDepth: 1.6 }, { x: 0, z: 14.8, halfWidth: .55, halfDepth: 1.6 }];
    try {
      expect(originalBounds).toEqual([-11.5, 11.5, -17.4, 17.4]);
      for (const id of Object.keys(courtSets) as CourtSetId[]) {
        useCourtSet.getState().setCourt(id);
        const footprints = worldFootprints("basketball")!;
        expect(footprints).toHaveLength(id === "park" ? 6 : 2);
        expect(footprints.slice(0, 2)).toEqual(hoops);
        expect(worldBounds("basketball")).toEqual(originalBounds);
        if (id !== "park") expect(footprints.some(item => Math.abs(item.x) === 10.2 && Math.abs(item.z) === 5)).toBe(false);
      }
    } finally { useCourtSet.getState().setCourt(previous); }
  });
  it("keeps all court markings front-facing from the player side of the surface", () => {
    const geometry = courtLines();
    try {
      const normals = geometry.getAttribute("normal"), positions = geometry.getAttribute("position");
      expect(normals.count).toBeGreaterThan(100);
      for (let i = 0; i < normals.count; i++) { expect(normals.getY(i)).toBeGreaterThan(.99); expect(positions.getY(i)).toBeCloseTo(.019); }
    } finally { geometry.dispose(); }
  });
  it("keeps park as the original default and rejects unknown or inherited choices", () => {
    for (const invalid of [undefined, null, "", "constructor", "__proto__", "nba-arena", {}]) expect(normalizeCourtSet(invalid)).toBe("park");
    for (const id of Object.keys(courtSets)) expect(normalizeCourtSet(id)).toBe(id);
    expect(courtSetLayout("park")).toEqual({ floor: [], structure: [], seats: [], windows: [], lamps: [], facades: [], gear: [] });
    expect(courtSets.park.indoor).toBe(false); expect(courtSets.blacktop.indoor).toBe(false);
    expect(courtSets["retro-arena"].indoor).toBe(true); expect(courtSets["practice-gym"].indoor).toBe(true);
  });
  it("provides distinct real forms without exceeding the original box-triangle budget", () => {
    const city = courtSetLayout("blacktop"), arena = courtSetLayout("retro-arena"), gym = courtSetLayout("practice-gym"),roof=courtSetLayout('rooftop');
    expect(city.floor).toHaveLength(0); expect(city.seats).toHaveLength(0); expect(city.windows.length).toBeGreaterThan(40);
    expect(arena.seats.length).toBeGreaterThan(400); expect(gym.seats).toHaveLength(0); expect(gym.windows).toHaveLength(16);
    // 原预算为 1500 个盒体，即 18000 三角形；窄板改为每块两三角形的平面，按真实几何预算计算。
    for (const layout of [city, arena, gym,roof]) {
      const boxes = layout.structure.length + layout.seats.length + layout.windows.length + layout.lamps.length + layout.facades.length;
      const gear = layout.gear.reduce((sum, item) => sum + (item.kind === "bag" ? 496 : 88), 0);
      const roofDetails=layout===roof?12+roof.windows.filter((_,i)=>i%4===0||i%7===0).length*2:0;
      expect(layout.floor.length * 2 + boxes * 12 + gear+roofDetails).toBeLessThan(18000);
      expect(layout.floor.length).toBeLessThan(4000);
    }
  });
  it("uses real thin staggered hardwood dimensions and covers the original court", () => {
    for (const id of ["retro-arena", "practice-gym"] as const) {
      const floor = courtSetLayout(id).floor, joints = new Map<number, number>();
      let area = 0, fullLength = 0;
      for (const board of floor) {
        expect(board.scale[0]).toBeGreaterThanOrEqual(.08); expect(board.scale[0]).toBeLessThanOrEqual(.16);
        if (board.scale[2] >= 2 && board.scale[2] <= 3) fullLength++;
        if (!joints.has(board.position[0])) joints.set(board.position[0], board.position[2] + board.scale[2] * .5);
        area += board.scale[0] * board.scale[2];
      }
      expect(fullLength / floor.length).toBeGreaterThan(.80);
      expect(new Set(joints.values()).size).toBeGreaterThan(15);
      expect(area).toBeGreaterThan(24 * 36 * .98);
    }
  });
  it("keeps the diamond wire outside navigation bounds and leaves the return gate open", () => {
    const geometry = chainLinkGeometry();
    try {
      const position = geometry.getAttribute("position"); expect(position.count).toBeGreaterThan(2000); expect(position.count).toBeLessThan(6000);
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        expect([x, y, z].every(Number.isFinite)).toBe(true);
        expect(Math.abs(x) >= 13.2 || Math.abs(z) >= 18).toBe(true);
        expect(y).toBeGreaterThanOrEqual(.11999); expect(y).toBeLessThanOrEqual(3.32001);
        if (z > 18) expect(Math.abs(x)).toBeGreaterThanOrEqual(2.29999);
      }
    } finally { geometry.dispose(); }
  });

  for (const id of Object.keys(courtSets) as CourtSetId[]) it(id + " keeps scenery outside the physical playing area and wood finite", () => {
    const layout = courtSetLayout(id);
    for (const group of ["structure", "seats", "windows", "lamps", "facades", "gear"] as const) for (const item of layout[group]) {
      const [x, y, z] = item.position, [sx, sy, sz] = item.scale;
      expect([...item.position, ...item.scale].every(Number.isFinite)).toBe(true);
      expect(item.scale.every(value => value > 0)).toBe(true);
      if (y - sy / 2 < 3) expect(Math.abs(x) - sx / 2 >= 12 || Math.abs(z) - sz / 2 >= 18).toBe(true);
    }
    for (const item of layout.floor) {
      expect(item.position[1] + item.scale[1] / 2).toBeCloseTo(.006);
      expect(Math.abs(item.position[0]) + item.scale[0] / 2).toBeLessThanOrEqual(12);
      expect(Math.abs(item.position[2]) + item.scale[2] / 2).toBeLessThanOrEqual(18);
    }
    expect(HOOPS).toEqual([{ x: 0, y: 3.05, z: -12.1 }, { x: 0, y: 3.05, z: 12.1 }]);
  });
  it("remembers the selected court without touching gameplay or private profile storage", async () => {
    const values = new Map([["existing-library", "untouched"], ["memory-palace:athlete-appearance:v1", "private-profile"], ["memory-palace:court-set:v1", "practice-gym"]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    vi.resetModules(); const { useCourtSet } = await import("../src/worlds/court/courtSets");
    expect(useCourtSet.getState().selected).toBe("practice-gym");
    useCourtSet.getState().setCourt("retro-arena");
    expect(values.get("memory-palace:court-set:v1")).toBe("retro-arena");
    expect(values.get("existing-library")).toBe("untouched"); expect(values.get("memory-palace:athlete-appearance:v1")).toBe("private-profile");
    vi.resetModules(); expect((await import("../src/worlds/court/courtSets")).useCourtSet.getState().selected).toBe("retro-arena");
    vi.stubGlobal("localStorage", { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("denied"); } });
    vi.resetModules(); const denied = (await import("../src/worlds/court/courtSets")).useCourtSet;
    expect(denied.getState().selected).toBe("park");
    expect(() => denied.getState().setCourt("blacktop")).not.toThrow(); expect(denied.getState().selected).toBe("blacktop");
  });
});
