import { useEffect,useMemo,useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry,Float32BufferAttribute,CatmullRomCurve3,TubeGeometry,Vector3,LatheGeometry,Vector2,Group,MeshStandardMaterial,CanvasTexture,RepeatWrapping,SRGBColorSpace } from "three";
import { roadView,useRoadRide } from "./state";
import {forestMap} from "./maps";
import type {RideMap} from "./mapTypes";
import { usePalaceStore } from "../../systems/store";

type V=[number,number,number];
function tube(points:V[],radius:number,segments=12){return new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p))),segments,radius,8,false);}
function useBikeParts(){
  const parts=useMemo(()=>{
    const frame:BufferGeometry[]=[],fork:BufferGeometry[]=[],metal:BufferGeometry[]=[],tape:BufferGeometry[]=[],cables:BufferGeometry[]=[];
    const bb:V=[0,.29,.08],seat:V=[0,.82,.24],head:V=[0,.90,-.39],rear:V=[0,.345,.54],front:V=[0,.345,-.61];
    frame.push(tube([bb,[0,.46,-.13],head],.039),tube([seat,[0,.865,-.05],head],.024),tube([bb,seat],.029),tube([seat,[0,.94,.27]],.018));
    for(const side of [-1,1]){
      frame.push(tube([[side*.025,.29,.08],[side*.055,.30,.32],[side*.056,.345,.54]],.014),tube([[side*.015,.69,.20],[side*.05,.47,.44],[side*.058,.345,.54]],.010));
      fork.push(tube([[side*.025,.84,-.43],[side*.049,.67,-.51],[side*.051,.345,-.61]],.021));
      tape.push(tube([[side*.05,.975,-.48],[side*.16,.975,-.48],[side*.205,.98,-.56],[side*.21,.965,-.67],[side*.21,.92,-.72],[side*.21,.83,-.70],[side*.21,.785,-.62],[side*.21,.79,-.49]],.014,32));
      metal.push(tube([[side*.218,.956,-.712],[side*.218,.925,-.753],[side*.218,.858,-.756],[side*.218,.834,-.737]],.005,16));
      cables.push(tube([[side*.19,.94,-.67],[side*.12,.86,-.57],[side*.10,.81,-.41],[side*.024,.72,-.28]],.0033,24));
    }
    const stem=tube([head,[0,.968,-.43],[0,.975,-.48]],.022);
    const rim=new LatheGeometry([new Vector2(.277,-.013),new Vector2(.32,-.014),new Vector2(.331,-.008),new Vector2(.331,.008),new Vector2(.32,.014),new Vector2(.277,.013),new Vector2(.277,-.013)],64);
    const spokes=new BufferGeometry(),vertices:number[]=[];
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;vertices.push(i%2?.025:-.025,0,0,0,Math.sin(a)*.30,Math.cos(a)*.30);}
    spokes.setAttribute("position",new Float32BufferAttribute(vertices,3));
    const chain=tube([[.071,.29,.18],[.071,.345,.60],[.071,.365,.54],[.071,.37,.25],[.071,.39,.08],[.071,.35,-.03],[.071,.24,.01],[.071,.19,.08],[.071,.22,.18]],.003,60);
    const canvas=document.createElement("canvas");canvas.width=64;canvas.height=512;const c=canvas.getContext("2d")!;c.fillStyle="#242b31";c.fillRect(0,0,64,512);
    for(let i=0;i<512;i+=8){c.fillStyle=i%16===0?"#3e484e":"#1c232a";c.fillRect(0,i,64,1);}
    const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.wrapS=map.wrapT=RepeatWrapping;map.repeat.set(1,3);map.anisotropy=4;
    return{frame,fork,metal,tape,cables,stem,rim,spokes,chain,map,bb,seat,head,rear,front};
  },[]);
  useEffect(()=>()=>{[...parts.frame,...parts.fork,...parts.metal,...parts.tape,...parts.cables,parts.stem,parts.rim,parts.spokes,parts.chain].forEach(g=>g.dispose());parts.map.dispose();},[parts]);
  return parts;
}
// 原创公路车尺寸：约 1.15 m 轴距，700C 外径，30 mm 轮胎与 54 mm 深截面轮圈。无商业标识。
export default function RoadBike({map=forestMap}:{map?:RideMap}){
  const {sample:roadSample,ground:terrainHeight}=map;
  const p=useBikeParts(),root=useRef<Group>(null),cockpit=useRef<Group>(null),steering=useRef<Group>(null),cranks=useRef<Group>(null),frontWheel=useRef<Group>(null),rearWheel=useRef<Group>(null),pedals=useRef<(Group|null)[]>([]);
  const pose=useMemo(()=>({point:new Vector3(),tangent:new Vector3(),spin:0,pedal:0}),[]);
  const paint=useMemo(()=>new MeshStandardMaterial({color:"#c6dce0",metalness:.28,roughness:.25}),[]);
  useEffect(()=>()=>paint.dispose(),[paint]);
  useFrame((_,delta)=>{
    if(!root.current)return;const s=useRoadRide.getState(),dt=Math.min(delta,.06);
    root.current.visible=!s.photo;
    const px=roadView.walkX+3.2,pz=roadView.walkZ-3.2,py=terrainHeight(px,pz),p=roadView.mountProgress,e=p*p*(3-2*p);
    if(s.mounted){roadSample(roadView.distance,pose.point,pose.tangent);const horizontal=Math.hypot(pose.tangent.x,pose.tangent.z);pose.point.x+=-pose.tangent.z/horizontal*sOffset();pose.point.z+=pose.tangent.x/horizontal*sOffset();pose.point.y+=.012;
      root.current.position.set(px+(pose.point.x-px)*e,py+(pose.point.y-py)*e,pz+(pose.point.z-pz)*e);
      const yaw=-.95+Math.atan2(Math.sin(roadView.yaw+.95),Math.cos(roadView.yaw+.95))*e;root.current.rotation.set(Math.atan2(pose.tangent.y,horizontal)*e,yaw,-roadView.lean*e,"YXZ");}
    else{root.current.position.set(px,py,pz);root.current.rotation.set(0,-.95,.025);}
    const palacePaused=usePalaceStore.getState().overlay||usePalaceStore.getState().focus||s.controls||s.photo||document.hidden;
    if(!palacePaused){pose.spin-=roadView.speed*dt/.345;pose.pedal+=roadView.cadence/60*Math.PI*2*dt;}
    roadView.pedalAngle=pose.pedal;
    if(frontWheel.current)frontWheel.current.rotation.x=pose.spin;if(rearWheel.current)rearWheel.current.rotation.x=pose.spin;
    if(cranks.current)cranks.current.rotation.x=-pose.pedal;
    if(cockpit.current)cockpit.current.rotation.y=roadView.steer*.5;
    if(steering.current)steering.current.rotation.y=roadView.steer*.5;
    pedals.current.forEach(pedal=>{if(pedal)pedal.rotation.x=pose.pedal;});
  },-2.4);
  function sOffset(){return roadView.offset;}
  return <group ref={root} name="original-performance-road-bike" onClick={event=>{if(event.delta<5&&!useRoadRide.getState().mounted){event.stopPropagation();window.dispatchEvent(new CustomEvent("palace:road",{detail:"mount"}));}}}>
    {p.frame.map((g,i)=><mesh key={"frame"+i} geometry={g} material={paint} castShadow />)}
    <group ref={steering} position={p.head}><group position={[0,-p.head[1],-p.head[2]]}>
      {p.fork.map((g,i)=><mesh key={"fork"+i} geometry={g} material={paint} castShadow />)}
      <Wheel center={p.front} wheelRef={frontWheel} />
    </group></group>
    <group ref={cockpit} position={p.head}><group position={[0,-p.head[1],-p.head[2]]}>
      <mesh geometry={p.stem} material={paint} castShadow />
      {p.tape.map((g,i)=><mesh key={i} geometry={g} castShadow><meshStandardMaterial color="#a0abb0" map={p.map} roughness={.64}/></mesh>)}
      {[-1,1].map(side=><group key={side} position={[side*.21,.983,-.65]} rotation={[-.20,0,0]}>
        <mesh scale={[.021,.035,.065]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#1c252c" roughness={.55}/></mesh>
        <mesh position={[0,.029,-.025]} scale={[.018,.026,.025]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#222b31" roughness={.48}/></mesh>
      </group>)}
      {p.metal.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color="#747c83" metalness={.82} roughness={.28}/></mesh>)}
      {p.cables.map((g,i)=><mesh key={"cable"+i} geometry={g}><meshStandardMaterial color="#253139" roughness={.7}/></mesh>)}
    </group></group>
    <mesh position={[0,.982,-.43]}><cylinderGeometry args={[.025,.025,.009,20]}/><meshStandardMaterial color="#65747d" metalness={.7} roughness={.3}/></mesh>
    <mesh position={[0,.992,.29]} scale={[.074,.017,.143]}><sphereGeometry args={[1,24,12]}/><meshStandardMaterial color="#24303a" roughness={.48}/></mesh>
    <mesh position={[0,.994,.15]} scale={[.034,.011,.075]}><sphereGeometry args={[1,16,8]}/><meshStandardMaterial color="#25313a" roughness={.5}/></mesh>
    <Wheel center={p.rear} wheelRef={rearWheel} />
    <group position={[0,.56,-.115]} rotation={[.51,0,0]}>
      <mesh><cylinderGeometry args={[.032,.034,.175,16]}/><meshStandardMaterial color="#ecede4" roughness={.46}/></mesh>
      <mesh position={[0,.105,0]}><cylinderGeometry args={[.021,.026,.034,12]}/><meshStandardMaterial color="#29434a" roughness={.48}/></mesh>
      <mesh position={[0,.003,-.032]}><boxGeometry args={[.012,.19,.011]}/><meshStandardMaterial color="#52606a" metalness={.7} roughness={.36}/></mesh>
      {[-1,1].map(side=><mesh key={side} position={[side*.029,-.046,0]} rotation={[0,0,side*-.2]}><boxGeometry args={[.009,.10,.041]}/><meshStandardMaterial color="#425761" metalness={.68} roughness={.34}/></mesh>)}
    </group>
    {[0,1,2,3,4,5,6].map(i=><mesh key={i} position={[.048+i*.004,.345,.54]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.052-i*.004,.004,8,32]}/><meshStandardMaterial color="#7b858a" metalness={.8} roughness={.34}/></mesh>)}
    <mesh geometry={p.chain}><meshStandardMaterial color="#b6b7aa" metalness={.85} roughness={.48}/></mesh>
    <group ref={cranks} position={p.bb}>
      <mesh position={[.064,0,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.092,.006,8,48]}/><meshStandardMaterial color="#384857" metalness={.74} roughness={.3}/></mesh>
      {[0,1,2,3,4].map(i=><mesh key={i} position={[.06,Math.cos(i*Math.PI*.4)*.042,Math.sin(i*Math.PI*.4)*.042]} rotation={[i*Math.PI*.4,0,0]}><boxGeometry args={[.009,.07,.009]}/><meshStandardMaterial color="#354655" metalness={.8} roughness={.3}/></mesh>)}
      {[-1,1].map((side,i)=><group key={side}>
        <mesh position={[side*.072,0,side*.083]} rotation={[Math.PI/2,0,0]}><boxGeometry args={[.017,.17,.022]}/><meshStandardMaterial color="#324352" metalness={.7} roughness={.25}/></mesh>
        <group position={[side*.108,0,side*.16]} ref={element=>{pedals.current[i]=element;}}><mesh><boxGeometry args={[.071,.024,.045]}/><meshStandardMaterial color="#26353e" metalness={.65} roughness={.4}/></mesh></group>
      </group>)}
    </group>
    <mesh position={[.065,.276,.615]} rotation={[.3,0,.2]}><boxGeometry args={[.025,.12,.035]}/><meshStandardMaterial color="#273947" metalness={.7} roughness={.35}/></mesh>
    {[.218,.301].map(y=><mesh key={y} position={[.079,y,.637]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.023,.005,8,20]}/><meshStandardMaterial color="#6e7f85" metalness={.8} roughness={.35}/></mesh>)}
  </group>;
  function Wheel({center,wheelRef}:{center:V;wheelRef:React.RefObject<Group|null>}){return <group position={center} ref={wheelRef}>
      <mesh geometry={p.rim} rotation={[0,0,Math.PI/2]} castShadow><meshStandardMaterial color="#24303b" metalness={.48} roughness={.3}/></mesh>
      <mesh rotation={[0,Math.PI/2,0]} castShadow><torusGeometry args={[.331,.0145,12,64]}/><meshStandardMaterial color="#1c2124" roughness={.91}/></mesh>
      <mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[.332,.008,8,64]}/><meshStandardMaterial color="#5c6260" roughness={.92}/></mesh>
      <lineSegments geometry={p.spokes}><lineBasicMaterial color="#a6b2b9" transparent opacity={.58}/></lineSegments>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.022,.022,.08,12]}/><meshStandardMaterial color="#4b5a68" metalness={.8} roughness={.24}/></mesh>
      <mesh position={[.065,0,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.075,.006,8,32]}/><meshStandardMaterial color="#849093" metalness={.8} roughness={.36}/></mesh>
    </group>;}
}
