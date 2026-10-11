import {useRef} from "react";
import {useFrame} from "@react-three/fiber";
import {Group} from "three";
import {ScanInstances,type useAlpineScans} from "../alpine/Scans";
import type {createRoadsideDetails,roadsideDetailMaterials} from "./roadside";

export default function RoadsideDetails({data,scan,materials}:{data:ReturnType<typeof createRoadsideDetails>;scan:ReturnType<typeof useAlpineScans>[number];materials:ReturnType<typeof roadsideDetailMaterials>}){
  const root=useRef<Group>(null),tick=useRef(.25);
  // 分区仍由原路线管理；只停画离镜头较远的小构件，不订阅或修改玩家状态，也不每帧重渲染 React。
  useFrame(({camera},dt)=>{tick.current+=dt;if(tick.current<.25)return;tick.current=0;if(root.current)root.current.visible=camera.position.distanceTo(data.bounds.center)<data.bounds.radius+48;});
  return <group ref={root} name="restrained-roadside-details" dispose={null}>
    {data.stones.length>0&&<ScanInstances scan={{geometry:scan.geometry,material:materials.stone}} items={data.stones} shadows={false}/>}
    {data.drainCount>0&&<mesh geometry={data.drains} material={materials.drain} receiveShadow raycast={()=>{}}/>}
  </group>;
}
