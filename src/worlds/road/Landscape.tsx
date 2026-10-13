import { useMemo,useEffect,useLayoutEffect,useRef,useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry,Float32BufferAttribute,Vector3,BoxGeometry,MeshStandardMaterial,Group,InstancedMesh } from "three";
import Instances,{type Instance} from "../Instances";
import { Block,Label } from "../../world/primitives";
import { roadLength,sectorLength,sectorCount,roadSample,roadRibbon,terrainHeight,roadForestDensity,activeRoadSectors,lake,lakeDistance,roadStops,closestRoad } from "./route";
import { roadView,useRoadRide } from "./state";
import { useRoadTextures,useRidgeSamples } from "./textures";
import ForestTrees,{useForestAssets,type ForestAssets,type ForestTree} from "../scenery/ForestTrees";
import { usePalaceStore } from "../../systems/store";
import { useQuietMotion } from "../../motion/useMotionCue";
import {dryRoadMaterial,weatheredEdgePaint} from "../scenery/roadFinish";
import {createShoulders,createVergeGrass,createRoadsideDetails,shoulderMaterial,roadsideDetailMaterials} from "../scenery/roadside";
import RoadsideDetails from "../scenery/RoadsideDetails";
import {habitat,terrainSampler} from "../scenery/ecology";
import {createValleyRidges} from "../scenery/landforms";
import {valleyTerrainMaterial} from "../scenery/terrainFinish";
import {createValleyFloor} from "./valleyFloor";
import RoadLake from "./Lake";
import {GrassField,useAlpineGrass} from "../alpine/Grass";
import {ScanInstances,useAlpineScans} from "../alpine/Scans";
import Delineators from "../Delineators";
import { createStopApron,insideStopApron,stopGroundHeight } from "./stopApron";

function seeded(initial:number){let seed=initial;return()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};}
function makeTerrain(start:number,end:number){
  const vertices:number[]=[],uv:number[]=[],colors:number[]=[],zones:number[]=[],sides:number[]=[],indices:number[]=[],n=Math.ceil((end-start)/4),across=28;
  const p=new Vector3(),tangent=new Vector3();
  for(let i=0;i<=n;i++){
    roadSample(start+(end-start)*i/n,p,tangent);const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);
    for(let j=0;j<=across;j++){
      const offset=(j/across-.5)*170,x=p.x+nx/r*offset,z=p.z+nz/r*offset,y=terrainHeight(x,z);
      vertices.push(x,y,z);uv.push(x/4,z/4);sides.push(offset);
      const progress=(start+(end-start)*i/n)/roadLength;
      const enter=Math.max(0,Math.min(1,(progress-.395)/.045)),leave=Math.max(0,Math.min(1,(.63-progress)/.05));zones.push(enter*enter*(3-2*enter)*leave*leave*(3-2*leave));
      const bank=Math.min(1,Math.abs(offset)/7),meadow=roadForestDensity((start+(end-start)*i/n)/roadLength)<.3;
      colors.push(meadow?.82:.65,meadow?.85:.68,meadow?.65:.52);
      if(i<n&&j<across){const a=i*(across+1)+j;indices.push(a,a+1,a+across+1,a+1,a+across+2,a+across+1);}
      if(bank<.6){colors[colors.length-3]=.46;colors[colors.length-2]=.42;colors[colors.length-1]=.31;}
    }
  }
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(vertices,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.setAttribute("roadMeadow",new Float32BufferAttribute(zones,1));g.setAttribute("roadOffset",new Float32BufferAttribute(sides,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
type Maps=ReturnType<typeof useRoadTextures>;
function TerrainSurface({geometry,maps}:{geometry:BufferGeometry;maps:Maps}){
  const compile=useMemo(()=>(shader:Parameters<MeshStandardMaterial["onBeforeCompile"]>[0])=>{
    shader.uniforms.roadGrassMap={value:maps.meadow};
    shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nattribute float roadMeadow;attribute float roadOffset;varying float roadZone;varying float roadSide;varying vec3 shoreWorld;").replace("#include <begin_vertex>","#include <begin_vertex>\nroadZone=roadMeadow;roadSide=roadOffset;shoreWorld=(modelMatrix*vec4(position,1.)).xyz;");
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`#include <common>
      uniform sampler2D roadGrassMap;varying float roadZone;varying float roadSide;varying vec3 shoreWorld;
      float soilNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
    `).replace("#include <map_fragment>",`#ifdef USE_MAP
      vec4 roadSoil=texture2D(map,vMapUv);
      // 两个取向的实拍土壤减少棋盘重复，林地局部保留苔草，路肩过渡以米计。
      roadSoil.rgb=mix(roadSoil.rgb,texture2D(map,mat2(.8,-.6,.6,.8)*vMapUv*.83+vec2(.37,.19)).rgb,.30);
      float humus=dot(roadSoil.rgb,vec3(.2126,.7152,.0722));
      roadSoil.rgb=mix(roadSoil.rgb,vec3(humus)*vec3(.88,.96,.83),.36);
      float groundPatch=soilNoise(vMapUv*.28);
      float floorGreen=.68+.16*smoothstep(.32,.7,groundPatch);
      roadSoil.rgb=mix(roadSoil.rgb,texture2D(roadGrassMap,vMapUv*.86).rgb,max(roadZone,floorGreen));
      float soilVariation=mix(soilNoise(vMapUv*.09),soilNoise(vMapUv*.57),.28);
      float shoulder=1.-smoothstep(3.3+groundPatch*.4,5.1+groundPatch*1.4,abs(roadSide));
      vec3 mineral=vec3(dot(roadSoil.rgb,vec3(.2126,.7152,.0722)))*vec3(.90,.91,.87);
      float shoreRadius=length((shoreWorld.xz-vec2(${lake.x.toFixed(1)},${lake.z.toFixed(1)}))/vec2(${lake.rx.toFixed(1)},${lake.rz.toFixed(1)}));
      float shoreWet=(1.-smoothstep(.04,.9,abs(shoreWorld.y-${lake.y})))*(1.-smoothstep(1.22,1.45,shoreRadius));
      roadSoil.rgb=mix(roadSoil.rgb,mineral,shoulder*.68)*(.91+.15*soilVariation)*mix(1.,.60,shoreWet);diffuseColor*=roadSoil;
      #endif`);
  },[maps.meadow]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors map={maps.ground} roughness={.98} onBeforeCompile={compile} customProgramCacheKey={()=>"road-continuous-biomes-shoulder-v5"}/></mesh>;
}
function RoadSector({index,shadow,maps,forestAssets,scans,grassTemplates,verge,details}:{index:number;shadow:boolean;maps:Maps;forestAssets:ForestAssets;scans:ReturnType<typeof useAlpineScans>;grassTemplates:ReturnType<typeof useAlpineGrass>;verge:MeshStandardMaterial;details:ReturnType<typeof roadsideDetailMaterials>}){
  const quality=usePalaceStore(s=>s.effectiveQuality),quiet=useQuietMotion();
  const asphalt=useMemo(()=>dryRoadMaterial(maps.asphalt,maps.normal,[2,5],6.4),[maps.asphalt,maps.normal]);
  useEffect(()=>()=>asphalt.dispose(),[asphalt]);
  const geometry=useMemo(()=>{
    const start=index*sectorLength,end=Math.min(roadLength,start+sectorLength),p=new Vector3(),t=new Vector3();
    const random=seeded(index+908),terrain=makeTerrain(start,end),ground=terrainSampler(terrain,terrainHeight);
    const trees:ForestTree[]=[],rocks:Instance[]=[],grass:Instance[][]=Array.from({length:6},()=>[]),markers:Instance[]=[];
    for(let d=start;d<end;d+=4){
      roadSample(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),density=roadForestDensity(d/roadLength);
      for(const side of [-1,1]){
        const herbs=seeded(index*1793+Math.round(d)*17+(side+1)*433);
        for(let j=0;j<23;j++){
          const a=side*(3.7+herbs()**1.5*17),along=(herbs()-.5)*5,tr=Math.hypot(t.x,t.z),x=p.x+nx/r*a+t.x/tr*along,z=p.z+nz/r*a+t.z/tr*along;
          if(lakeDistance(x,z)<1.035||insideStopApron(x,z)||closestRoad(x,z).distance<3.6||herbs()> .30+.68*habitat(x,z))continue;
          const height=.30+herbs()*.38,width=.42+herbs()*.37,detailed=j<9&&Math.abs(a)<13&&quality!=="low";
          grass[(detailed?0:3)+j%3].push({position:[x,ground(x,z)-.018,z],scale:[width,height,width],rotation:[0,herbs()*6.28,0]});
        }
        if(Math.floor(d/4)%7===0){const a=side*3.8;markers.push({position:[p.x+nx/r*a,p.y+.31,p.z+nz/r*a],scale:[.10,.62,.10],color:"#c7c6b5"});}
        const off=side*(5.8+random()**2.15*35),along=(random()-.5)*7,tr=Math.hypot(t.x,t.z),x=p.x+nx/r*off+t.x/tr*along,z=p.z+nz/r*off+t.z/tr*along;
        if(random()>density*(.75+habitat(x,z)*.65)||lakeDistance(x,z)<1.09||closestRoad(x,z).distance<5.5||d<25&&x>-5&&x<7)continue;
        const y=ground(x,z),angle=random()*Math.PI*2,juvenile=random()<.19;
        const model=juvenile?1:0,variant=juvenile?Math.floor(random()*3):angle/(Math.PI*2)<.62?1:0;
        const size=juvenile?1.15+random()*1.7:.83+random()*.83;
        trees.push({model,variant,position:[x,y-.014,z],scale:[size*(.87+random()*.27),size,size*(.91+random()*.22)],rotation:[0,angle,0]});
        // 林下幼苗沿已有生态密度成小簇，留出公路、湖岸和停靠区；不是沿每个路段放同一棵树。
        const saplingRandom=seeded(Math.round(x*31+z*53)+1781);
        if(saplingRandom()<.40)for(let j=0;j<2;j++){
          const a=saplingRandom()*Math.PI*2,radius=1.6+saplingRandom()*3,sx=x+Math.cos(a)*radius,sz=z+Math.sin(a)*radius;
          if(closestRoad(sx,sz).distance<4.5||lakeDistance(sx,sz)<1.09||insideStopApron(sx,sz))continue;
          const scale=.75+saplingRandom()*1.1;trees.push({model:1,variant:j%3,position:[sx,ground(sx,sz)-.012,sz],scale:[scale,scale,scale],rotation:[0,saplingRandom()*Math.PI*2,0]});
        }
        if(random()>.68&&d>25){const a=side*(4.6+random()*14),rx=p.x+nx/r*a,rz=p.z+nz/r*a,size=.5+random()*1.8;if(closestRoad(rx,rz).distance>4.1&&!insideStopApron(rx,rz))rocks.push({position:[rx,ground(rx,rz)-size*.12,rz],scale:[size*1.3,size*.65,size],rotation:[0,random()*6,0]});}
      }
    }
    const cube=new BoxGeometry(1,1,1);
    const roadStart=index===0?-12:start;
    const road=roadRibbon(roadStart,end,6.4),edges=[roadRibbon(roadStart,end,.1,-2.95,.012),roadRibbon(roadStart,end,.1,2.95,.012)];
    const site={kind:"forest" as const,sample:roadSample,ground,nearest:(x:number,z:number)=>closestRoad(x,z).distance,blocked:insideStopApron};
    const shoulders=createShoulders(roadStart,end,site),intrusion=createVergeGrass(start,end,site,shoulders),small=createRoadsideDetails(start,end,site,shoulders);
    intrusion.forEach((items,i)=>grass[i].push(...(quality==="low"?items.filter((_,j)=>j%3===0):items)));
    return{start,end,terrain,road,edges,shoulders,small,cube,trees,rocks,grass,farGrass:grass.slice(3).map((items,i)=>[...items,...grass[i]]),markers,time:{value:0},wind:{value:quiet?0:.012}};
  },[index,quality,quiet]);
  useEffect(()=>()=>{[geometry.terrain,geometry.road,...geometry.edges,geometry.shoulders,geometry.small.drains,geometry.cube].forEach(g=>g.dispose());},[geometry]);
  useFrame((_,dt)=>{if(!quiet)geometry.time.value+=Math.min(.06,dt);});
  return <group name={"road-sector:"+index}>
    <TerrainSurface geometry={geometry.terrain} maps={maps}/>
    <mesh name="authored-paved-road" geometry={geometry.road} receiveShadow material={asphalt}/>
    <mesh name="grounded-road-shoulder" geometry={geometry.shoulders} receiveShadow material={verge} dispose={null}/>
    <RoadsideDetails data={geometry.small} scan={scans[0]} materials={details}/>
    {geometry.edges.map((g,i)=><mesh key={i} geometry={g} receiveShadow><meshStandardMaterial color="#c9c6b7" roughness={.96} onUpdate={m=>weatheredEdgePaint(m,[2,5])}/></mesh>)}
    <ForestTrees trees={geometry.trees} assets={forestAssets} shadows={shadow}/>
    <ScanInstances scan={scans[0]} items={geometry.rocks} shadows={shadow}/>
    {grassTemplates.map((template,i)=><GrassField key={i} template={template} items={i<3?geometry.grass[i]:geometry.farGrass[i-3]} time={geometry.time} wind={geometry.wind} near={i<3} blend={quality!=="low"}/>)}
    <Instances geometry={geometry.cube} items={geometry.markers} color="#bebfae"/>
    <Delineators items={geometry.markers} stem={geometry.cube}/>
  </group>;
}
function Geography({maps,forestAssets}:{maps:Maps;forestAssets:ForestAssets}){
  const samples=useRidgeSamples();
  const groundMaterial=useMemo(()=>valleyTerrainMaterial(maps),[maps]),mountainMaterial=useMemo(()=>valleyTerrainMaterial(maps,true),[maps]);
  useEffect(()=>()=>{groundMaterial.dispose();mountainMaterial.dispose();},[groundMaterial,mountainMaterial]);
  const shape=useMemo(()=>{
    const g=createValleyFloor();
    const ridges=createValleyRidges(samples);
    // 远林必须落在实际粗网格三角形上，不能把精细高度加到下移后的远景表面而悬空。
    const farGround=terrainSampler(g,terrainHeight);
    const forest:ForestTree[]=[],random=seeded(417);
    for(let i=0;i<4000;i++){
      const x=-300+random()*2000,z=-1520+random()*1750;
      const h=terrainHeight(x,z),near=closestRoad(x,z);if(lakeDistance(x,z)<1.13||h<10||near.distance<125||near.distance<200&&roadForestDensity(near.progress)<.25||random()>habitat(x,z)*.92+.05)continue;
      const size=.75+random()*.85,a=random()*Math.PI*2;forest.push({model:0,variant:a/Math.PI<1.24?1:0,position:[x,farGround(x,z)-.012,z],scale:[size*(.86+random()*.28),size,size],rotation:[0,a,0]});
    }
    return{g,ridges,forest};
  },[samples]);
  useEffect(()=>()=>{shape.g.dispose();shape.ridges.forEach(g=>g.dispose());},[shape]);
  return <group name="continuous-lake-valley-geography">
    <mesh geometry={shape.g} material={groundMaterial} dispose={null}/>
    {shape.ridges.map(g=><mesh key={g.name} name={g.name} geometry={g} material={mountainMaterial} dispose={null}/>)}
    <ForestTrees trees={shape.forest} assets={forestAssets}/>
  </group>;
}
function Trailhead(){
  return <group position={[0,18,0]} name="museum-nature-threshold">
    <Block position={[-3.2,1.9,8]} scale={[.4,3.8,6]} color="#70868b" roughness={.55}/>
    <Block position={[3.2,1.9,8]} scale={[.4,3.8,6]} color="#70868b" roughness={.55}/>
    <Block position={[0,3.99,8]} scale={[6.8,.38,6]} color="#526970" roughness={.55}/>
    <Block position={[0,-.12,8]} scale={[6.8,.2,6]} color="#627779" roughness={.75}/>
    <Block position={[-4.6,.2,6]} scale={[.15,.03,4]} color="#ccb797" emissive="#dcc99e" emissiveIntensity={.2}/>
    <Label text="THE LONG WAY HOME" position={[-3,2.35,5.1]} size={.18} color="#d4d8ce" maxWidth={3}/>
    <Label text="A RIDE THROUGH MEMORY" position={[-3,1.99,5.1]} size={.095} color="#bdc9c8" maxWidth={3}/>
  </group>;
}
function GroundedStopApron({distance,side,origin,yaw,maps}:{distance:number;side:-1|1;origin:[number,number,number];yaw:number;maps:Maps}){
  const [x,y,z]=origin;
  const geometry=useMemo(()=>{
    const g=createStopApron(distance,side);g.translate(-x,-y,-z);g.rotateY(-yaw);return g;
  },[distance,side,x,y,z,yaw]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="grounded-scenic-stop-apron" geometry={geometry} receiveShadow><meshStandardMaterial color="#c9c3ad" map={maps.asphalt} normalMap={maps.normal} normalScale={[.12,.12]} roughness={.96}/></mesh>;
}
function RoadStops({maps}:{maps:Maps}){
  return <>{roadStops.map((stop,i)=>{
    const p=new Vector3(),t=new Vector3();roadSample(stop.distance,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),side=(nx*(lake.x-p.x)+nz*(lake.z-p.z)>=0?1:-1) as -1|1;
    const x=p.x+nx/r*4.7*side,z=p.z+nz/r*4.7*side,y=stopGroundHeight(x,z,stop.distance)+.045,yaw=Math.atan2(t.x,t.z);
    const groundAt=(a:number,b:number)=>stopGroundHeight(x+Math.cos(yaw)*a+Math.sin(yaw)*b,z-Math.sin(yaw)*a+Math.cos(yaw)*b,stop.distance)+.045-y;
    const benchX=-.30*side,feet=[-.65,.65].map(dx=>({x:benchX+dx,y:groundAt(benchX+dx,1.5)})),seatY=Math.max(...feet.map(f=>f.y))+.49,signX=-1.6*side,signY=groundAt(signX,1.9);
    return <group key={i} name={"road-scenic-stop:"+i} position={[x,y,z]} rotation={[0,yaw,0]}>
      <GroundedStopApron distance={stop.distance} side={side} origin={[x,y,z]} yaw={yaw} maps={maps}/>
      <Block position={[benchX,seatY,1.5]} scale={[1.8,.1,.46]} color="#887a5a" roughness={.72}/>
      {feet.map(foot=>{const height=seatY-.03-foot.y;return <Block key={foot.x} position={[foot.x,foot.y+height*.5,1.5]} scale={[.07,height,.40]} color="#596260" metalness={.3}/>;})}
      <Block position={[signX,signY+.55,1.9]} scale={[.075,1.1,.075]} color="#626c66"/>
      <Label text={stop.title} position={[signX,signY+1.15,1.92]} size={.13} color="#e4d7bb" maxWidth={2}/>
    </group>;
  })}</>;
}
export default function RoadLandscape(){
  const scenery=useRef<Group>(null);
  const maps=useRoadTextures();
  const verge=useMemo(()=>shoulderMaterial(maps.rock,maps.rockNormal,maps.ground),[maps]);
  useEffect(()=>()=>verge.dispose(),[verge]);
  const scans=useAlpineScans(),grassTemplates=useAlpineGrass();
  const details=useMemo(()=>roadsideDetailMaterials(scans[0].material),[scans]);useEffect(()=>()=>{details.stone.dispose();details.drain.dispose();},[details]);
  const forestAssets=useForestAssets();
  const [sectors,setSectors]=useState(()=>activeRoadSectors(roadView.distance)),last=useRef(-1),tick=useRef(0);
  // 草木与远山没有交互入口，跳过几十万个实例的导航射线测试；近处路面和自行车仍正常拾取。
  useLayoutEffect(()=>{scenery.current?.traverse(object=>{if(object instanceof InstancedMesh||object.parent?.name==="continuous-lake-valley-geography"||object.name==="long-way-home-lake")object.raycast=()=>{};});},[sectors]);
  useFrame((_,delta)=>{tick.current+=delta;if(tick.current<.25)return;tick.current=0;const sector=Math.min(sectorCount-1,Math.floor(roadView.distance/sectorLength));if(sector!==last.current){last.current=sector;setSectors(activeRoadSectors(roadView.distance));}});
  const current=useRoadRide(s=>Math.floor(s.distance/sectorLength));
  return <group ref={scenery} name="authored-road-cycling-landscape"><Geography maps={maps} forestAssets={forestAssets}/><RoadLake scans={scans} grassTemplates={grassTemplates}/><RoadStops maps={maps}/><Trailhead/>{sectors.map(index=><RoadSector key={index} index={index} maps={maps} forestAssets={forestAssets} scans={scans} grassTemplates={grassTemplates} verge={verge} details={details} shadow={Math.abs(index-current)<2}/>)}</group>;
}
