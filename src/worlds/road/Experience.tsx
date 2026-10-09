import { useEffect,useLayoutEffect,useMemo,useRef } from "react";
import { useFrame,useThree } from "@react-three/fiber";
import { Vector3,Euler,Quaternion,PerspectiveCamera } from "three";
import { usePalaceStore } from "../../systems/store";
import { useQuietMotion } from "../../motion/useMotionCue";
import { acknowledge } from "../../interaction/registry";
import { useActivity } from "../activity";
import { useRoadAudio } from "./audio";
import { RoadPhysics } from "./physics";
import { roadLength,roadSample,roadStops,roadChapter,lakeDistance,terrainHeight,roadForestDensity } from "./route";
import { roadView,useRoadRide,readRoadSave,saveRoadRide,rememberRoadCinema,takeRoadCinemaReturn,peekRoadCinemaReturn,type RoadCommand } from "./state";
import RoadLandscape from "./Landscape";
import RoadBike from "./RoadBike";
export { primeRoadTextures as preloadRoadAssets } from "./textures";

function RoadRider(){
  const {camera,gl,scene}=useThree(),quiet=useQuietMotion(),sound=useRoadAudio();
  const model=useMemo(()=>{const saved=peekRoadCinemaReturn()??readRoadSave(),b=new RoadPhysics();b.distance=saved.distance;b.gear=saved.gear;b.lastSafe=b.distance;return b;},[]);
  const local=useRef({keys:new Set<string>(),accumulator:0,publish:0,save:0,autoShift:0,mountTime:0,brakeLatch:false,photoPending:false,start:new Vector3(),startQ:new Quaternion(),point:new Vector3(),tangent:new Vector3(),target:new Vector3(),look:new Euler(0,0,0,"YXZ"),targetQ:new Quaternion(),yawReady:false,cinemaResume:peekRoadCinemaReturn()});
  useLayoutEffect(()=>{
    const saved=readRoadSave(),p=local.current.point,t=local.current.tangent;roadSample(model.distance,p,t);
    Object.assign(roadView,{active:true,mounted:false,distance:model.distance,speed:0,walkX:p.x,walkY:p.y,walkZ:p.z,mountProgress:0,offset:0,lookPending:false});
    useRoadRide.setState({mounted:false,state:"stopped",nearBike:false,speed:0,distance:model.distance,gear:model.gear,cadence:0,photo:false,easy:false,controls:false,place:"",comfort:saved.comfort});
    // 返回快照只由这个骑行实例消费；StrictMode 的 effect 重播仍使用该快照，不会丢失骑姿。
    const resume=local.current.cinemaResume;if(resume){
      takeRoadCinemaReturn();
      model.offset=resume.offset;model.heading=resume.heading;local.current.brakeLatch=true;local.current.mountTime=1;
      local.current.yawReady=true;
      Object.assign(roadView,{mounted:resume.mounted,mountProgress:resume.mounted?1:0,offset:resume.offset,headYaw:resume.headYaw,headPitch:resume.headPitch,yaw:resume.yaw,pitch:resume.pitch,roll:resume.roll,lookPending:resume.mounted});
      useRoadRide.setState({mounted:resume.mounted,photo:resume.photo,comfort:resume.comfort});
    }
    return()=>{saveRoadRide(model.distance,model.gear,useRoadRide.getState().comfort);roadView.active=false;roadView.mounted=false;roadView.speed=0;useRoadRide.setState({mounted:false,photo:false,speed:0,easy:false});};
  },[model,camera]);
  useEffect(()=>{
    const command=(event:Event)=>{
      const palace=usePalaceStore.getState(),s=useRoadRide.getState(),l=local.current;
      if(palace.overlay||palace.focus||palace.mode==="index"||useActivity.getState().warming)return;
      const action=(event as CustomEvent<RoadCommand>).detail;sound.unlock();
      if(action==="mount"){
        if(s.mounted)return;if(!s.nearBike){acknowledge("Approach the bicycle to ride");return;}
        l.keys.clear();l.brakeLatch=true;l.mountTime=0;l.start.copy(camera.position);l.startQ.copy(camera.quaternion);
        const angles=new Euler().setFromQuaternion(camera.quaternion,"YXZ");roadView.baseYaw=angles.y;roadView.basePitch=angles.x;roadView.headYaw=0;roadView.headPitch=0;
        roadView.mounted=true;roadView.mountProgress=0;useRoadRide.setState({mounted:true,state:"mounting",controls:false});
      }
      if(action==="dismount"){
        if(model.speed>.3){l.brakeLatch=true;acknowledge("Brake gently before dismounting");return;}
        roadSample(model.distance,l.point,l.tangent);roadView.walkX=l.point.x;roadView.walkY=l.point.y;roadView.walkZ=l.point.z;roadView.mounted=false;roadView.mountProgress=0;
        camera.position.set(l.point.x+1.4,l.point.y+1.65,l.point.z+1.3);l.keys.clear();useRoadRide.setState({mounted:false,state:"dismounting",photo:false,easy:false,controls:false});
      }
      if(action==="pedal"&&s.mounted){l.brakeLatch=false;model.atStop=false;model.ended=false;useRoadRide.setState({easy:!s.easy,photo:false});}
      if(action==="brake"){l.brakeLatch=true;useRoadRide.setState({easy:false});}
      if(action==="stop"&&s.mounted){model.atStop=false;model.stopAt=roadStops.find(stop=>stop.distance>model.distance+4)?.distance??roadLength;l.brakeLatch=false;useRoadRide.setState({easy:true,controls:false});acknowledge("Ride to the next quiet place");}
      if(action==="easier"||action==="harder")if(model.shift(action==="easier"?-1:1)){sound.shift();useRoadRide.setState({gear:model.gear,gearSequence:s.gearSequence+1});}
      if(action==="photo"&&s.mounted){
        if(s.photo){useRoadRide.setState({photo:false});l.photoPending=false;}
        else if(model.speed<.2){model.speed=0;l.keys.clear();useRoadRide.setState({photo:true,easy:false,controls:false});}
        else{l.photoPending=true;l.brakeLatch=true;useRoadRide.setState({easy:false});acknowledge("Settling into a still view");}
      }
      if(action==="save"&&s.photo){gl.render(scene,camera);gl.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="the-long-way-home.png";link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);});}
      if(action==="restart"&&model.speed<.2){model.distance=0;model.lastSafe=0;model.offset=0;model.ended=false;model.stopAt=null;model.atStop=false;roadSample(0,l.point,l.tangent);Object.assign(roadView,{walkX:l.point.x,walkY:l.point.y,walkZ:l.point.z,distance:0,mounted:false,mountProgress:0});camera.position.set(.2,19.65,7.5);useRoadRide.setState({mounted:false,photo:false,easy:false,distance:0});saveRoadRide(0,model.gear,s.comfort);}
    };
    const down=(event:KeyboardEvent)=>{
      const palace=usePalaceStore.getState(),s=useRoadRide.getState(),l=local.current;
      if(event.repeat||palace.overlay||palace.focus||palace.mode==="index"||useActivity.getState().warming||document.hidden||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(event.code==="KeyP"&&s.mounted){event.preventDefault();command(new CustomEvent("palace:road",{detail:"photo"}));return;}
      if(event.code==="KeyE"){event.preventDefault();command(new CustomEvent("palace:road",{detail:s.mounted?"harder":"mount"}));return;}
      if(event.code==="KeyQ"&&s.mounted){event.preventDefault();command(new CustomEvent("palace:road",{detail:"easier"}));return;}
      if(!s.mounted||s.photo)return;
      if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight","Space"].includes(event.code)){
        if(event.code==="Space"&&!document.pointerLockElement&&event.target instanceof HTMLElement&&event.target.closest("button,a"))return;
        event.preventDefault();l.keys.add(event.code);sound.unlock();
        if(event.code==="KeyW"||event.code==="ArrowUp"){l.brakeLatch=false;model.atStop=false;useRoadRide.setState({easy:false});}
      }
    };
    const up=(event:KeyboardEvent)=>local.current.keys.delete(event.code);
    const halt=()=>{local.current.keys.clear();local.current.brakeLatch=true;model.speed=0;saveRoadRide(model.distance,model.gear,useRoadRide.getState().comfort);useRoadRide.setState({speed:0,easy:false});sound.update({speed:0,cadence:0,pedaling:false,brake:0,nearWater:0,forest:.5,stopped:true});};
    const escape=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      // 原馆弹窗与二维入口拥有最上层 ESC；骑行选项/照片不得抢先关闭底层状态。
      const palace=usePalaceStore.getState();if(palace.overlay||palace.focus||palace.mode==="index")return;
      const s=useRoadRide.getState();
      if(s.photo||s.controls){event.preventDefault();event.stopImmediatePropagation();useRoadRide.setState({photo:false,controls:false});}
      else if(!document.pointerLockElement){local.current.brakeLatch=true;useRoadRide.setState({easy:false,controls:true});}
    };
    const unsubscribe=usePalaceStore.subscribe((s,p)=>{
      if(p.roomId==="cycling"&&s.roomId==="cinema"){const r=useRoadRide.getState();rememberRoadCinema({distance:model.distance,gear:model.gear,offset:model.offset,heading:model.heading,headYaw:roadView.headYaw,headPitch:roadView.headPitch,yaw:roadView.yaw,pitch:roadView.pitch,roll:roadView.roll,mounted:r.mounted,photo:r.photo,comfort:r.comfort});}
      if((s.overlay&&!p.overlay)||(s.focus&&!p.focus)||s.mode==="index"&&p.mode!=="index")halt();
    });
    window.addEventListener("palace:road",command);document.addEventListener("keydown",down);document.addEventListener("keyup",up);window.addEventListener("keydown",escape,true);window.addEventListener("blur",halt);window.addEventListener("pagehide",halt);
    // 原生测试只能读取这些开发诊断；生产构建没有注入状态入口。
    const debug=window as Window&{__ROAD_DEBUG__?:unknown};if(import.meta.env.DEV)debug.__ROAD_DEBUG__={model,view:roadView,audio:sound};
    return()=>{unsubscribe();window.removeEventListener("palace:road",command);document.removeEventListener("keydown",down);document.removeEventListener("keyup",up);window.removeEventListener("keydown",escape,true);window.removeEventListener("blur",halt);window.removeEventListener("pagehide",halt);delete debug.__ROAD_DEBUG__;};
  },[camera,gl,scene,model,sound]);
  useFrame((_,rawDelta)=>{
    const palace=usePalaceStore.getState(),s=useRoadRide.getState(),l=local.current;
    if(!palace.started||palace.overlay||palace.focus||palace.mode==="index"||useActivity.getState().warming||document.hidden)return;
    const dt=Math.min(.06,rawDelta),comfort=quiet||s.comfort;
    if(!s.mounted){
      camera.position.y=terrainHeight(camera.position.x,camera.position.z)+1.77;
      const near=camera.position.distanceToSquared(l.target.set(roadView.walkX+3.2,roadView.walkY+.7,roadView.walkZ-3.2))<10.5;
      if(near!==s.nearBike)useRoadRide.setState({nearBike:near});roadView.speed=0;roadView.cadence=0;
      sound.update({speed:0,cadence:0,pedaling:false,brake:0,nearWater:Math.max(0,1-(lakeDistance(camera.position.x,camera.position.z)-1)/.65),forest:1,stopped:true});return;
    }
    const keys=l.keys,pedal=keys.has("KeyW")||keys.has("ArrowUp")||s.easy,brake=l.brakeLatch||keys.has("KeyS")||keys.has("ArrowDown")||keys.has("Space"),steer=(keys.has("KeyD")||keys.has("ArrowRight")?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")?1:0);
    const mounting=roadView.mountProgress<1;
    l.accumulator=Math.min(l.accumulator+dt,.06);while(l.accumulator>=1/90){model.step(1/90,{pedal,brake,steer,strong:keys.has("ShiftLeft")||keys.has("ShiftRight"),blocked:mounting||s.photo||s.controls});l.accumulator-=1/90;}
    if(model.atStop&&s.easy)useRoadRide.setState({easy:false,place:roadStops.find(stop=>Math.abs(stop.distance-model.distance)<3)?.title??"HOME"});
    if(l.photoPending&&model.speed===0){l.photoPending=false;l.keys.clear();useRoadRide.setState({photo:true,controls:false});}
    l.autoShift+=dt;
    if(s.easy&&l.autoShift>3){
      l.autoShift=0;const desired=model.grade>.07?1:model.grade>.045?3:model.grade>.02?5:model.speed>12?11:model.speed>8?8:7;
      if(model.shift(Math.sign(desired-model.gear))){sound.shift();useRoadRide.setState({gear:model.gear,gearSequence:s.gearSequence+1});}
    }
    roadSample(model.distance,l.point,l.tangent);const yaw=Math.atan2(-l.tangent.x,-l.tangent.z)-model.heading;
    if(!l.yawReady){roadView.yaw=yaw;l.yawReady=true;}else roadView.yaw+=Math.atan2(Math.sin(yaw-roadView.yaw),Math.cos(yaw-roadView.yaw))*(1-Math.exp(-dt*8));
    roadView.pitch=Math.atan2(l.tangent.y,Math.hypot(l.tangent.x,l.tangent.z))-.035;roadView.roll=comfort?0:-model.lean*.16;
    Object.assign(roadView,{distance:model.distance,speed:model.speed,offset:model.offset,lean:comfort?0:model.lean,steer:model.steering,brake:model.braking,cadence:model.cadence});
    const nx=-l.tangent.z,nz=l.tangent.x,r=Math.hypot(nx,nz),aero=comfort?0:Math.max(0,(model.speed-10)/5)*.025;
    l.target.set(l.point.x+nx/r*model.offset-l.tangent.x*.23,l.point.y+1.47-aero-(comfort?0:model.braking*.013)+ (comfort?0:Math.sin(model.distance*3.4)*.0015*Math.min(1,model.speed/8)),l.point.z+nz/r*model.offset-l.tangent.z*.23);
    if(mounting){l.mountTime+=dt;roadView.mountProgress=Math.min(1,l.mountTime/(comfort?.08:.72));const p=roadView.mountProgress,e=p*p*(3-2*p);camera.position.lerpVectors(l.start,l.target,e);l.look.set(roadView.pitch,roadView.yaw,0,"YXZ");l.targetQ.setFromEuler(l.look);camera.quaternion.slerpQuaternions(l.startQ,l.targetQ,e);}
    else{camera.position.copy(l.target);l.look.set(roadView.pitch+roadView.headPitch,roadView.yaw+roadView.headYaw,roadView.roll,"YXZ");camera.quaternion.setFromEuler(l.look);}
    const fov=60+(comfort?0:Math.max(0,Math.min(3,(model.speed-9)*.6)));
    if(camera instanceof PerspectiveCamera&&Math.abs(camera.fov-fov)>.01){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix();}
    const still=mounting||s.photo||s.controls;
    sound.update({speed:still?0:model.speed,cadence:still?0:model.cadence,pedaling:pedal&&!brake&&!still,brake:model.braking,nearWater:Math.max(0,1-(lakeDistance(l.point.x,l.point.z)-1)/.65),forest:roadForestDensity(model.distance/roadLength),stopped:still||model.speed<.2});
    l.publish+=dt;l.save+=dt;if(l.publish>.15){l.publish=0;useRoadRide.setState({speed:model.speed,distance:model.distance,cadence:model.cadence,grade:model.grade,state:mounting?"mounting":model.state,recovery:model.recovered});useActivity.setState({distance:model.distance,speed:model.speed,riding:pedal,stopped:model.speed<.1,scenic:roadChapter(model.distance)});}
    if(l.save>3){l.save=0;saveRoadRide(model.distance,model.gear,s.comfort);}
  });
  return null;
}
export default function RoadExperience(){return <group name="long-way-home-road-world"><RoadLandscape/><RoadRider/><RoadBike/></group>;}
