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
  it("keeps accepted forest source apart from declared approach, surface and authorized scenic adapters",()=>{
    const files={"Landscape.tsx":"e3cf62583056b1e456224dd96c8c92b3927d0a801f127e12842536fadd1fdf1d","Environment.tsx":"6b3635d1ee9cb985b02feedb4e5033cc46c707cd6c0fac2944f321f8b1845190","route.ts":"461930b1630198c802e11052692c7f3b4c6d361d3f1395f82fe6dfda0548be53"};
    const adapters={
      "Landscape.tsx":["    const roadStart=index===0?-12:start;\n    const road=roadRibbon(roadStart,end,6.4),edges=[roadRibbon(roadStart,end,.1,-2.95,.012),roadRibbon(roadStart,end,.1,2.95,.012)];","    const road=roadRibbon(start,end,6.4),edges=[roadRibbon(start,end,.1,-2.95,.012),roadRibbon(start,end,.1,2.95,.012)];"],
      "route.ts":["    const d=start+(end-start)*i/n;roadSample(d,p,tangent);\n    // 仅展面向起点后方延续；路线进度与物理采样仍保持 [0, length] 的原边界。\n    if(d<0)p.addScaledVector(tangent,d);\n    const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);","    const d=start+(end-start)*i/n;roadSample(d,p,tangent);const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);"]
    };
    for(const [file,digest] of Object.entries(files)){
      let source=readFileSync("src/worlds/road/"+file,"utf8").replace(/\r\n/g,"\n");
      // 本轮明确授权高山设置和曲柄视觉相位；只撤销局部接入，原摘要和路线保护继续运行。
      const sunlight=JSON.parse(readFileSync("tests/fixtures/alpine-clarity-adapters.json","utf8")) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
      expect(sunlight.baseline).toBe("8a66c0083483f5dd9bf33df1903f060401f04cea");
      for(const patch of sunlight.files[file]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
      // 第二轮只撤销获准的道路边缘 diff，再继续第一轮和最初的源码保护；旧摘要与旧补丁不变。
      const roadside=JSON.parse(readFileSync("tests/fixtures/cycling-road-adapters.json","utf8")) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
      expect(roadside.baseline).toBe("f9f0346bc3efad98f173854b979281a6496c5414");
      for(const patch of roadside.files[file]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
      // 本轮用户明确授权环境美术修改。先逐段撤销记录的视觉 diff，再沿用旧补丁和原始摘要，不扩大到物理或导航。
      const art=JSON.parse(readFileSync("tests/fixtures/cycling-art-adapters.json","utf8")) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
      expect(art.baseline).toBe("48303b694e149f18b3d580fbc0d2ce1bc99cf730");
      for(const patch of art.files[file]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
      if(file==="Landscape.tsx"){
        // 显式保存局部材质/草根补丁的前后文本；其余源码仍由原摘要约束，不刷新原摘要。
        const surfaces=JSON.parse(readFileSync("tests/fixtures/forest-surface-adapters.json","utf8")) as {id:number;before:string;after:string}[];
        expect(surfaces.map(s=>s.id)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]);
        for(const patch of surfaces){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
      }
      const adapter=adapters[file as keyof typeof adapters];
      if(adapter){expect(source.split(adapter[0])).toHaveLength(2);source=source.replace(adapter[0],adapter[1]);}
      // 仍对其余完整源码使用原始摘要，不能刷新摘要来隐藏其他场景改写。
      expect(createHash("sha256").update(source).digest("hex")).toBe(digest);
    }
  });
});
