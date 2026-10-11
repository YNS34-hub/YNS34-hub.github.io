import { useMemo,useEffect,useLayoutEffect,useRef,useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry,Float32BufferAttribute,Vector3,CylinderGeometry,PlaneGeometry,BoxGeometry,MeshStandardMaterial,CanvasTexture,SRGBColorSpace,Group,Mesh,InstancedMesh,Texture } from "three";
import Instances,{type Instance} from "../Instances";
import { Block,Label } from "../../world/primitives";
import { roadLength,sectorLength,sectorCount,roadSample,roadRibbon,terrainHeight,roadForestDensity,activeRoadSectors,lake,lakeDistance,roadStops,closestRoad } from "./route";
import { roadView,useRoadRide } from "./state";
import { useRoadTextures,usePineShape,useRidgeSamples,type PineShape } from "./textures";
import { useWorldTexture } from "../materials";
import { usePalaceStore } from "../../systems/store";
import { useQuietMotion } from "../../motion/useMotionCue";
import {dryRoadMaterial,weatheredEdgePaint} from "../scenery/roadFinish";
import {habitat,terrainSampler} from "../scenery/ecology";
import {createValleyRidges} from "../scenery/landforms";
import {valleyTerrainMaterial} from "../scenery/terrainFinish";
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
    shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nattribute float roadMeadow;attribute float roadOffset;varying float roadZone;varying float roadSide;").replace("#include <begin_vertex>","#include <begin_vertex>\nroadZone=roadMeadow;roadSide=roadOffset;");
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`#include <common>
      uniform sampler2D roadGrassMap;varying float roadZone;varying float roadSide;
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
      roadSoil.rgb=mix(roadSoil.rgb,mineral,shoulder*.68)*(.91+.15*soilVariation);diffuseColor*=roadSoil;
      #endif`);
  },[maps.meadow]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors map={maps.ground} roughness={.98} onBeforeCompile={compile} customProgramCacheKey={()=>"road-continuous-biomes-shoulder-v4"}/></mesh>;
}
function WindField(props:Parameters<typeof Instances>[0]){
  const quiet=useQuietMotion();
  const root=useRef<Group>(null),wind=useRef({time:{value:0},amount:{value:.08},eye:{value:new Vector3()}});
  useEffect(()=>{
    root.current?.traverse(object=>{
      if(!(object instanceof Mesh)||!(object.material instanceof MeshStandardMaterial))return;
      const material=object.material;
      if(props.map){material.alphaToCoverage=true;material.forceSinglePass=true;}
      material.onBeforeCompile=shader=>{
        shader.uniforms.roadTime=wind.current.time;shader.uniforms.roadWind=wind.current.amount;shader.uniforms.roadEye=wind.current.eye;
        shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nuniform float roadTime;uniform float roadWind;uniform vec3 roadEye;")
          .replace("#include <begin_vertex>","#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat nearby=1.-smoothstep(28.,85.,distance(roadEye,instanceMatrix[3].xyz));transformed.x+=sin(roadTime*1.2+instanceMatrix[3].x*.09+position.y)*roadWind*uv.y*uv.y*nearby;\n#endif");
        if(props.map){
          // 少量朝向天空的冠层法线保持树叶暗部层次，双面卡片不再形成一片纯黑剪纸。
          shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\nnormal=normalize(mix(normal,(viewMatrix*vec4(0.,1.,0.,0.)).xyz,.42));").replace("#include <opaque_fragment>","outgoingLight+=diffuseColor.rgb*.09;\n#include <opaque_fragment>");
        }
        if(!props.map){
          shader.vertexShader="varying float grassLeafHeight;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ngrassLeafHeight=uv.y;");
          shader.fragmentShader="varying float grassLeafHeight;\n"+shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.rgb*=.60+.40*smoothstep(.03,.75,grassLeafHeight);");
        }
      };
      material.customProgramCacheKey=()=>props.map?"road-readable-canopy-wind-v2":"road-rooted-grass-wind-v2";material.needsUpdate=true;
    });
  },[props.map]);
  useFrame(({camera},dt)=>{if(!quiet)wind.current.time.value+=Math.min(dt,.06);wind.current.amount.value=quiet?0:.08+Math.min(1,roadView.speed/15.28)*.18;wind.current.eye.value.copy(camera.position);});
  return <group ref={root}><Instances {...props}/></group>;
}
function RoadSector({index,shadow,maps,leaves,pineShape,wood,scans,grassTemplates}:{index:number;shadow:boolean;maps:Maps;leaves:Texture;pineShape:PineShape;wood:BufferGeometry;scans:ReturnType<typeof useAlpineScans>;grassTemplates:ReturnType<typeof useAlpineGrass>}){
  const quality=usePalaceStore(s=>s.effectiveQuality),quiet=useQuietMotion();
  const asphalt=useMemo(()=>dryRoadMaterial(maps.asphalt,maps.normal,[2,5],6.4),[maps.asphalt,maps.normal]);
  useEffect(()=>()=>asphalt.dispose(),[asphalt]);
  const geometry=useMemo(()=>{
    const start=index*sectorLength,end=Math.min(roadLength,start+sectorLength),p=new Vector3(),t=new Vector3();
    const random=seeded(index+908),terrain=makeTerrain(start,end),ground=terrainSampler(terrain,terrainHeight);
    const trunks:Instance[]=[],branches:Instance[]=[],pines:Instance[]=[],needles:Instance[]=[],broad:Instance[]=[],rocks:Instance[]=[],grass:Instance[][]=Array.from({length:6},()=>[]),markers:Instance[]=[];
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
        const birch=random()>.80,y=ground(x,z),juvenile=random()<.14,h=birch?11+random()*6:juvenile?7.5+random()*5:15+random()*10,lean=(random()-.5)*.03,wide=birch?2.8+random()*1.7:2.1+random()*1.8;
        const crownRandom=seeded(Math.round(x*31+z*53)+1781);
        if(!birch){
          const size=h/pineShape.height,sx=size*(.93+random()*.42),sz=size*(.91+random()*.40),angle=random()*Math.PI*2,cs=Math.cos(angle),sn=Math.sin(angle),stride=quality==="low"?5:2;
          pines.push({position:[x,y-.035,z],scale:[sx,size,sz],rotation:[0,angle,0],color:"#a59d84"});
          for(let k=0;k<pineShape.crown.length;k+=stride){const a=pineShape.crown[k],w=.95+crownRandom()*.30;
            needles.push({position:[x+a[0]*sx*cs+a[2]*sz*sn,y+a[1]*size,z-a[0]*sx*sn+a[2]*sz*cs],scale:[.82*w*size,1.95*w*size,1],rotation:[(crownRandom()-.5)*1.4,crownRandom()*6.28,(crownRandom()-.5)*1.6],color:k%7===0?"#c2c4a4":"#aeb99b"});
          }
        }else{
          trunks.push({position:[x,y+h*.5-.03,z],scale:[.19+random()*.14,h,.19+random()*.14],rotation:[lean,random()*6.28,lean],color:"#c3b9a2"});
          const count=quality==="low"?70:190;
          for(let k=0;k<count;k++){
            const angle=k*2.4+crownRandom()*.5,radius=Math.sqrt(crownRandom())*wide,level=crownRandom(),spread=wide*(1-level*.65),height=h*(.40+level*.58);
            broad.push({position:[x+Math.cos(angle)*radius,y+h*.71+(crownRandom()-.5)*wide*1.65,z+Math.sin(angle)*radius],scale:[1.3+crownRandom()*.65,1.3+crownRandom()*.65,1],rotation:[(crownRandom()-.5)*1.6,angle,(crownRandom()-.5)],color:["#a8b398","#c1b387","#b8c19d","#b5aa85"][k%4]});
            if(k%22===0)branches.push({position:[x+Math.cos(angle)*spread*.25,y+height-.25,z+Math.sin(angle)*spread*.25],scale:[.035,spread*.7,.035],rotation:[Math.cos(angle)*1.0,0,Math.sin(angle)*1.0],color:"#9a8e76"});
          }
        }
        if(random()>.68&&d>25){const a=side*(4.6+random()*14),rx=p.x+nx/r*a,rz=p.z+nz/r*a,size=.5+random()*1.8;if(closestRoad(rx,rz).distance>4.1&&!insideStopApron(rx,rz))rocks.push({position:[rx,ground(rx,rz)-size*.12,rz],scale:[size*1.3,size*.65,size],rotation:[0,random()*6,0]});}
      }
    }
    const stem=new CylinderGeometry(.06,.65,1,12),leaf=new PlaneGeometry(1,1),cube=new BoxGeometry(1,1,1);
    const roadStart=index===0?-12:start;
    const road=roadRibbon(roadStart,end,6.4),edges=[roadRibbon(roadStart,end,.1,-2.95,.012),roadRibbon(roadStart,end,.1,2.95,.012)];
    return{start,end,terrain,road,edges,stem,leaf,cube,trunks,branches,pines,needles,broad,rocks,grass,farGrass:grass.slice(3).map((items,i)=>[...items,...grass[i]]),markers,time:{value:0},wind:{value:quiet?0:.012}};
  },[index,quality,pineShape,quiet]);
  useEffect(()=>()=>{[geometry.terrain,geometry.road,...geometry.edges,geometry.stem,geometry.leaf,geometry.cube].forEach(g=>g.dispose());},[geometry]);
  useFrame((_,dt)=>{if(!quiet)geometry.time.value+=Math.min(.06,dt);});
  return <group name={"road-sector:"+index}>
    <TerrainSurface geometry={geometry.terrain} maps={maps}/>
    <mesh name="authored-paved-road" geometry={geometry.road} receiveShadow material={asphalt}/>
    {geometry.edges.map((g,i)=><mesh key={i} geometry={g} receiveShadow><meshStandardMaterial color="#c9c6b7" roughness={.96} onUpdate={m=>weatheredEdgePaint(m,[2,5])}/></mesh>)}
    <Instances geometry={geometry.stem} items={geometry.trunks} color="#9c8e78" map={maps.bark} shadows={shadow}/>
    <Instances geometry={wood} items={geometry.pines} map={maps.bark} shadows={shadow}/>
    <Instances geometry={geometry.stem} items={geometry.branches} color="#7a725f" shadows={shadow}/>
    <WindField geometry={geometry.leaf} items={geometry.needles} map={maps.pine} cutout shadows={shadow}/>
    <WindField geometry={geometry.leaf} items={geometry.broad} map={leaves} cutout shadows={shadow}/>
    <ScanInstances scan={scans[0]} items={geometry.rocks} shadows={shadow}/>
    {grassTemplates.map((template,i)=><GrassField key={i} template={template} items={i<3?geometry.grass[i]:geometry.farGrass[i-3]} time={geometry.time} wind={geometry.wind} near={i<3} blend={quality!=="low"}/>)}
    <Instances geometry={geometry.cube} items={geometry.markers} color="#bebfae"/>
    <Delineators items={geometry.markers} stem={geometry.cube}/>
  </group>;
}
function Geography({maps,pineShape}:{maps:Maps;pineShape:PineShape}){
  const samples=useRidgeSamples();
  const groundMaterial=useMemo(()=>valleyTerrainMaterial(maps),[maps]),mountainMaterial=useMemo(()=>valleyTerrainMaterial(maps,true),[maps]);
  useEffect(()=>()=>{groundMaterial.dispose();mountainMaterial.dispose();},[groundMaterial,mountainMaterial]);
  const shape=useMemo(()=>{
    const points:number[]=[],uv:number[]=[],indices:number[]=[],n=145,minX=-1050,minZ=-2200,spanX=3000,spanZ=3000;
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
      const px=x/n*spanX+minX,pz=z/n*spanZ+minZ;points.push(px,terrainHeight(px,pz)-2.2,pz);uv.push(px/8,pz/8);
      if(z<n&&x<n){const a=z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
    }
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(points,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const ridges=createValleyRidges(samples);
    // 远林用同一松针图像离线式合成的透明树冠；不用近处可识别的实体圆锥代替森林。
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=1024;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#5c6350";ctx.fillRect(250,130,9,894);
    const painter=seeded(991);for(const p of pineShape.crown){const x=256+p[0]*48,y=1024-p[1]/pineShape.height*1010;ctx.save();ctx.translate(x,y);ctx.rotate((painter()-.5)*1.6);ctx.drawImage(maps.pine.image as CanvasImageSource,-15,-36,30,72);ctx.restore();}
    const crown=new CanvasTexture(canvas);crown.colorSpace=SRGBColorSpace;crown.anisotropy=2;
    // 远林必须落在实际粗网格三角形上，不能把精细高度加到下移后的远景表面而悬空。
    const farGround=(x:number,z:number)=>{
      const gx=(x-minX)/spanX*n,gz=(z-minZ)/spanZ*n,col=Math.max(0,Math.min(n-1,Math.floor(gx))),row=Math.max(0,Math.min(n-1,Math.floor(gz))),u=gx-col,v=gz-row,a=row*(n+1)+col;
      const h00=points[a*3+1],h10=points[(a+1)*3+1],h01=points[(a+n+1)*3+1],h11=points[(a+n+2)*3+1];
      return u+v<=1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
    };
    const tree=new PlaneGeometry(1,1),forest:Instance[]=[],random=seeded(417);
    for(let i=0;i<4000;i++){
      const x=-300+random()*2000,z=-1520+random()*1750;
      const h=terrainHeight(x,z),near=closestRoad(x,z);if(lakeDistance(x,z)<1.13||h<10||near.distance<125||near.distance<200&&roadForestDensity(near.progress)<.25||random()>habitat(x,z)*.92+.05)continue;
      const height=8+random()**.65*14,width=height*(.37+random()*.18),a=random()*Math.PI;for(const angle of [a,a+Math.PI/2])forest.push({position:[x,farGround(x,z)+height/2-.12,z],scale:[width,height,1],rotation:[0,angle,0],color:["#a9b3a0","#b6b69e","#a6b39d"][i%3]});
    }
    return{g,ridges,tree,forest,crown};
  },[maps.pine.image,pineShape,samples]);
  useEffect(()=>()=>{shape.g.dispose();shape.ridges.forEach(g=>g.dispose());shape.tree.dispose();shape.crown.dispose();},[shape]);
  return <group name="continuous-lake-valley-geography">
    <mesh geometry={shape.g} material={groundMaterial} dispose={null}/>
    {shape.ridges.map(g=><mesh key={g.name} name={g.name} geometry={g} material={mountainMaterial} dispose={null}/>)}
    <WindField geometry={shape.tree} items={shape.forest} map={shape.crown} color="#adb8ab" cutout/>
  </group>;
}
function RoadLake(){
  const quiet=useQuietMotion();
  const uniforms=useRef({time:{value:0}});
  useFrame((_,dt)=>{if(!quiet)uniforms.current.time.value+=Math.min(dt,.06);});
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
  const scans=useAlpineScans(),grassTemplates=useAlpineGrass();
  const pineShape=usePineShape(),wood=useMemo(()=>{const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(pineShape.position,3));g.setAttribute("normal",new Float32BufferAttribute(pineShape.normal,3));g.setAttribute("uv",new Float32BufferAttribute(pineShape.uv,2));g.setIndex(pineShape.index);return g;},[pineShape]);
  useEffect(()=>()=>wood.dispose(),[wood]);
  const leaves=useWorldTexture("leaves");
  const [sectors,setSectors]=useState(()=>activeRoadSectors(roadView.distance)),last=useRef(-1),tick=useRef(0);
  // 草木与远山没有交互入口，跳过几十万个实例的导航射线测试；近处路面和自行车仍正常拾取。
  useLayoutEffect(()=>{scenery.current?.traverse(object=>{if(object instanceof InstancedMesh||object.parent?.name==="continuous-lake-valley-geography"||object.name==="long-way-home-lake")object.raycast=()=>{};});},[sectors]);
  useFrame((_,delta)=>{tick.current+=delta;if(tick.current<.25)return;tick.current=0;const sector=Math.min(sectorCount-1,Math.floor(roadView.distance/sectorLength));if(sector!==last.current){last.current=sector;setSectors(activeRoadSectors(roadView.distance));}});
  const current=useRoadRide(s=>Math.floor(s.distance/sectorLength));
  return <group ref={scenery} name="authored-road-cycling-landscape"><Geography maps={maps} pineShape={pineShape}/><RoadLake/><RoadStops maps={maps}/><Trailhead/>{sectors.map(index=><RoadSector key={index} index={index} maps={maps} leaves={leaves} pineShape={pineShape} wood={wood} scans={scans} grassTemplates={grassTemplates} shadow={Math.abs(index-current)<2}/>)}</group>;
}
