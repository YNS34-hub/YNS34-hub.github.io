import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {useFrame} from "@react-three/fiber";
import {BufferGeometry,CylinderGeometry,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,Mesh,MeshStandardMaterial,Vector3} from "three";
import Instances,{type Instance} from "../Instances";
import {Block,Label} from "../../world/primitives";
import {usePalaceStore} from "../../systems/store";
import {useQuietMotion} from "../../motion/useMotionCue";
import {roadView,useRoadRide} from "../road/state";
import {useAlpineTextures,useAlpineGeography} from "./assets";
import {applyAlpineSunlight} from "./sunlight";
import Geography from "./Geography";
import {ScanInstances,useAlpineScans} from "./Scans";
import {AlpineVegetation} from "./Vegetation";
import {GrassField,useAlpineGrass} from "./Grass";
import {alpineElevation,alpineGround,alpineLength,alpineMap,alpineRibbon,alpineSectorLength,alpineSectors,nearestAlpine,sampleAlpine} from "./route";

type Maps=ReturnType<typeof useAlpineTextures>;
// 每个路段固定种子，回头与刷新仍能辨认相同的岩石、路标和草叶。
function random(seed:number){return()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};}
function terrainGeometry(points:number[],indices:number[]){const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(points,3));g.setAttribute("uv",new Float32BufferAttribute(points.flatMap((_,i)=>i%3===0?[points[i]/15,points[i+2]/15]:[]),2));g.setIndex(indices);g.computeVertexNormals();return g;}
function RoadSurface({maps}:{maps:Maps}){
  const asphalt=useMemo(()=>{const m=new MeshStandardMaterial({map:maps.asphalt,normalMap:maps.asphaltNormal,roughness:.94,color:"#c8d0d4"});m.normalScale.set(.32,.32);m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\nfloat grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(grey),.95);");};m.customProgramCacheKey=()=>"alpine-neutral-asphalt-v1";return m;},[maps]);
  useEffect(()=>()=>asphalt.dispose(),[asphalt]);
  const geometries=useMemo(()=>[alpineRibbon(0,alpineLength,6.4,0,.01),...[-1,1].map(side=>alpineRibbon(0,alpineLength,.11,side*2.99,.017)),alpineRibbon(0,alpineLength,7.6,0,-.025)],[]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  return <group name="continuous-alpine-pass-road">
    <mesh geometry={geometries[3]} receiveShadow><meshStandardMaterial map={maps.rock} color="#b8ad96" roughness={1}/></mesh>
    <mesh geometry={geometries[0]} receiveShadow material={asphalt}/>
    {[1,2].map(i=><mesh key={i} geometry={geometries[i]} receiveShadow><meshStandardMaterial color="#e7e2ce" roughness={.95}/></mesh>)}
  </group>;
}
function guardrail(start:number,end:number,side:number){
  const p:number[]=[],idx:number[]=[],point=new Vector3(),t=new Vector3(),n=Math.ceil((end-start)/3),profile=[[-.07,.0],[.035,.055],[.07,.13],[-.04,.20],[.07,.28],[.035,.34],[-.07,.39]];
  let previousSafe=false;
  for(let i=0;i<=n;i++){
    sampleAlpine(start+(end-start)*i/n,point,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz);
    for(const [a,y]of profile)p.push(point.x+nx/r*(side*3.95+a),point.y+.68+y,point.z+nz/r*(side*3.95+a));
    const safe=nearestAlpine(point.x+nx/r*side*3.95,point.z+nz/r*side*3.95).distance>3.50;
    // 回头弯内侧的护栏不能切过另一段路面；只连接两个都位于安全路肩的截面。
    if(i>0&&safe&&previousSafe)for(let j=0;j<profile.length-1;j++){const a=(i-1)*profile.length+j;idx.push(a,a+profile.length,a+1,a+1,a+profile.length,a+profile.length+1);}
    previousSafe=safe;
  }
  return terrainGeometry(p,idx);
}
function AlpineSector({index,scans}:{index:number;scans:ReturnType<typeof useAlpineScans>}){
  const quality=usePalaceStore(s=>s.effectiveQuality),quiet=useQuietMotion(),grassTemplates=useAlpineGrass(),riderSector=useRoadRide(s=>Math.floor(s.distance/alpineSectorLength));
  const data=useMemo(()=>{
    const rand=random(1732+index*91),start=index*alpineSectorLength,end=Math.min(alpineLength,start+alpineSectorLength),p=new Vector3(),t=new Vector3();
    sampleAlpine((start+end)/2,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz);
    const side=alpineElevation(p.x+nx/r*22,p.z+nz/r*22)<alpineElevation(p.x-nx/r*22,p.z-nz/r*22)?1:-1;
    const posts:Instance[]=[],rocks:Instance[]=[],cliffs:Instance[]=[],grass:Instance[][]=Array.from({length:6},()=>[]),markers:Instance[]=[];
    for(let d=start+3;d<end;d+=5.8){
      sampleAlpine(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),yaw=Math.atan2(t.x,t.z);
      if(nearestAlpine(p.x+nx/r*side*3.98,p.z+nz/r*side*3.98).distance>3.50)posts.push({position:[p.x+nx/r*side*3.98,p.y+.50,p.z+nz/r*side*3.98],scale:[.09,1.04,.12],rotation:[0,yaw,0]});
      if(Math.floor(d/5.8)%4===0)markers.push({position:[p.x-nx/r*side*3.84,p.y+.37,p.z-nz/r*side*3.84],scale:[.16,.72,.17],rotation:[0,yaw,0]});
      for(const s of [-1,1]){
        const offset=(5.5+rand()*38)*s,x=p.x+nx/r*offset,z=p.z+nz/r*offset,y=alpineGround(x,z),size=.32+rand()**3*2.8;
        const incline=Math.hypot(alpineGround(x+1,z)-alpineGround(x-1,z),alpineGround(x,z+1)-alpineGround(x,z-1))*.5;
        // 陡壁由地形岩层承担，不在近乎直立的切坡上悬挂松散石块；缓坡石块向地面嵌入。
        if(nearestAlpine(x,z).distance>4.5&&incline<.9)rocks.push({position:[x,y-size*(.06+incline*.24),z],scale:[size*(1+rand()),size*(1.1+rand()*.9),size*(1+rand())],rotation:[rand()*.12,rand()*6.28,rand()*.12]});
        // 稀疏的实扫岩层用于近处切坡；位置由地表坡度决定，不是沿线等距摆巨石。
        if(incline>.7&&incline<2.5&&rand()>.55&&nearestAlpine(x,z).distance>6){
          const span=2.2+rand()*4,dx=alpineGround(x+1,z)-alpineGround(x-1,z),dz=alpineGround(x,z+1)-alpineGround(x,z-1);
          cliffs.push({position:[x,y-span*.28,z],scale:[span,span*.65,span*.8],rotation:[0,Math.atan2(-dx,-dz),0]});
        }
        for(let k=0;k<(quality==="low"?30:80);k++){
          const off=(3.8+rand()**1.7*19)*s,x=p.x+nx/r*off+(rand()-.5)*5,z=p.z+nz/r*off+(rand()-.5)*5;
          const near=nearestAlpine(x,z);if(near.distance<3.8)continue;
          // 真实地表坡度直接读高程，不为每根草重复做五次道路空间搜索。
          if(Math.hypot(alpineElevation(x+1,z)-alpineElevation(x-1,z),alpineElevation(x,z+1)-alpineElevation(x,z-1))>2.4)continue;
          const detailed=(k<35||near.distance<12)&&quality!=="low",h=detailed?.16+rand()*.23:.08+rand()*.12,w=detailed?.18+rand()*.15:.25+rand()*.15;
          grass[(detailed?0:3)+k%3].push({position:[x,alpineGround(x,z,near)-.015,z],scale:[w,h,w],rotation:[0,rand()*6.28,0]});
        }
      }
    }

    return {posts,rocks,cliffs,grass,farGrass:grass.slice(3).map((items,i)=>[...items,...grass[i]]),markers,rail:guardrail(start,end,side),post:new CylinderGeometry(.7,.7,1,4),clock:{value:0},wind:{value:quiet?0:.012}};
  },[index,quality,quiet]);
  useEffect(()=>()=>[data.rail,data.post].forEach(g=>g.dispose()),[data]);
  useFrame((_,dt)=>{if(!quiet)data.clock.value+=Math.min(.06,dt);});
  return <group name={"alpine-sector:"+index}>
    <mesh geometry={data.rail} castShadow={Math.abs(index-riderSector)<2} receiveShadow><meshStandardMaterial color="#b7beb7" metalness={.48} roughness={.54} side={DoubleSide}/></mesh>
    <Instances geometry={data.post} items={data.posts} color="#939a96" metalness={.7} roughness={.5} shadows={Math.abs(index-riderSector)<2}/>
    <Instances geometry={data.post} items={data.markers} color="#dedbcc" roughness={.85}/>
    <ScanInstances scan={scans[0]} items={data.rocks} shadows={Math.abs(index-riderSector)<2}/><ScanInstances scan={scans[1]} items={data.cliffs} shadows={Math.abs(index-riderSector)<2}/>
    {grassTemplates.map((template,i)=><GrassField key={i} template={template} items={i<3?data.grass[i]:data.farGrass[i-3]} time={data.clock} wind={data.wind} near={i<3} blend={quality!=="low"}/>)}<AlpineVegetation index={index}/>
  </group>;
}
function PassHouse({distance,side=1}:{distance:number;side?:number}){
  const p=new Vector3(),t=new Vector3();sampleAlpine(distance,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),x=p.x+nx/r*side*21,z=p.z+nz/r*side*21,y=alpineGround(x,z);
  return <group name="original-alpine-pass-house" position={[x,y,z]} rotation={[0,Math.atan2(t.x,t.z),0]}>
    <Block position={[0,-1.8,0]} scale={[12,4.2,8]} color="#8f9383" roughness={1}/><Block position={[0,3.2,0]} scale={[11.5,6.4,7.5]} color="#d5cdb6" roughness={.92}/>
    {[-1,1].map(side=><Block key={side} position={[side*3.02,7.15,0]} scale={[6.6,.22,8.5]} rotation={[0,0,side*-.40]} color="#655853" roughness={.87}/>)}
    {[1.8,4.4].flatMap(y=>[-3.5,0,3.5].map(x=><group key={x+":"+y} position={[x,y,3.79]}><Block scale={[1.1,1.35,.08]} color="#263d45" roughness={.25}/>{[-1,1].map(side=><Block key={side} position={[side*.74,0,.045]} scale={[.35,1.4,.08]} color="#85594c" roughness={.9}/>)}</group>))}
    <Block position={[0,.95,3.80]} scale={[1.1,1.9,.1]} color="#4b5148"/>
  </group>;
}
function Viewpoints(){
  return <>{alpineMap.stops.map((stop,i)=>{
    const p=new Vector3(),t=new Vector3();sampleAlpine(stop.distance,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),side=alpineElevation(p.x+nx/r*22,p.z+nz/r*22)<alpineElevation(p.x-nx/r*22,p.z-nz/r*22)?1:-1;
    return <group key={stop.title} position={[p.x+nx/r*side*6,p.y,p.z+nz/r*side*6]} rotation={[0,Math.atan2(t.x,t.z),0]}><Block position={[0,-1.2,0]} scale={[4,2.35,4]} color="#a7aa97" roughness={1}/><Block position={[0,.46,.7]} scale={[1.9,.1,.47]} color="#71634a" roughness={.8}/>{[-.7,.7].map(x=><Block key={x} position={[x,.23,.7]} scale={[.07,.46,.32]} color="#526159" metalness={.5}/>)}<Block position={[-1.5,.45,1.3]} scale={[.07,.9,.07]} color="#606a5c"/><Label text={"0"+(i+1)+" / "+stop.title} position={[-1.4,.92,1.32]} size={.10} color="#dcd7bf" maxWidth={2}/></group>;
  })}<PassHouse distance={alpineLength*.30} side={-1}/><PassHouse distance={alpineLength*.945}/></>;
}
export default function AlpineLandscape(){
  const maps=useAlpineTextures(),meta=useAlpineGeography(),scans=useAlpineScans(),root=useRef<Group>(null),[sectors,setSectors]=useState(()=>alpineSectors(roadView.distance)),last=useRef(-1),clock=useRef(0),quality=usePalaceStore(s=>s.effectiveQuality),quiet=useQuietMotion();
  useFrame((_,dt)=>{clock.current+=dt;if(clock.current<.25)return;clock.current=0;const current=Math.floor(roadView.distance/alpineSectorLength);if(current!==last.current){last.current=current;setSectors(alpineSectors(roadView.distance));}});
  useLayoutEffect(()=>{root.current?.traverse(object=>{
    if(object instanceof Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])if(m instanceof MeshStandardMaterial)applyAlpineSunlight(m,maps.sun,meta.sun);
    if(object instanceof InstancedMesh||object instanceof Group)return;object.raycast=()=>{};
  });},[sectors,maps,meta,quality,quiet]);
  return <group ref={root} name="alpine-geographic-landscape"><Geography maps={maps}/><RoadSurface maps={maps}/><Viewpoints/>{sectors.map(index=><AlpineSector key={index} index={index} scans={scans}/>)}<group position={[0,alpineMap.ground(0,0),8]}><Block position={[-3.9,.6,0]} scale={[.07,1.2,.07]} color="#646d59"/><Label text="THE ALPINE DESCENT" position={[-3.9,1.35,.04]} size={.16} color="#f0e3c3" maxWidth={3}/></group></group>;
}
