import { useMemo,useEffect,useRef,useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry,Float32BufferAttribute,Vector3,CylinderGeometry,PlaneGeometry,BoxGeometry,DodecahedronGeometry,MeshPhysicalMaterial,CanvasTexture,SRGBColorSpace } from "three";
import Instances,{type Instance} from "../Instances";
import { Block,Label } from "../../world/primitives";
import { roadLength,sectorLength,sectorCount,roadSample,roadRibbon,terrainHeight,roadForestDensity,activeRoadSectors,lake,lakeDistance,roadStops,closestRoad } from "./route";
import { roadView,useRoadRide } from "./state";
import { useRoadTextures } from "./textures";
import { useWorldTexture } from "../materials";
import { usePalaceStore } from "../../systems/store";

function seeded(initial:number){let seed=initial;return()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};}
function makeTerrain(start:number,end:number){
  const vertices:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],n=Math.ceil((end-start)/4),across=28;
  const p=new Vector3(),tangent=new Vector3();
  for(let i=0;i<=n;i++){
    roadSample(start+(end-start)*i/n,p,tangent);const nx=-tangent.z,nz=tangent.x,r=Math.hypot(nx,nz);
    for(let j=0;j<=across;j++){
      const offset=(j/across-.5)*170,x=p.x+nx/r*offset,z=p.z+nz/r*offset,y=terrainHeight(x,z);
      vertices.push(x,y,z);uv.push(x/4,z/4);
      const bank=Math.min(1,Math.abs(offset)/7),meadow=roadForestDensity((start+(end-start)*i/n)/roadLength)<.3;
      colors.push(meadow?.50:.33,meadow?.49:.39,meadow?.30:.26);
      if(i<n&&j<across){const a=i*(across+1)+j;indices.push(a,a+1,a+across+1,a+1,a+across+2,a+across+1);}
      if(bank<.6){colors[colors.length-3]=.46;colors[colors.length-2]=.42;colors[colors.length-1]=.31;}
    }
  }
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(vertices,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
type Maps=ReturnType<typeof useRoadTextures>;
function RoadSector({index,shadow,maps}:{index:number;shadow:boolean;maps:Maps}){
  const quality=usePalaceStore(s=>s.effectiveQuality);
  const geometry=useMemo(()=>{
    const start=index*sectorLength,end=Math.min(roadLength,start+sectorLength),p=new Vector3(),t=new Vector3();
    const random=seeded(index+908),trunks:Instance[]=[],branches:Instance[]=[],needles:Instance[]=[],rocks:Instance[]=[],grass:Instance[]=[],markers:Instance[]=[];
    for(let d=start;d<end;d+=4){
      roadSample(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),density=roadForestDensity(d/roadLength);
      for(const side of [-1,1]){
        for(let j=0;j<20;j++){
          const a=side*(3.55+random()*8),x=p.x+nx/r*a+(random()-.5)*2,z=p.z+nz/r*a+(random()-.5)*2;
          if(lakeDistance(x,z)<1.02)continue;
          grass.push({position:[x,terrainHeight(x,z)+.12,z],scale:[.028+random()*.04,.14+random()*.25,1],rotation:[0,random()*Math.PI,(random()-.5)*.3],color:["#607758","#89905e","#6a845a","#9b9870"][j%4]});
        }
        if(Math.floor(d/4)%7===0){const a=side*3.8;markers.push({position:[p.x+nx/r*a,p.y+.31,p.z+nz/r*a],scale:[.10,.62,.10],color:"#c7c6b5"});}
        if(random()>density)continue;
        const off=side*(6+random()*26),x=p.x+nx/r*off,z=p.z+nz/r*off;if(lakeDistance(x,z)<1.05||d<25&&x>-5&&x<7)continue;
        const y=terrainHeight(x,z),h=12+random()*12,lean=(random()-.5)*.05,wide=2.1+random()*1.8;
        trunks.push({position:[x,y+h*.5,z],scale:[.23+random()*.15,h,.23+random()*.15],rotation:[lean,random()*6.28,lean],color:"#b7aa91"});
        const count=quality==="low"?110:260;
        for(let k=0;k<count;k++){
          const level=k/count,angle=k*2.4+random()*.5,spread=wide*(1-level*.65),height=h*(.40+level*.58),a=.8+random()*.5;
          needles.push({position:[x+Math.cos(angle)*spread*.72,y+height,z+Math.sin(angle)*spread*.72],scale:[.45*a,1.08*a,1],rotation:[-.35+(random()-.5)*.45,angle,(random()-.5)*1.6],color:level>.80?"#c2cbb0":side>0?"#9daa92":"#b1bda0"});
          if(k%20===0)branches.push({position:[x+Math.cos(angle)*spread*.25,y+height-.25,z+Math.sin(angle)*spread*.25],scale:[.035,spread*.7,.035],rotation:[Math.cos(angle)*1.0,0,Math.sin(angle)*1.0],color:"#9a8e76"});
        }
        if(random()>.6&&d>25){const a=side*(5.2+random()*8),rx=p.x+nx/r*a,rz=p.z+nz/r*a;rocks.push({position:[rx,terrainHeight(rx,rz)+.10,rz],scale:[.3+random()*.7,.2+random()*.3,.35+random()*.6],rotation:[random(),random()*6,random()],color:"#899088"});}
      }
    }
    const stem=new CylinderGeometry(.25,.70,1,9),leaf=new PlaneGeometry(1,1),stone=new DodecahedronGeometry(1,1),cube=new BoxGeometry(1,1,1);
    const blade=new BufferGeometry(),gp:number[]=[],guv:number[]=[],gi:number[]=[];
    for(let b=0;b<9;b++){const angle=b*2.4,dx=Math.cos(angle)*2,dz=Math.sin(angle)*.15,n=gp.length/3;gp.push(dx-.3,-.5,dz,dx+.3,-.5,dz,dx+.3,.12,dz+.03,dx+.7,.5,dz+.06);guv.push(0,0,1,0,.6,.6,.7,1);gi.push(n,n+1,n+2,n+1,n+3,n+2);}
    blade.setAttribute("position",new Float32BufferAttribute(gp,3));blade.setAttribute("uv",new Float32BufferAttribute(guv,2));blade.setIndex(gi);blade.computeVertexNormals();
    const road=roadRibbon(start,end,6.4),edges=[roadRibbon(start,end,.1,-2.95,.012),roadRibbon(start,end,.1,2.95,.012)];
    return{start,end,terrain:makeTerrain(start,end),road,edges,stem,leaf,stone,cube,blade,trunks,branches,needles,rocks,grass,markers};
  },[index,quality]);
  useEffect(()=>()=>{[geometry.terrain,geometry.road,...geometry.edges,geometry.stem,geometry.leaf,geometry.stone,geometry.cube,geometry.blade].forEach(g=>g.dispose());},[geometry]);
  return <group name={"road-sector:"+index}>
    <mesh geometry={geometry.terrain} receiveShadow><meshStandardMaterial vertexColors map={maps.ground} roughness={.98}/></mesh>
    <mesh name="authored-paved-road" geometry={geometry.road} receiveShadow><meshStandardMaterial color="#7b8384" map={maps.asphalt} normalMap={maps.normal} normalScale={[.22,.22]} roughness={.91}/></mesh>
    {geometry.edges.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color="#d5d3bd" roughness={.94}/></mesh>)}
    <Instances geometry={geometry.stem} items={geometry.trunks} color="#9c8e78" map={maps.bark} shadows={shadow}/>
    <Instances geometry={geometry.stem} items={geometry.branches} color="#7a725f" shadows={shadow}/>
    <Instances geometry={geometry.leaf} items={geometry.needles} map={maps.pine} cutout shadows={shadow}/>
    <Instances geometry={geometry.stone} items={geometry.rocks} color="#8f9387" roughness={1}/>
    <Instances geometry={geometry.blade} items={geometry.grass} color="#83925f" cutout/>
    <Instances geometry={geometry.cube} items={geometry.markers} color="#bebfae"/>
  </group>;
}
function Geography({maps}:{maps:Maps}){
  const shape=useMemo(()=>{
    const points:number[]=[],uv:number[]=[],indices:number[]=[],n=145;
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
      const px=x/n*2400-550,pz=z/n*2500-1920;points.push(px,terrainHeight(px,pz)-2.2,pz);uv.push(px/8,pz/8);
      if(z<n&&x<n){const a=z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
    }
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(points,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const ridge:number[]=[],ix:number[]=[],cols=120,rows=20;
    for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){
      const wx=-650+x/cols*3200,wz=-1500-z*43,peak=160+130*Math.sin(wx*.0033+.8)**2+45*Math.sin(wx*.012)**2;
      ridge.push(wx,peak*Math.sin(z/rows*Math.PI)**.85+12,wz);
      if(x<cols&&z<rows){const a=z*(cols+1)+x;ix.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
    }
    const r=new BufferGeometry();r.setAttribute("position",new Float32BufferAttribute(ridge,3));r.setIndex(ix);r.computeVertexNormals();
    // 远林用同一松针图像离线式合成的透明树冠；不用近处可识别的实体圆锥代替森林。
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=1024;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#5c6350";ctx.fillRect(250,130,9,894);
    const painter=seeded(991);for(let i=0;i<750;i++){const level=painter(),y=120+level*760,spread=(.15+level*.85)*170,x=256+(painter()-.5)*2*spread;ctx.save();ctx.translate(x,y);ctx.rotate((painter()-.5)*1.4);ctx.drawImage(maps.pine.image as CanvasImageSource,-10,-26,20,52);ctx.restore();}
    const crown=new CanvasTexture(canvas);crown.colorSpace=SRGBColorSpace;crown.anisotropy=2;
    const tree=new PlaneGeometry(1,1),forest:Instance[]=[],random=seeded(417);
    for(let i=0;i<1800;i++){
      const x=-300+random()*2000,z=-1520+random()*1750;
      const h=terrainHeight(x,z),near=closestRoad(x,z);if(lakeDistance(x,z)<1.10||h<10||near.distance<90||near.distance<180&&roadForestDensity(near.progress)<.25)continue;
      const height=13+random()*7,width=height*.50,a=random()*Math.PI;for(const angle of [a,a+Math.PI/2])forest.push({position:[x,h+height/2,z],scale:[width,height,1],rotation:[0,angle,0],color:["#a5b3a5","#b3bba6","#8faca0"][i%3]});
    }
    return{g,r,tree,forest,crown};
  },[maps.pine.image]);
  useEffect(()=>()=>{shape.g.dispose();shape.r.dispose();shape.tree.dispose();shape.crown.dispose();},[shape]);
  return <group name="continuous-lake-valley-geography">
    <mesh geometry={shape.g}><meshStandardMaterial color="#879077" map={maps.ground} roughness={1}/></mesh>
    <mesh geometry={shape.r}><meshStandardMaterial color="#647e87" roughness={1}/></mesh>
    <mesh geometry={shape.r} position={[200,-65,-280]} scale={[1,.7,1]}><meshStandardMaterial color="#8f9d9c" roughness={1}/></mesh>
    <Instances geometry={shape.tree} items={shape.forest} map={shape.crown} color="#adb8ab" cutout/>
  </group>;
}
function RoadLake(){
  const waves=useWorldTexture("waves"),material=useRef<MeshPhysicalMaterial>(null);
  useFrame((_,dt)=>{if(material.current?.normalMap){material.current.normalMap.offset.x+=Math.min(dt,.06)*.007;material.current.normalMap.offset.y+=Math.min(dt,.06)*.003;}});
  return <mesh name="long-way-home-lake" position={[lake.x,lake.y,lake.z]} rotation={[-Math.PI/2,0,0]} scale={[lake.rx,lake.rz,1]}>
    <circleGeometry args={[1,120]}/><meshPhysicalMaterial ref={material} color="#42616b" roughness={.20} metalness={.12} clearcoat={1} clearcoatRoughness={.2} envMapIntensity={1.1} ior={1.33} normalMap={waves} normalScale={[.10,.10]}/>
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
    const p=new Vector3(),t=new Vector3();roadSample(stop.distance,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz),side=i===1?-1:1;
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
  const maps=useRoadTextures();
  const [sectors,setSectors]=useState(()=>activeRoadSectors(roadView.distance)),last=useRef(-1),tick=useRef(0);
  useFrame((_,delta)=>{tick.current+=delta;if(tick.current<.25)return;tick.current=0;const sector=Math.min(sectorCount-1,Math.floor(roadView.distance/sectorLength));if(sector!==last.current){last.current=sector;setSectors(activeRoadSectors(roadView.distance));}});
  const current=useRoadRide(s=>Math.floor(s.distance/sectorLength));
  return <group name="authored-road-cycling-landscape"><Geography maps={maps}/><RoadLake/><RoadStops/><Trailhead/>{sectors.map(index=><RoadSector key={index} index={index} maps={maps} shadow={Math.abs(index-current)<2}/>)}</group>;
}
