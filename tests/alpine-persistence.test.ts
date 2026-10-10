import {beforeEach,describe,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {forestMap} from "../src/worlds/road/maps";
import {alpineMap} from "../src/worlds/alpine/route";
import {readRoadSave,saveRoadRide,peekRoadCinemaReturn,rememberRoadCinema,roadTravel,takeRoadCinemaReturn} from "../src/worlds/road/state";
const storage=new Map<string,string>();
beforeEach(()=>{storage.clear();vi.stubGlobal("localStorage",{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});roadTravel("cinema","worlds");});
describe("two-map preservation",()=>{
  it("saves each map independently and leaves the original ride and private library intact",()=>{
    storage.set("private-library-marker","unchanged");saveRoadRide(820,4,true,forestMap);const old=storage.get(forestMap.saveKey);
    saveRoadRide(4200,9,false,alpineMap);expect(storage.get(forestMap.saveKey)).toBe(old);expect(readRoadSave(forestMap)).toEqual({distance:820,gear:4,comfort:true});expect(readRoadSave(alpineMap)).toEqual({distance:4200,gear:9,comfort:false});expect(storage.get("private-library-marker")).toBe("unchanged");
  });
  it("starts a new map at its own origin even when the legacy forest ride has a save",()=>{
    storage.set("memory-palace:ride:v1",JSON.stringify({distance:55}));expect(readRoadSave(alpineMap).distance).toBe(0);expect(readRoadSave(forestMap).distance).toBeGreaterThan(0);
  });
  it("rejects invalid alpine progress without clearing another map",()=>{
    saveRoadRide(35,2,false,forestMap);storage.set(alpineMap.saveKey,JSON.stringify({route:1,distance:Infinity}));expect(readRoadSave(alpineMap).distance).toBe(0);expect(readRoadSave(forestMap).distance).toBe(35);
  });
  it("returns a Cinema visit to the same map and never applies its pose to the other map",()=>{
    const pose={mapId:alpineMap.id,distance:4100,gear:6,offset:.4,heading:.01,headYaw:.2,headPitch:0,yaw:.6,pitch:0,roll:0,mounted:true,photo:true,comfort:true};
    rememberRoadCinema(pose);roadTravel("alpine-ride","cinema");roadTravel("cinema","alpine-ride");expect(peekRoadCinemaReturn("alpine-ride")).toEqual(pose);expect(peekRoadCinemaReturn("cycling")).toBeNull();expect(takeRoadCinemaReturn()).toEqual(pose);
    rememberRoadCinema(pose);roadTravel("alpine-ride","cycling");expect(peekRoadCinemaReturn("alpine-ride")).toBeNull();
  });
  it("keeps the accepted forest landscape, atmosphere and route byte-for-byte",()=>{
    const files={"Landscape.tsx":"e3cf62583056b1e456224dd96c8c92b3927d0a801f127e12842536fadd1fdf1d","Environment.tsx":"6b3635d1ee9cb985b02feedb4e5033cc46c707cd6c0fac2944f321f8b1845190","route.ts":"461930b1630198c802e11052692c7f3b4c6d361d3f1395f82fe6dfda0548be53"};
    for(const [file,digest] of Object.entries(files))expect(createHash("sha256").update(readFileSync("src/worlds/road/"+file,"utf8").replace(/\r\n/g,"\n")).digest("hex")).toBe(digest);
  });
});
