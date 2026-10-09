import { useEffect,useMemo,useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry,Float32BufferAttribute,CatmullRomCurve3,TubeGeometry,Vector3,LatheGeometry,Vector2,Group,MeshStandardMaterial,CanvasTexture,RepeatWrapping,SRGBColorSpace } from "three";
import { roadView,useRoadRide } from "./state";
import { roadSample,terrainHeight } from "./route";

type V=[number,number,number];
function tube(points:V[],radius:number,segments=12){return new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p))),segments,radius,8,false);}
function useBikeParts(){
  const parts=useMemo(()=>{
    const frame:BufferGeometry[]=[],fork:BufferGeometry[]=[],metal:BufferGeometry[]=[],tape:BufferGeometry[]=[];
    const bb:V=[0,.29,.08],seat:V=[0,.82,.24],head:V=[0,.90,-.39],rear:V=[0,.345,.54],front:V=[0,.345,-.61];
    frame.push(tube([bb,[0,.46,-.13],head],.039),tube([seat,[0,.865,-.05],head],.024),tube([bb,seat],.029),tube([seat,[0,.94,.27]],.018));
    for(const side of [-1,1]){
      frame.push(tube([[side*.025,.29,.08],[side*.055,.30,.32],[side*.056,.345,.54]],.014),tube([[side*.015,.69,.20],[side*.05,.47,.44],[side*.058,.345,.54]],.010));
      fork.push(tube([[side*.025,.84,-.43],[side*.049,.67,-.51],[side*.051,.345,-.61]],.021));
      tape.push(tube([[side*.05,.975,-.60],[side*.16,.975,-.60],[side*.205,.98,-.68],[side*.21,.965,-.79],[side*.21,.92,-.84],[side*.21,.83,-.82],[side*.21,.785,-.74],[side*.21,.79,-.61]],.014,32));
      metal.push(tube([[side*.218,.956,-.832],[side*.218,.925,-.873],[side*.218,.858,-.876],[side*.218,.834,-.857]],.005,16));
    }
    frame.push(tube([head,[0,.968,-.43],[0,.975,-.60]],.022));
    const rim=new LatheGeometry([new Vector2(.277,-.013),new Vector2(.32,-.014),new Vector2(.331,-.008),new Vector2(.331,.008),new Vector2(.32,.014),new Vector2(.277,.013),new Vector2(.277,-.013)],64);
    const spokes=new BufferGeometry(),vertices:number[]=[];
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;vertices.push(i%2?.025:-.025,0,0,0,Math.sin(a)*.30,Math.cos(a)*.30);}
    spokes.setAttribute("position",new Float32BufferAttribute(vertices,3));
    const chain=tube([[.071,.29,.18],[.071,.345,.60],[.071,.365,.54],[.071,.37,.25],[.071,.39,.08],[.071,.35,-.03],[.071,.24,.01],[.071,.19,.08],[.071,.22,.18]],.003,60);
    const canvas=document.createElement("canvas");canvas.width=64;canvas.height=512;const c=canvas.getContext("2d")!;c.fillStyle="#242b31";c.fillRect(0,0,64,512);
    for(let i=0;i<512;i+=8){c.fillStyle=i%16===0?"#3e484e":"#1c232a";c.fillRect(0,i,64,1);}
    const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.wrapS=map.wrapT=RepeatWrapping;map.repeat.set(1,3);map.anisotropy=4;
    return{frame,fork,metal,tape,rim,spokes,chain,map,bb,seat,head,rear,front};
  },[]);
  useEffect(()=>()=>{[...parts.frame,...parts.fork,...parts.metal,...parts.tape,parts.rim,parts.spokes,parts.chain].forEach(g=>g.dispose());parts.map.dispose();},[parts]);
  return parts;
}
// 原创公路车尺寸：约 1.15 m 轴距，700C 外径，30 mm 轮胎与 54 mm 深截面轮圈。无商业标识。
export default function RoadBike(){
  const p=useBikeParts(),root=useRef<Group>(null),cockpit=useRef<Group>(null),cranks=useRef<Group>(null),frontWheel=useRef<Group>(null),rearWheel=useRef<Group>(null);
  const pose=useMemo(()=>({point:new Vector3(),tangent:new Vector3(),spin:0,pedal:0}),[]);
  const paint=useMemo(()=>new MeshStandardMaterial({color:"#c6dce0",metalness:.28,roughness:.25}),[]);
  useEffect(()=>()=>paint.dispose(),[paint]);
  useFrame((_,delta)=>{
    if(!root.current)return;const s=useRoadRide.getState(),dt=Math.min(delta,.06);
    root.current.visible=!s.photo;
    const px=roadView.walkX+3.2,pz=roadView.walkZ-3.2,py=terrainHeight(px,pz),p=roadView.mountProgress,e=p*p*(3-2*p);
    if(s.mounted){roadSample(roadView.distance,pose.point,pose.tangent);pose.point.x+=-pose.tangent.z*sOffset();pose.point.z+=pose.tangent.x*sOffset();pose.point.y+=.012;
      root.current.position.set(px+(pose.point.x-px)*e,py+(pose.point.y-py)*e,pz+(pose.point.z-pz)*e);
      const yaw=-.95+Math.atan2(Math.sin(roadView.yaw+.95),Math.cos(roadView.yaw+.95))*e;root.current.rotation.set(roadView.pitch*.6*e,yaw,-roadView.lean*e,"YXZ");}
    else{root.current.position.set(px,py,pz);root.current.rotation.set(0,-.95,.025);}
    pose.spin-=roadView.speed*dt/.345;pose.pedal+=roadView.cadence/60*Math.PI*2*dt;
    if(frontWheel.current)frontWheel.current.rotation.x=pose.spin;if(rearWheel.current)rearWheel.current.rotation.x=pose.spin;
    if(cranks.current)cranks.current.rotation.x=-pose.pedal;
    if(cockpit.current)cockpit.current.rotation.y=roadView.steer*.5;
  });
  function sOffset(){return roadView.offset;}
  return <group ref={root} name="original-performance-road-bike" onClick={event=>{if(event.delta<5&&!useRoadRide.getState().mounted){event.stopPropagation();window.dispatchEvent(new CustomEvent("palace:road",{detail:"mount"}));}}}>
    {p.frame.map((g,i)=><mesh key={"frame"+i} geometry={g} material={paint} castShadow />)}
    {p.fork.map((g,i)=><mesh key={"fork"+i} geometry={g} material={paint} castShadow />)}
    <group ref={cockpit}>
      {p.tape.map((g,i)=><mesh key={i} geometry={g} castShadow><meshStandardMaterial color="#a0abb0" map={p.map} roughness={.64}/></mesh>)}
      {[-1,1].map(side=><group key={side} position={[side*.21,.983,-.77]} rotation={[-.20,0,0]}>
        <mesh scale={[.021,.035,.065]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#1c252c" roughness={.55}/></mesh>
        <mesh position={[0,.029,-.025]} scale={[.018,.026,.025]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#222b31" roughness={.48}/></mesh>
      </group>)}
      {p.metal.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color="#747c83" metalness={.82} roughness={.28}/></mesh>)}
    </group>
    <mesh position={[0,.982,-.43]}><cylinderGeometry args={[.025,.025,.009,20]}/><meshStandardMaterial color="#65747d" metalness={.7} roughness={.3}/></mesh>
    <mesh position={[0,.992,.29]} scale={[.074,.017,.143]}><sphereGeometry args={[1,24,12]}/><meshStandardMaterial color="#24303a" roughness={.48}/></mesh>
    <mesh position={[0,.994,.15]} scale={[.034,.011,.075]}><sphereGeometry args={[1,16,8]}/><meshStandardMaterial color="#25313a" roughness={.5}/></mesh>
    {[p.front,p.rear].map((center,i)=><group key={i} position={center} ref={i?rearWheel:frontWheel}>
      <mesh geometry={p.rim} rotation={[0,0,Math.PI/2]} castShadow><meshStandardMaterial color="#24303b" metalness={.48} roughness={.3}/></mesh>
      <mesh rotation={[0,Math.PI/2,0]} castShadow><torusGeometry args={[.331,.0145,12,64]}/><meshStandardMaterial color="#1c2124" roughness={.91}/></mesh>
      <mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[.332,.008,8,64]}/><meshStandardMaterial color="#5c6260" roughness={.92}/></mesh>
      <lineSegments geometry={p.spokes}><lineBasicMaterial color="#a6b2b9" transparent opacity={.58}/></lineSegments>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.022,.022,.08,12]}/><meshStandardMaterial color="#4b5a68" metalness={.8} roughness={.24}/></mesh>
      <mesh position={[.065,0,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.075,.006,8,32]}/><meshStandardMaterial color="#849093" metalness={.8} roughness={.36}/></mesh>
    </group>)}
    {[0,1,2,3,4,5,6].map(i=><mesh key={i} position={[.048+i*.004,.345,.54]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.052-i*.004,.004,8,32]}/><meshStandardMaterial color="#7b858a" metalness={.8} roughness={.34}/></mesh>)}
    <mesh geometry={p.chain}><meshStandardMaterial color="#b6b7aa" metalness={.85} roughness={.48}/></mesh>
    <group ref={cranks} position={p.bb}>
      <mesh position={[.064,0,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.092,.006,8,48]}/><meshStandardMaterial color="#384857" metalness={.74} roughness={.3}/></mesh>
      {[0,1,2,3,4].map(i=><mesh key={i} position={[.06,Math.cos(i*Math.PI*.4)*.042,Math.sin(i*Math.PI*.4)*.042]} rotation={[i*Math.PI*.4,0,0]}><boxGeometry args={[.009,.07,.009]}/><meshStandardMaterial color="#354655" metalness={.8} roughness={.3}/></mesh>)}
      {[-1,1].map(side=><group key={side}>
        <mesh position={[side*.072,0,side*.083]} rotation={[Math.PI/2,0,0]}><boxGeometry args={[.017,.17,.022]}/><meshStandardMaterial color="#324352" metalness={.7} roughness={.25}/></mesh>
        <mesh position={[side*.108,0,side*.16]}><boxGeometry args={[.071,.024,.045]}/><meshStandardMaterial color="#26353e" metalness={.65} roughness={.4}/></mesh>
      </group>)}
    </group>
    <mesh position={[.05,.31,.60]} rotation={[.3,0,.2]}><boxGeometry args={[.025,.08,.04]}/><meshStandardMaterial color="#273947" metalness={.7} roughness={.35}/></mesh>
  </group>;
}
