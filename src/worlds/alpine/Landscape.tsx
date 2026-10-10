import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {useFrame} from "@react-three/fiber";
import {BufferGeometry,Color,CylinderGeometry,DoubleSide,Float32BufferAttribute,Group,IcosahedronGeometry,InstancedMesh,MeshStandardMaterial,Vector2,Vector3,type Texture} from "three";
import Instances,{type Instance} from "../Instances";
import {Block,Label} from "../../world/primitives";
import {usePalaceStore} from "../../systems/store";
import {useQuietMotion} from "../../motion/useMotionCue";
import {roadView,useRoadRide} from "../road/state";
import {useAlpineHeightfield,useAlpineTextures} from "./assets";
import {alpineElevation,alpineGround,alpineLength,alpineMap,alpineRibbon,alpineSectorLength,alpineSectors,nearestAlpine,sampleAlpine} from "./route";

type Maps=ReturnType<typeof useAlpineTextures>;
// 每个路段固定种子，回头与刷新仍能辨认相同的岩石、路标和草叶。
function random(seed:number){return()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};}
function terrainGeometry(points:number[],indices:number[]){const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(points,3));g.setAttribute("uv",new Float32BufferAttribute(points.flatMap((_,i)=>i%3===0?[points[i]/15,points[i+2]/15]:[]),2));g.setIndex(indices);g.computeVertexNormals();return g;}
function useLandMaterial(maps:Maps){
  const material=useMemo(()=>{
    const m=new MeshStandardMaterial({map:maps.meadow,normalMap:maps.meadowNormal,normalScale:new Vector2(.32,.32),roughness:1});
    // 坡度、高度和大尺度地表差异控制草/岩混合；原始纹理在正确色彩空间参与真实场景照明。
    m.onBeforeCompile=shader=>{
      shader.uniforms.alpineRock={value:maps.rock};
      shader.vertexShader="varying vec3 alpinePosition;varying vec3 alpineNormal;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nalpinePosition=(modelMatrix*vec4(position,1.)).xyz;alpineNormal=normalize(mat3(modelMatrix)*normal);");
      shader.fragmentShader="varying vec3 alpinePosition;varying vec3 alpineNormal;uniform sampler2D alpineRock;\nfloat alpineNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}\n"+shader.fragmentShader.replace("#include <map_fragment>",`
      vec3 w=alpinePosition,n=normalize(alpineNormal);vec3 weights=pow(abs(n),vec3(4.));weights/=max(.001,weights.x+weights.y+weights.z);
      vec3 rock=texture2D(alpineRock,w.yz/3.2).rgb*weights.x+texture2D(alpineRock,w.xz/3.2).rgb*weights.y+texture2D(alpineRock,w.xy/3.2).rgb*weights.z;
      vec2 uv=w.xz/15.;float tileNoise=alpineNoise(w.xz*.027);
      vec3 grass=mix(texture2D(map,uv).rgb,texture2D(map,mat2(.8,-.6,.6,.8)*uv*.93+vec2(.31,.73)).rgb,tileNoise);
      float farBlend=smoothstep(110.,550.,distance(cameraPosition,w));
      float large=alpineNoise(w.xz*.003)*.6+alpineNoise(w.xz*.012)*.4;
      grass=mix(grass,texture2D(map,w.xz/180.+vec2(.47,.13)).rgb*mix(.82,1.14,large),farBlend*.94);
      vec3 broadRock=texture2D(alpineRock,w.yz/57.).rgb*weights.x+texture2D(alpineRock,w.xz/57.).rgb*weights.y+texture2D(alpineRock,w.xy/57.).rgb*weights.z;
      rock=mix(rock,broadRock*mix(.86,1.10,large),farBlend*.84);
      float macro=sin(w.x*.007+sin(w.z*.006)*2.)*.5+sin(w.z*.013-w.x*.003)*.25;
      float steep=1.-abs(n.y),heightMask=smoothstep(1180.,1730.,w.y),rockMask=smoothstep(.11,.42,steep+macro*.07+heightMask*.30);
      grass*=mix(vec3(.70,1.30,.78),vec3(.98,1.43,.90),clamp(macro*.42+.5,0.,1.));
      vec3 surface=mix(grass,rock*vec3(1.08,1.08,1.02),rockMask);
      float snow=smoothstep(1590.,1890.,w.y+macro*155.)*(1.-smoothstep(.48,.85,steep));surface=mix(surface,vec3(.73,.80,.83),snow*.85);
      diffuseColor.rgb*=surface;`);
    };
    m.customProgramCacheKey=()=>"alpine-triplanar-terrain-v1";return m;
  },[maps.meadow,maps.meadowNormal,maps.rock]);
  useEffect(()=>()=>material.dispose(),[material]);return material;
}
function Geography({maps}:{maps:Maps}){
  const field=useAlpineHeightfield(),quality=usePalaceStore(s=>s.effectiveQuality),material=useLandMaterial(maps);
  const geometry=useMemo(()=>{
    const p:number[]=[],indices:number[]=[],lookup=new Map<string,number>(),stride=quality==="low"?2:1;
    const vertex=(u:number,v:number)=>{
      const key=u+":"+v;const prior=lookup.get(key);if(prior!==undefined)return prior;
      const x=field.x0+u*field.step,z=field.z0+v*field.step,index=p.length/3;
      p.push(x,alpineGround(x,z)-.035,z);lookup.set(key,index);return index;
    };
    // 一个自适应连续地表取代相互重叠的远山/路廊，消除菱形闪烁；路边细化，远处保持 DEM 分辨率。
    for(let j=0;j<field.height-1;j+=stride)for(let i=0;i<field.width-1;i+=stride){
      const x=field.x0+(i+stride*.5)*field.step,z=field.z0+(j+stride*.5)*field.step;
      const distance=nearestAlpine(x,z).distance;
      const divisions=distance<60?(quality==="low"?16:32)*stride:distance<110?10*stride:1;
      for(let b=0;b<divisions;b++)for(let a=0;a<divisions;a++){
        const u=i+a/divisions*stride,v=j+b/divisions*stride,step=stride/divisions;
        const q=[vertex(u,v),vertex(u+step,v),vertex(u,v+step),vertex(u+step,v+step)];indices.push(q[0],q[2],q[1],q[1],q[2],q[3]);
      }
    }
    return terrainGeometry(p,indices);
  },[field,quality]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group name="real-elevation-alpine-massif"><mesh geometry={geometry} material={material} receiveShadow castShadow/></group>;
}
function RoadSurface({maps}:{maps:Maps}){
  const geometries=useMemo(()=>[alpineRibbon(0,alpineLength,6.4,0,.01),...[-1,1].map(side=>alpineRibbon(0,alpineLength,.11,side*2.99,.017)),alpineRibbon(0,alpineLength,7.6,0,-.025)],[]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  return <group name="continuous-alpine-pass-road">
    <mesh geometry={geometries[3]} receiveShadow><meshStandardMaterial map={maps.rock} color="#b8ad96" roughness={1}/></mesh>
    <mesh geometry={geometries[0]} receiveShadow><meshStandardMaterial map={maps.asphalt} normalMap={maps.asphaltNormal} normalScale={[.30,.30]} color="#bec5c5" roughness={.96}/></mesh>
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
function AlpineSector({index,maps}:{index:number;maps:Maps}){
  const quality=usePalaceStore(s=>s.effectiveQuality),quiet=useQuietMotion(),root=useRef<Group>(null),riderSector=useRoadRide(s=>Math.floor(s.distance/alpineSectorLength));
  const data=useMemo(()=>{
    const rand=random(1732+index*91),start=index*alpineSectorLength,end=Math.min(alpineLength,start+alpineSectorLength),p=new Vector3(),t=new Vector3();
    sampleAlpine((start+end)/2,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz);
    const side=alpineElevation(p.x+nx/r*22,p.z+nz/r*22)<alpineElevation(p.x-nx/r*22,p.z-nz/r*22)?1:-1;
    const posts:Instance[]=[],rocks:Instance[]=[],grass:Instance[]=[],markers:Instance[]=[];
    for(let d=start+3;d<end;d+=5.8){
      sampleAlpine(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),yaw=Math.atan2(t.x,t.z);
      if(nearestAlpine(p.x+nx/r*side*3.98,p.z+nz/r*side*3.98).distance>3.50)posts.push({position:[p.x+nx/r*side*3.98,p.y+.50,p.z+nz/r*side*3.98],scale:[.09,1.04,.12],rotation:[0,yaw,0]});
      if(Math.floor(d/5.8)%4===0)markers.push({position:[p.x-nx/r*side*3.84,p.y+.37,p.z-nz/r*side*3.84],scale:[.16,.72,.17],rotation:[0,yaw,0]});
      for(const s of [-1,1]){
        const offset=(6+rand()*32)*s,x=p.x+nx/r*offset,z=p.z+nz/r*offset,y=alpineGround(x,z),size=.14+rand()**4*1.8;
        const incline=Math.hypot(alpineGround(x+1,z)-alpineGround(x-1,z),alpineGround(x,z+1)-alpineGround(x,z-1))*.5;
        // 陡壁由地形岩层承担，不在近乎直立的切坡上悬挂松散石块；缓坡石块向地面嵌入。
        if(nearestAlpine(x,z).distance>4.5&&incline<.9)rocks.push({position:[x,y-size*(.20+incline*.55),z],scale:[size*(1+rand()),size*(.45+rand()*.65),size*(1+rand())],rotation:[rand()*.6,rand()*6.28,rand()*.5],color:rand()>.5?"#c9c4af":"#a6a896"});
        for(let k=0;k<(quality==="low"?8:23);k++){
          const off=(4.1+rand()*15)*s,x=p.x+nx/r*off+(rand()-.5)*5,z=p.z+nz/r*off+(rand()-.5)*5;
          if(nearestAlpine(x,z).distance<3.8)continue;
          const h=.09+rand()*.25;grass.push({position:[x,alpineGround(x,z),z],scale:[.25+rand()*.36,h,.25+rand()*.36],rotation:[0,rand()*6.28,0],color:new Color().setHSL(.18+rand()*.035,.25+rand()*.10,.65+rand()*.15).getStyle()});
        }
      }
    }
    const boulder=new IcosahedronGeometry(1,3);const a=boulder.getAttribute("position");for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),f=.84+.13*Math.sin(x*12.7+y*7.9+z*18.1)+.06*Math.cos(y*21.);a.setXYZ(i,x*f,y*f,z*f);}boulder.computeVertexNormals();
    const blades:number[]=[],normals:number[]=[],uvs:number[]=[];
    for(let j=0;j<7;j++){
      const angle=j*2.399,x=Math.cos(angle)*.30,z=Math.sin(angle)*.30,dx=Math.cos(angle+1.57)*.035,dz=Math.sin(angle+1.57)*.035,h=.65+rand()*.35;
      blades.push(x-dx,0,z-dz,x+dx,0,z+dz,x+.16*Math.cos(angle),h,z+.16*Math.sin(angle));normals.push(0,.35,1,0,.35,1,0,.35,1);uvs.push(.08,.0,.10,.0,.095,.3);
    }
    const blade=new BufferGeometry();blade.setAttribute("position",new Float32BufferAttribute(blades,3));blade.setAttribute("normal",new Float32BufferAttribute(normals,3));blade.setAttribute("uv",new Float32BufferAttribute(uvs,2));
    return {posts,rocks,grass,markers,rail:guardrail(start,end,side),boulder,blade,post:new CylinderGeometry(.7,.7,1,4),clock:{value:0},wind:{value:quiet?0:.012}};
  },[index,quality,quiet]);
  useEffect(()=>()=>[data.rail,data.boulder,data.blade,data.post].forEach(g=>g.dispose()),[data]);
  useLayoutEffect(()=>{
    // 草叶只在顶端偏移；每帧只更新 uniform，既不抖动镜头也不触发 React 全馆重绘。
    root.current?.traverse(object=>{
      if(object instanceof InstancedMesh){const material=object.material as MeshStandardMaterial;if(material.map===maps.rock){material.bumpMap=null;material.normalMap=maps.rockNormal;material.normalScale.set(.55,.55);material.needsUpdate=true;}}
      if(object.name==="alpine-verge-grass"&&object instanceof InstancedMesh){const m=object.material as MeshStandardMaterial;m.side=DoubleSide;m.onBeforeCompile=shader=>{
      shader.uniforms.alpineWind=data.wind;shader.uniforms.alpineTime=data.clock;shader.vertexShader="uniform float alpineWind;uniform float alpineTime;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ntransformed.x+=sin(alpineTime*.7+instanceMatrix[3].x*.4)*alpineWind*uv.y;");
    };m.customProgramCacheKey=()=>"alpine-grass-wind-v1";m.needsUpdate=true;}});
  },[data,maps.rock,maps.rockNormal]);
  useFrame((_,dt)=>{if(!quiet)data.clock.value+=Math.min(.06,dt);});
  return <group ref={root} name={"alpine-sector:"+index}>
    <mesh geometry={data.rail} castShadow={Math.abs(index-riderSector)<2} receiveShadow><meshStandardMaterial color="#949b96" metalness={.68} roughness={.48} side={DoubleSide}/></mesh>
    <Instances geometry={data.post} items={data.posts} color="#939a96" metalness={.7} roughness={.5} shadows={Math.abs(index-riderSector)<2}/>
    <Instances geometry={data.post} items={data.markers} color="#dedbcc" roughness={.85}/>
    <Instances geometry={data.boulder} items={data.rocks} map={maps.rock} bumpMap={maps.rockNormal} roughness={1} shadows={Math.abs(index-riderSector)<2}/>
    <VergeGrass geometry={data.blade} items={data.grass} texture={maps.meadow}/>
  </group>;
}
function VergeGrass({geometry,items,texture}:{geometry:BufferGeometry;items:Instance[];texture:Texture}){
  const mesh=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{const temp=new Group(),color=new Color();items.forEach((item,i)=>{temp.position.set(...item.position);temp.scale.set(...item.scale);temp.rotation.set(...item.rotation??[0,0,0]);temp.updateMatrix();mesh.current!.setMatrixAt(i,temp.matrix);mesh.current!.setColorAt(i,color.set(item.color!));});mesh.current!.instanceMatrix.needsUpdate=true;mesh.current!.computeBoundingSphere();},[items]);
  return <instancedMesh ref={mesh} name="alpine-verge-grass" args={[geometry,undefined,items.length]} raycast={()=>{}}><meshStandardMaterial map={texture} roughness={1} side={DoubleSide}/></instancedMesh>;
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
  const maps=useAlpineTextures(),root=useRef<Group>(null),[sectors,setSectors]=useState(()=>alpineSectors(roadView.distance)),last=useRef(-1),clock=useRef(0);
  useFrame((_,dt)=>{clock.current+=dt;if(clock.current<.25)return;clock.current=0;const current=Math.floor(roadView.distance/alpineSectorLength);if(current!==last.current){last.current=current;setSectors(alpineSectors(roadView.distance));}});
  useLayoutEffect(()=>{root.current?.traverse(object=>{if(object instanceof InstancedMesh||object instanceof Group)return;object.raycast=()=>{};});},[sectors]);
  return <group ref={root} name="alpine-geographic-landscape"><Geography maps={maps}/><RoadSurface maps={maps}/><Viewpoints/>{sectors.map(index=><AlpineSector key={index} index={index} maps={maps}/>)}<group position={[0,alpineMap.ground(0,0),8]}><Block position={[-3.9,.6,0]} scale={[.07,1.2,.07]} color="#646d59"/><Label text="THE ALPINE DESCENT" position={[-3.9,1.35,.04]} size={.16} color="#f0e3c3" maxWidth={3}/></group></group>;
}
