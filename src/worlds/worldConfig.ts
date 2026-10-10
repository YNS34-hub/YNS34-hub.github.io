import type { Camera } from "three";
import type { Footprint } from "../world/collision";
import { roadView, readRoadSave } from "./road/state";
import {getRideMap,isRideScene} from "./road/maps";
import { Vector3 } from "three";

export const isWorldScene = (id: string) => id === "worlds" || id === "basketball" || isRideScene(id);
export function worldBounds(id: string): [number, number, number, number] | undefined {
  if (id === "basketball") return [-11.5, 11.5, -17.4, 17.4];
  if (id === "worlds") return [-12, 12, -13, 15.6];
  if (isRideScene(id)) return [roadView.walkX-4.4,roadView.walkX+4.4,roadView.walkZ-9,roadView.walkZ+10.5];
}
export function worldFootprints(id: string): Footprint[] | undefined {
  if (id === "basketball") return [
    ...[-1, 1].map(side => ({ x: 0, z: side * 14.8, halfWidth: .55, halfDepth: 1.6 })),
    ...[-1, 1].flatMap(side => [-5, 5].map(z => ({ x: side * 10.2, z, halfWidth: .85, halfDepth: 2.1 }))),
  ];
  if (id === "worlds") return [];
  if (isRideScene(id)) return [{x:roadView.walkX+3.2,z:roadView.walkZ-3.2,radius:.32}];
}
export function setWorldView(camera: Camera, roomId: string) {
  if (roomId === "basketball") { camera.position.set(2, 1.65, 9); camera.lookAt(0, 2.4, -12.1); }
  if (roomId === "worlds") { camera.position.set(0, 1.65, 12.5); camera.lookAt(0, 3.2, -10); }
  if (isRideScene(roomId)) {
    const map=getRideMap(roomId),saved=readRoadSave(map),p=new Vector3(),tangent=new Vector3();map.sample(saved.distance,p,tangent);
    Object.assign(roadView,{active:true,mounted:false,walkX:p.x,walkY:p.y,walkZ:p.z,distance:saved.distance,speed:0});
    camera.position.set(p.x+.2,p.y+1.65,p.z+7.5);camera.lookAt(p.x+3.2,p.y+.78,p.z-3.2);
  }
}
