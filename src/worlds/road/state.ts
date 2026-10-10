import { create } from "zustand";
import { Euler, type Camera } from "three";
import { forestMap, isRideScene } from "./maps";
import type { RideMap } from "./mapTypes";
import { readRideDistance, routeLength } from "../cyclingRoute";
import type { RidingState } from "./physics";

export const useRoadRide=create<{
  mounted:boolean; state:RidingState; nearBike:boolean;speed:number;distance:number;cadence:number;gear:number;grade:number;
  photo:boolean; controls:boolean; easy:boolean; comfort:boolean; place:string;gearSequence:number;recovery:boolean;
}>(()=>({mounted:false,state:"stopped",nearBike:false,speed:0,distance:0,cadence:0,gear:7,grade:0,photo:false,controls:false,easy:false,comfort:false,place:"",gearSequence:0,recovery:false}));
export type RoadCommand="mount"|"dismount"|"pedal"|"brake"|"stop"|"photo"|"save"|"easier"|"harder"|"restart";
export function roadCommand(detail:RoadCommand){window.dispatchEvent(new CustomEvent("palace:road",{detail}));}
export const roadView={active:false,mounted:false,yaw:0,pitch:0,roll:0,baseYaw:0,basePitch:0,headYaw:0,headPitch:0,lookPending:false,distance:0,speed:0,offset:0,lean:0,steer:0,brake:0,cadence:0,walkX:0,walkY:18,walkZ:0,mountProgress:0,parkYaw:-.4};
export interface RoadCinemaReturn {mapId?:string;distance:number;gear:number;offset:number;heading:number;headYaw:number;headPitch:number;yaw:number;pitch:number;roll:number;mounted:boolean;photo:boolean;comfort:boolean}
let cinemaReturn:RoadCinemaReturn|null=null;
// Cinema 的同次访问保留骑姿与朝向，速度安全归零；不写数据库，不在刷新后自动上车。
export function rememberRoadCinema(value:RoadCinemaReturn){cinemaReturn={...value};}
export function takeRoadCinemaReturn(){const result=cinemaReturn;cinemaReturn=null;return result;}
export function peekRoadCinemaReturn(mapId="cycling"){return (cinemaReturn?.mapId??"cycling")===mapId?cinemaReturn:null;}
export function roadTravel(previous:string,next:string){if(isRideScene(next)&&previous!=="cinema"||previous==="cinema"&&!isRideScene(next)||isRideScene(previous)&&next!=="cinema")cinemaReturn=null;}
const look=new Euler(0,0,0,"YXZ");
export function applyRoadLook(camera:Camera,userAngle:Euler){
  if(!roadView.active||!roadView.mounted)return false;
  if(roadView.lookPending){roadView.baseYaw=userAngle.y-roadView.headYaw;roadView.basePitch=userAngle.x-roadView.headPitch;roadView.lookPending=false;}
  const yaw=Math.atan2(Math.sin(userAngle.y-roadView.baseYaw),Math.cos(userAngle.y-roadView.baseYaw));
  const photo=useRoadRide.getState().photo;
  const targetYaw=photo?yaw:Math.max(-1.15,Math.min(1.15,yaw));
  roadView.headYaw+=Math.atan2(Math.sin(targetYaw-roadView.headYaw),Math.cos(targetYaw-roadView.headYaw))*.3;
  roadView.headPitch=Math.max(photo?-.95:-.65,Math.min(photo?.95:.5,userAngle.x-roadView.basePitch));
  look.set(roadView.pitch+roadView.headPitch,roadView.yaw+roadView.headYaw,roadView.roll,"YXZ");camera.quaternion.setFromEuler(look);return true;
}
export function readRoadSave(map:RideMap=forestMap){
  const roadLength=map.length;
  try {
    const saved=JSON.parse(localStorage.getItem(map.saveKey)??"null");
    if(saved?.route===(map.id==="cycling"?2:1)&&Number.isFinite(saved.distance)&&saved.distance>=0&&saved.distance<roadLength)return {distance:saved.distance,gear:Math.max(1,Math.min(12,Math.round(Number(saved.gear)||7))),comfort:!!saved.comfort};
  }catch{/* 禁用存储时仍可完整骑行，不影响媒体数据库。 */}
  // 只读取旧短环路的相对进度；保留 v1 键与所有 IndexedDB 数据，绝不清库。
  return {distance:map.id==="cycling"?readRideDistance()/routeLength*roadLength:0,gear:7,comfort:false};
}
export function saveRoadRide(distance:number,gear:number,comfort:boolean,map:RideMap=forestMap){
  const roadLength=map.length;
  try{localStorage.setItem(map.saveKey,JSON.stringify({route:map.id==="cycling"?2:1,distance:Math.max(0,Math.min(roadLength-.01,distance)),gear,comfort}));}catch{/* 本机存储不可用时，不上传或写入替代服务器。 */}
}
