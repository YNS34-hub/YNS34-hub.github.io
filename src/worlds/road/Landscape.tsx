import { useMemo,useEffect,useLayoutEffect,useRef,useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry,Float32BufferAttribute,Vector3,CylinderGeometry,PlaneGeometry,BoxGeometry,DodecahedronGeometry,MeshStandardMaterial,CanvasTexture,SRGBColorSpace,Group,Mesh,InstancedMesh,Texture } from "three";
import Instances,{type Instance} from "../Instances";
import { Block,Label } from "../../world/primitives";
import { roadLength,sectorLength,sectorCount,roadSample,roadRibbon,terrainHeight,roadForestDensity,activeRoadSectors,lake,lakeDistance,roadStops,closestRoad } from "./route";
import { roadView,useRoadRide } from "./state";
import { useRoadTextures,usePineShape,type PineShape } from "./textures";
import { useWorldTexture } from "../materials";
import { usePalaceStore } from "../../systems/store";

function seeded(initial:number){let seed=initial;return()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};}
function makeTerrain(start:number,end:number){
  const vertices:number[]=[],uv:number[]=[],colors:number[]=[],zones:number[]=[],indices:number[]=[],n=Math.ceil((end-start)/4),across=28;
  const p=new Vector3(),tangent=new Vector3();
  for(let i=0;i<=n;i++){
    roadSample(start+(end-start)*i/n,p,tangent);const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);
    for(let j=0;j<=across;j++){
      const offset=(j/across-.5)*170,x=p.x+nx/r*offset,z=p.z+nz/r*offset,y=terrainHeight(x,z);
      vertices.push(x,y,z);uv.push(x/4,z/4);
      const progress=(start+(end-start)*i/n)/roadLength;
      const enter=Math.max(0,Math.min(1,(progress-.395)/.045)),leave=Math.max(0,Math.min(1,(.63-progress)/.05));zones.push(enter*enter*(3-2*enter)*leave*leave*(3-2*leave));
      const bank=Math.min(1,Math.abs(offset)/7),meadow=roadForestDensity((start+(end-start)*i/n)/roadLength)<.3;
      colors.push(meadow?.82:.65,meadow?.85:.68,meadow?.65:.52);
      if(i<n&&j<across){const a=i*(across+1)+j;indices.push(a,a+1,a+across+1,a+1,a+across+2,a+across+1);}
      if(bank<.6){colors[colors.length-3]=.46;colors[colors.length-2]=.42;colors[colors.length-1]=.31;}
    }
  }
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(vertices,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.setAttribute("roadMeadow",new Float32BufferAttribute(zones,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
type Maps=ReturnType<typeof useRoadTextures>;
function TerrainSurface({geometry,maps}:{geometry:BufferGeometry;maps:Maps}){
  const compile=useMemo(()=>(shader:Parameters<MeshStandardMaterial["onBeforeCompile"]>[0])=>{
    shader.uniforms.roadGrassMap={value:maps.grass};
    shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nattribute float roadMeadow;varying float roadZone;").replace("#include <begin_vertex>","#include <begin_vertex>\nroadZone=roadMeadow;");
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nuniform sampler2D roadGrassMap;varying float roadZone;").replace("#include <map_fragment>","#ifdef USE_MAP\nvec4 roadSoil=texture2D(map,vMapUv);roadSoil.rgb=mix(roadSoil.rgb,texture2D(roadGrassMap,vMapUv).rgb,roadZone);diffuseColor*=roadSoil;\n#endif");
  },[maps.grass]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors map={maps.ground} roughness={.98} onBeforeCompile={compile} customProgramCacheKey={()=>"road-continuous-biomes-v1"}/></mesh>;
}
function WindField(props:Parameters<typeof Instances>[0]){
  const root=useRef<Group>(null),wind=useRef({time:{value:0},amount:{value:.08},eye:{value:new Vector3()}});
  useEffect(()=>{
    root.current?.traverse(object=>{
      if(!(object instanceof Mesh)||!(object.material instanceof MeshStandardMaterial))return;
      const material=object.material;
      material.onBeforeCompile=shader=>{
        shader.uniforms.roadTime=wind.current.time;shader.uniforms.roadWind=wind.current.amount;shader.uniforms.roadEye=wind.current.eye;
        shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nuniform float roadTime;uniform float roadWind;uniform vec3 roadEye;")
          .replace("#include <begin_vertex>","#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat nearby=1.-smoothstep(28.,85.,distance(roadEye,instanceMatrix[3].xyz));transformed.x+=sin(roadTime*1.2+instanceMatrix[3].x*.09+position.y)*roadWind*uv.y*uv.y*nearby;\n#endif");
      };
      material.customProgramCacheKey=()=>"road-near-wind-v1";material.needsUpdate=true;
    });
  },[]);
  useFrame(({camera},dt)=>{wind.current.time.value+=Math.min(dt,.06);wind.current.amount.value=.08+Math.min(1,roadView.speed/15.28)*.18;wind.current.eye.value.copy(camera.position);});
  return <group ref={root}><Instances {...props}/></group>;
}
function RoadSector({index,shadow,maps,leaves,pineShape,wood}:{index:number;shadow:boolean;maps:Maps;leaves:Texture;pineShape:PineShape;wood:BufferGeometry}){
  const quality=usePalaceStore(s=>s.effectiveQuality);
  const geometry=useMemo(()=>{
    const start=index*sectorLength,end=Math.min(roadLength,start+sectorLength),p=new Vector3(),t=new Vector3();
    const random=seeded(index+908),trunks:Instance[]=[],branches:Instance[]=[],pines:Instance[]=[],needles:Instance[]=[],broad:Instance[]=[],rocks:Instance[]=[],grass:Instance[]=[],markers:Instance[]=[];
    for(let d=start;d<end;d+=4){
      roadSample(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),density=roadForestDensity(d/roadLength);
      for(const side of [-1,1]){
        for(let j=0;j<38;j++){
          const a=side*(3.55+random()*8),x=p.x+nx/r*a+(random()-.5)*2,z=p.z+nz/r*a+(random()-.5)*2;
          if(lakeDistance(x,z)<1.02)continue;
          grass.push({position:[x,terrainHeight(x,z)+.12,z],scale:[.05+random()*.045,.14+random()*.22,1],rotation:[0,random()*Math.PI,(random()-.5)*.3],color:["#64794c","#78824f","#566d43","#858a59"][j%4]});
        }
        if(Math.floor(d/4)%7===0){const a=side*3.8;markers.push({position:[p.x+nx/r*a,p.y+.31,p.z+nz/r*a],scale:[.10,.62,.10],color:"#c7c6b5"});}
        if(random()>density)continue;
        const off=side*(6+random()*26),x=p.x+nx/r*off,z=p.z+nz/r*off;if(lakeDistance(x,z)<1.05||d<25&&x>-5&&x<7)continue;
        const birch=random()>.82,y=terrainHeight(x,z),h=birch?10+random()*5:16+random()*8,lean=(random()-.5)*.03,wide=birch?3.2+random()*1.4:2.1+random()*1.8;
        if(!birch){
          const size=h/pineShape.height,angle=random()*Math.PI*2,cs=Math.cos(angle),sn=Math.sin(angle),stride=quality==="low"?3:1;
          pines.push({position:[x,y,z],scale:[size,size,size],rotation:[0,angle,0],color:"#a29c80"});
          for(let k=0;k<pineShape.crown.length;k+=stride){const p=pineShape.crown[k],a=.85+random()*.35;
            needles.push({position:[x+(p[0]*cs+p[2]*sn)*size,y+p[1]*size,z+(-p[0]*sn+p[2]*cs)*size],scale:[.68*a*size,1.6*a*size,1],rotation:[(random()-.5)*1.5,random()*6.28,(random()-.5)*1.9],color:k%5===0?"#c9d0ae":"#b1c0a3"});
          }continue;
        }
        trunks.push({position:[x,y+h*.5,z],scale:[.23+random()*.15,h,.23+random()*.15],rotation:[lean,random()*6.28,lean],color:"#b7aa91"});
        const count=quality==="low"?80:210;
        for(let k=0;k<count;k++){
          const level=k/count,angle=k*2.4+random()*.5,spread=wide*(1-level*.65),height=h*(.40+level*.58),a=.8+random()*.5;
          if(birch){const radius=Math.sqrt(random())*wide;broad.push({position:[x+Math.cos(angle)*radius,y+h*.72+(random()-.5)*wide*1.8,z+Math.sin(angle)*radius],scale:[1.4+random()*.8,1.4+random()*.8,1],rotation:[(random()-.5)*1.8,angle,(random()-.5)],color:["#a7b792","#b9b07e","#b8c299","#baa978"][k%4]});}
          else needles.push({position:[x+Math.cos(angle)*spread*.72,y+height,z+Math.sin(angle)*spread*.72],scale:[.45*a,1.08*a,1],rotation:[-.35+(random()-.5)*.45,angle,(random()-.5)*1.6],color:level>.80?"#c2cbb0":side>0?"#9daa92":"#b1bda0"});
          if(k%20===0)branches.push({position:[x+Math.cos(angle)*spread*.25,y+height-.25,z+Math.sin(angle)*spread*.25],scale:[.035,spread*.7,.035],rotation:[Math.cos(angle)*1.0,0,Math.sin(angle)*1.0],color:"#9a8e76"});
        }
        if(random()>.6&&d>25){const a=side*(5.2+random()*8),rx=p.x+nx/r*a,rz=p.z+nz/r*a;rocks.push({position:[rx,terrainHeight(rx,rz)+.10,rz],scale:[.3+random()*.7,.2+random()*.3,.35+random()*.6],rotation:[random(),random()*6,random()],color:"#899088"});}
      }
    }
    const stem=new CylinderGeometry(.06,.65,1,12),leaf=new PlaneGeometry(1,1),stone=new DodecahedronGeometry(1,1),cube=new BoxGeometry(1,1,1);
    const blade=new BufferGeometry(),gp:number[]=[],guv:number[]=[],gi:number[]=[];
    // 同一低成本草簇中也区分叶高、宽度与弯曲，停稳时不能呈现九片等高的平行条带。
    const bladeRandom=seeded(617);
    for(let b=0;b<9;b++){
      const angle=b*2.4,dx=Math.cos(angle)*(.6+bladeRandom()*1.1),dz=Math.sin(angle)*.055,n=gp.length/3;
      const height=.55+bladeRandom()*.7,width=.12+bladeRandom()*.16,bend=(bladeRandom()-.5)*1.1;
      gp.push(dx-width,-.5,dz,dx+width,-.5,dz,dx+bend*.35-width*.55,-.5+height*.58,dz+.03,dx+bend*.35+width*.55,-.5+height*.58,dz+.03,dx+bend,-.5+height,dz+.075);
      guv.push(0,0,1,0,0,.58,1,.58,.5,1);gi.push(n,n+1,n+2,n+1,n+3,n+2,n+2,n+3,n+4);
    }
    blade.setAttribute("position",new Float32BufferAttribute(gp,3));blade.setAttribute("uv",new Float32BufferAttribute(guv,2));blade.setIndex(gi);blade.computeVertexNormals();
    const road=roadRibbon(start,end,6.4),edges=[roadRibbon(start,end,.1,-2.95,.012),roadRibbon(start,end,.1,2.95,.012)];
    return{start,end,terrain:makeTerrain(start,end),road,edges,stem,leaf,stone,cube,blade,trunks,branches,pines,needles,broad,rocks,grass,markers};
  },[index,quality,pineShape]);
  useEffect(()=>()=>{[geometry.terrain,geometry.road,...geometry.edges,geometry.stem,geometry.leaf,geometry.stone,geometry.cube,geometry.blade].forEach(g=>g.dispose());},[geometry]);
  return <group name={"road-sector:"+index}>
    <TerrainSurface geometry={geometry.terrain} maps={maps}/>
    <mesh name="authored-paved-road" geometry={geometry.road} receiveShadow><meshStandardMaterial color="#7b8384" map={maps.asphalt} normalMap={maps.normal} normalScale={[.22,.22]} roughness={.91}/></mesh>
    {geometry.edges.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color="#d5d3bd" roughness={.94}/></mesh>)}
    <Instances geometry={geometry.stem} items={geometry.trunks} color="#9c8e78" map={maps.bark} shadows={shadow}/>
    <Instances geometry={wood} items={geometry.pines} map={maps.bark} shadows={shadow}/>
    <Instances geometry={geometry.stem} items={geometry.branches} color="#7a725f" shadows={shadow}/>
    <WindField geometry={geometry.leaf} items={geometry.needles} map={maps.pine} cutout shadows={shadow}/>
    <WindField geometry={geometry.leaf} items={geometry.broad} map={leaves} cutout shadows={shadow}/>
    <Instances geometry={geometry.stone} items={geometry.rocks} color="#8f9387" roughness={1}/>
    <WindField geometry={geometry.blade} items={geometry.grass} color="#83925f" cutout/>
    <Instances geometry={geometry.cube} items={geometry.markers} color="#bebfae"/>
  </group>;
}
function Geography({maps,pineShape}:{maps:Maps;pineShape:PineShape}){
  const shape=useMemo(()=>{
    const points:number[]=[],uv:number[]=[],indices:number[]=[],n=145;
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
      const px=x/n*2400-550,pz=z/n*2500-1920;points.push(px,terrainHeight(px,pz)-2.2,pz);uv.push(px/8,pz/8);
      if(z<n&&x<n){const a=z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
    }
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(points,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const ridge:number[]=[],ridgeUv:number[]=[],ridgeColors:number[]=[],ix:number[]=[],cols=220,rows=65;
    for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){
      const wx=(x/cols-.5)*3600,wz=z/rows*1200,peak=150+140*Math.sin(wx*.0033+.8)**2+75*Math.sin(wx*.0097+2)**2;
      const erosion=(Math.sin(wx*.038+wz*.011)*Math.sin(wz*.041)*24+Math.sin(wx*.097+wz*.089)*8),height=(peak+erosion)*Math.sin(z/rows*Math.PI)**.85+8;
      ridge.push(wx,height,wz);ridgeUv.push(wx/20,wz/20);const crag=.68+.28*Math.sin(wx*.026+wz*.011)**2;
      ridgeColors.push(crag*.91,crag*.96,crag*.92);
      if(x<cols&&z<rows){const a=z*(cols+1)+x;ix.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
    }
    const r=new BufferGeometry();r.setAttribute("position",new Float32BufferAttribute(ridge,3));r.setAttribute("uv",new Float32BufferAttribute(ridgeUv,2));r.setAttribute("color",new Float32BufferAttribute(ridgeColors,3));r.setIndex(ix);r.computeVertexNormals();
    // 远林用同一松针图像离线式合成的透明树冠；不用近处可识别的实体圆锥代替森林。
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=1024;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#5c6350";ctx.fillRect(250,130,9,894);
    const painter=seeded(991);for(const p of pineShape.crown){const x=256+p[0]*48,y=1024-p[1]/pineShape.height*1010;ctx.save();ctx.translate(x,y);ctx.rotate((painter()-.5)*1.6);ctx.drawImage(maps.pine.image as CanvasImageSource,-15,-36,30,72);ctx.restore();}
    const crown=new CanvasTexture(canvas);crown.colorSpace=SRGBColorSpace;crown.anisotropy=2;
    const tree=new PlaneGeometry(1,1),forest:Instance[]=[],random=seeded(417);
    for(let i=0;i<4000;i++){
      const x=-300+random()*2000,z=-1520+random()*1750;
      const h=terrainHeight(x,z),near=closestRoad(x,z);if(lakeDistance(x,z)<1.10||h<10||near.distance<90||near.distance<180&&roadForestDensity(near.progress)<.25)continue;
      const height=13+random()*7,width=height*.50,a=random()*Math.PI;for(const angle of [a,a+Math.PI/2])forest.push({position:[x,h+height/2,z],scale:[width,height,1],rotation:[0,angle,0],color:["#a5b3a5","#b3bba6","#8faca0"][i%3]});
    }
    return{g,r,tree,forest,crown};
  },[maps.pine.image,pineShape]);
  useEffect(()=>()=>{shape.g.dispose();shape.r.dispose();shape.tree.dispose();shape.crown.dispose();},[shape]);
  return <group name="continuous-lake-valley-geography">
    <mesh geometry={shape.g}><meshStandardMaterial color="#b0b29a" map={maps.grass} roughness={1}/></mesh>
    <mesh geometry={shape.r} position={[550,0,-1400]} rotation={[0,Math.PI,0]}><meshStandardMaterial vertexColors color="#a2b6b3" map={maps.ground} roughness={1}/></mesh>
    <mesh geometry={shape.r} position={[-650,-40,-750]} rotation={[0,-Math.PI/2,0]} scale={[1,.8,1]}><meshStandardMaterial vertexColors color="#bbc6ba" map={maps.ground} roughness={1}/></mesh>
    <mesh geometry={shape.r} position={[1750,-35,-800]} rotation={[0,Math.PI/2,0]} scale={[1,.8,1]}><meshStandardMaterial vertexColors color="#bbc6ba" map={maps.ground} roughness={1}/></mesh>
    <mesh geometry={shape.r} position={[500,-55,600]} scale={[1,.85,1]}><meshStandardMaterial vertexColors color="#c8c3ad" map={maps.ground} roughness={1}/></mesh>
    <Instances geometry={shape.tree} items={shape.forest} map={shape.crown} color="#adb8ab" cutout/>
  </group>;
}
function RoadLake(){
  const uniforms=useRef({time:{value:0}});
  useFrame((_,dt)=>{uniforms.current.time.value+=Math.min(dt,.06);});
  // 有限天空反射与波面法线，明确不声称倒映山体；不用额外相机和实时反射目标。
  const vertex="varying vec3 waterWorld;varying vec2 waterLocal;void main(){waterWorld=(modelMatrix*vec4(position,1.)).xyz;waterLocal=position.xy;gl_Position=projectionMatrix*viewMatrix*vec4(waterWorld,1.);}";
  const fragment=`uniform float time;varying vec3 waterWorld;varying vec2 waterLocal;
  void main(){vec2 p=waterWorld.xz;float t=time;vec3 n=normalize(vec3(sin(p.x*.33+p.y*.17+t*.39)*.019+sin(p.y*.91-p.x*.31-t*.55)*.010,1.,cos(p.y*.29+p.x*.11-t*.34)*.018+sin(p.x*.76+p.y*.47+t*.48)*.008));
  vec3 v=normalize(cameraPosition-waterWorld);vec3 r=reflect(-v,n);float f=.02+.98*pow(1.-max(0.,dot(n,v)),5.);
  vec3 depth=mix(vec3(.028,.105,.119),vec3(.061,.144,.136),smoothstep(.75,1.,length(waterLocal)));
  vec3 sky=mix(vec3(.245,.345,.39),vec3(.065,.18,.28),pow(max(0.,r.y),.45));
  float shimmer=pow(max(0.,dot(n,normalize(v+normalize(vec3(-.67,.28,-.53))))),240.);
  vec3 c=mix(depth,sky,f*.68)+vec3(.75,.50,.24)*shimmer*.65;gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`;
  return <mesh name="long-way-home-lake" position={[lake.x,lake.y,lake.z]} rotation={[-Math.PI/2,0,0]} scale={[lake.rx,lake.rz,1]}>
    <circleGeometry args={[1,120]}/><shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms.current}/>
  </mesh>;
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
function RoadStops(){
  return <>{roadStops.map((stop,i)=>{
    const p=new Vector3(),t=new Vector3();roadSample(stop.distance,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),side=Math.sign(nx*(lake.x-p.x)+nz*(lake.z-p.z))||1;
    return <group key={i} position={[p.x+nx/r*4.7*side,p.y-.08,p.z+nz/r*4.7*side]} rotation={[0,Math.atan2(t.x,t.z),0]}>
      <Block position={[0,-.22,0]} scale={[4,.42,5]} color="#969990" roughness={1}/>
      <Block position={[1.05,.49,1.5]} scale={[1.8,.1,.46]} color="#887a5a" roughness={.72}/>
      {[-.65,.65].map(x=><Block key={x} position={[1.05+x,.24,1.5]} scale={[.07,.49,.40]} color="#596260" metalness={.3}/>)}
      <Block position={[-1.6,.55,1.9]} scale={[.075,1.1,.075]} color="#626c66"/>
      <Label text={stop.title} position={[-1.6,1.15,1.92]} size={.13} color="#e4d7bb" maxWidth={2}/>
    </group>;
  })}</>;
}
export default function RoadLandscape(){
  const scenery=useRef<Group>(null);
  const maps=useRoadTextures();
  const pineShape=usePineShape(),wood=useMemo(()=>{const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(pineShape.position,3));g.setAttribute("normal",new Float32BufferAttribute(pineShape.normal,3));g.setAttribute("uv",new Float32BufferAttribute(pineShape.uv,2));g.setIndex(pineShape.index);return g;},[pineShape]);
  useEffect(()=>()=>wood.dispose(),[wood]);
  const leaves=useWorldTexture("leaves");
  const [sectors,setSectors]=useState(()=>activeRoadSectors(roadView.distance)),last=useRef(-1),tick=useRef(0);
  // 草木与远山没有交互入口，跳过几十万个实例的导航射线测试；近处路面和自行车仍正常拾取。
  useLayoutEffect(()=>{scenery.current?.traverse(object=>{if(object instanceof InstancedMesh||object.parent?.name==="continuous-lake-valley-geography"||object.name==="long-way-home-lake")object.raycast=()=>{};});},[sectors]);
  useFrame((_,delta)=>{tick.current+=delta;if(tick.current<.25)return;tick.current=0;const sector=Math.min(sectorCount-1,Math.floor(roadView.distance/sectorLength));if(sector!==last.current){last.current=sector;setSectors(activeRoadSectors(roadView.distance));}});
  const current=useRoadRide(s=>Math.floor(s.distance/sectorLength));
  return <group ref={scenery} name="authored-road-cycling-landscape"><Geography maps={maps} pineShape={pineShape}/><RoadLake/><RoadStops/><Trailhead/>{sectors.map(index=><RoadSector key={index} index={index} maps={maps} leaves={leaves} pineShape={pineShape} wood={wood} shadow={Math.abs(index-current)<2}/>)}</group>;
}
