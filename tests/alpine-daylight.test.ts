import { afterEach, describe, expect, it, vi } from "vitest";
import { alpineDaylight, alpinePixelRatio } from "../src/worlds/alpine/daylight";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("alpine clarity and local visual preferences", () => {
  it("raises sunny fill and distant visibility without removing the directional hierarchy", () => {
    const sun = alpineDaylight("sunny"), cloud = alpineDaylight("cloudy");
    expect(sun.sun).toBeGreaterThan(cloud.sun); expect(sun.environment).toBeGreaterThan(.5);
    expect(sun.fog).toBeLessThan(.00008); expect(sun.fog).toBeLessThan(cloud.fog);
    expect(sun.sun / sun.hemisphere).toBeGreaterThan(2);
  });
  it("supersamples DPR 1 desktop views while bounding the 1440p pixel budget", () => {
    expect(alpinePixelRatio(1,1920,1080,true)).toBe(1.5);
    const ratio = alpinePixelRatio(1,2560,1440,true);
    expect(ratio).toBeGreaterThan(1.2); expect(2560*1440*ratio*ratio).toBeLessThanOrEqual(6_000_001);
    expect(alpinePixelRatio(1,1920,1080,false)).toBe(1);
    expect(alpinePixelRatio(2,3840,2160,true)).toBe(1);
  });
  it("persists only visual choices without changing the existing ride / private library", async () => {
    const memory = new Map([["memory-palace:alpine:v1","existing ride"],["private-library","existing media"]]);
    vi.stubGlobal("localStorage",{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value)});
    let module = await import("../src/worlds/alpine/visualPreferences");
    module.useAlpineVisuals.getState().choose({weather:"cloudy",detailed:false,outline:false});
    vi.resetModules(); module = await import("../src/worlds/alpine/visualPreferences");
    expect(module.useAlpineVisuals.getState()).toMatchObject({weather:"cloudy",detailed:false,outline:false});
    expect(memory.get("memory-palace:alpine:v1")).toBe("existing ride"); expect(memory.get("private-library")).toBe("existing media");
  });
  it("falls back safely for malformed preferences and denied storage", async () => {
    vi.stubGlobal("localStorage",{getItem:()=>'{"weather":"evil","detailed":"no","outline":0}',setItem:()=>{throw Error("denied");}});
    const {useAlpineVisuals}=await import("../src/worlds/alpine/visualPreferences");
    expect(useAlpineVisuals.getState()).toMatchObject({weather:"sunny",detailed:true,outline:true});
    expect(()=>useAlpineVisuals.getState().choose({weather:"cloudy"})).not.toThrow();
  });
});
