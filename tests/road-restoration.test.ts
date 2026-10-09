import {beforeEach,describe,expect,it,vi} from "vitest";
import {roadLength} from "../src/worlds/road/route";
import {routeLength} from "../src/worlds/cyclingRoute";
import {readRoadSave,saveRoadRide,rememberRoadCinema,peekRoadCinemaReturn,takeRoadCinemaReturn,roadTravel} from "../src/worlds/road/state";
const saved=new Map<string,string>();
beforeEach(()=>{saved.clear();vi.stubGlobal("localStorage",{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)});roadTravel("cinema","worlds");});
describe("road persistence without destructive migration",()=>{
 it("reads legacy progress, preserves its key and unrelated libraries, then writes only v2",()=>{
  const legacy=JSON.stringify({distance:routeLength*.4});saved.set("memory-palace:ride:v1",legacy);saved.set("museum-other-data","unchanged");
  expect(readRoadSave().distance).toBeCloseTo(roadLength*.4);saveRoadRide(555,3,true);
  expect(readRoadSave()).toEqual({distance:555,gear:3,comfort:true});expect(saved.get("memory-palace:ride:v1")).toBe(legacy);expect(saved.get("museum-other-data")).toBe("unchanged");
 });
 it("rejects malformed and out-of-route saves, normalizes gears and works with denied storage",()=>{
  saved.set("memory-palace:road:v2","bad");expect(readRoadSave().distance).toBe(0);
  saved.set("memory-palace:road:v2",JSON.stringify({route:2,distance:roadLength+1}));expect(readRoadSave().distance).toBe(0);
  saved.set("memory-palace:road:v2",JSON.stringify({route:2,distance:50,gear:22}));expect(readRoadSave().gear).toBe(12);
  vi.stubGlobal("localStorage",{getItem:()=>{throw new Error("Denied");},setItem:()=>{throw new Error("Denied");}});expect(readRoadSave().distance).toBe(0);expect(()=>saveRoadRide(20,2,false)).not.toThrow();
 });
 it("restores only a direct Cinema roundtrip, consumes once and never remounts from a fresh room",()=>{
  const pose={distance:123,gear:3,offset:.4,heading:.02,headYaw:.2,headPitch:.1,mounted:true,photo:false,comfort:true};
  rememberRoadCinema(pose);roadTravel("cycling","cinema");roadTravel("cinema","cycling");expect(peekRoadCinemaReturn()).toEqual(pose);expect(takeRoadCinemaReturn()).toEqual(pose);expect(takeRoadCinemaReturn()).toBeNull();
  rememberRoadCinema(pose);roadTravel("cinema","atrium");expect(peekRoadCinemaReturn()).toBeNull();rememberRoadCinema(pose);roadTravel("worlds","cycling");expect(peekRoadCinemaReturn()).toBeNull();
 });
});
