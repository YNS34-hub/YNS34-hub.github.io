import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, InstancedMesh, LineBasicMaterial, Object3D, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector2, type Texture } from "three";
import Instances from "../Instances";
import { Label } from "../../world/primitives";
import { usePalaceStore } from "../../systems/store";
import { useActivity } from "../activity";
import { useCourtMaps } from "./assets";
import {useFrame} from '@react-three/fiber';
import {courtAtmosphere} from './state';
import { courtSets, courtSetLayout, useCourtSet, type CourtSetId, type CourtSetBlock } from "./courtSets";


export function courtLines() {
  const vertices: number[] = [], half = .027;
  const line = (ax: number, az: number, bx: number, bz: number) => {
    const length = Math.hypot(bx - ax, bz - az); if (length < .001) return;
    const dx = -(bz - az) / length * half, dz = (bx - ax) / length * half;
    vertices.push(ax + dx, .019, az + dz, bx + dx, .019, bz + dz, ax - dx, .019, az - dz,
      bx + dx, .019, bz + dz, bx - dx, .019, bz - dz, ax - dx, .019, az - dz);
  };
  const arc = (cx: number, cz: number, radius: number, from: number, to: number, front = 1) => {
    const steps = Math.ceil(Math.abs(to - from) * 26);
    for (let i = 0; i < steps; i++) {
      const a = from + (to - from) * i / steps, b = from + (to - from) * (i + 1) / steps;
      line(cx + Math.sin(a) * radius, cz + Math.cos(a) * radius * front, cx + Math.sin(b) * radius, cz + Math.cos(b) * radius * front);
    }
  };
  line(-7.5, -14, 7.5, -14); line(-7.5, 14, 7.5, 14);
  line(-7.5, -14, -7.5, 14); line(7.5, -14, 7.5, 14); line(-7.5, 0, 7.5, 0); arc(0, 0, 1.8, 0, Math.PI * 2);
  for (const front of [-1, 1]) {
    const rim = -front * 12.1, foul = -front * 8.3, baseline = -front * 14;
    line(-2.45, baseline, -2.45, foul); line(2.45, baseline, 2.45, foul); line(-2.45, foul, 2.45, foul);
    arc(0, foul, 1.8, 0, Math.PI * 2);
    const angle = 1.38, x = Math.sin(angle) * 6.75, z = rim + front * Math.cos(angle) * 6.75;
    arc(0, rim, 6.75, -angle, angle, front); line(-x, baseline, -x, z); line(x, baseline, x, z);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); return geometry;
}

function woodGrain() {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 512;
  const context = canvas.getContext("2d")!; context.fillStyle = "#ede9e0"; context.fillRect(0, 0, 256, 512);
  context.strokeStyle = "#6f5131"; context.lineWidth = .7;
  for (let i = 0; i < 112; i++) {
    const x = i * 73 % 257, bend = Math.sin(i * 1.7) * 4;
    context.globalAlpha = .03 + (i % 5) * .008; context.beginPath(); context.moveTo(x, 0);
    context.bezierCurveTo(x + bend, 170, x - bend * .6, 340, x + Math.sin(i) * 2, 512); context.stroke();
  }
  context.globalAlpha = 1;
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8; return texture;
}
function masonryGrain() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!; context.fillStyle = "#9d9b92"; context.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) for (let brick = -1; brick < 9; brick++) {
    const shade = 197 + (row * 23 + brick * 47) % 17;
    context.fillStyle = "rgb(" + shade + "," + (shade - 5) + "," + (shade - 13) + ")";
    context.fillRect(brick * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30.8, 14.7);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(6, 8); texture.anisotropy = 8; return texture;
}

export function chainLinkGeometry() {
  const points: number[] = [];
  const weave = (side: number, lower: number, upper: number, end: boolean) => {
    for (const slope of [-1, 1]) for (let start = lower - 3.24; start <= upper + 3.24; start += .12) {
      const y0 = Math.max(.12, .12 + (slope === 1 ? lower - start : start - upper));
      const y1 = Math.min(3.32, .12 + (slope === 1 ? upper - start : start - lower));
      if (y0 >= y1) continue;
      const a = start + slope * (y0 - .12), b = start + slope * (y1 - .12);
      if (end) points.push(a, y0, side * 18.15, b, y1, side * 18.15);
      else points.push(side * 13.3, y0, a, side * 13.3, y1, b);
    }
  };
  for (const side of [-1, 1]) {
    weave(side, -18.15, 18.15, false);
    if (side === 1) { weave(side, -13.3, -2.3, true); weave(side, 2.3, 13.3, true); }
    else weave(side, -13.3, 13.3, true);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(points, 3)); geometry.computeBoundingSphere(); return geometry;
}

function PlankFloor({ items, map }: { items: CourtSetBlock[]; map?: Texture }) {
  const ref = useRef<InstancedMesh>(null), geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const object = new Object3D(), tint = new Color();
    items.forEach((item, i) => {
      object.position.set(item.position[0], item.position[1] + item.scale[1] * .5, item.position[2]);
      object.rotation.set(-Math.PI / 2, 0, 0); object.scale.set(item.scale[0], item.scale[2], 1); object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix); ref.current!.setColorAt(i, tint.set(item.color ?? "#b69666"));
    });
    ref.current!.instanceMatrix.needsUpdate = true; ref.current!.instanceColor!.needsUpdate = true; ref.current!.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, undefined, items.length]} name="thin-staggered-hardwood" receiveShadow>
    <meshStandardMaterial color="#ffffff" map={map} roughness={.54} metalness={0} />
  </instancedMesh>;
}

function AsphaltFloor({roof=false}:{roof?:boolean}) {
  const maps = useCourtMaps("aggregate", [12, 18]), paving = useCourtMaps("paving", roof?[10,14]:[32, 32]);
  return <>
    {roof&&<mesh name="rooftop-building-below-deck" position={[0,-12.1,0]}><boxGeometry args={[31,24,43]}/><meshStandardMaterial color="#536463" roughness={.88}/></mesh>}
    <mesh name={roof?'rooftop-concrete-apron':"city-sidewalk-apron"} position={[0, -.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={roof?[31,43]:[100, 100]} /><meshStandardMaterial {...paving} color={roof?'#858d83':"#787c78"} roughness={.96} normalScale={new Vector2(.35, .35)} /></mesh>
    <mesh name="city-asphalt-surface" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[24, 36]} /><meshStandardMaterial {...maps} color={roof?'#465962':"#505359"} roughness={.96} normalScale={new Vector2(.3, .3)} />
    </mesh>
  </>;
}

function RooftopWindowLights({items}:{items:CourtSetBlock[]}){
  const mesh=useRef<InstancedMesh>(null),lit=useMemo(()=>items.filter((_,i)=>i%4===0||i%7===0),[items]),geometry=useMemo(()=>new PlaneGeometry(1,1),[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useLayoutEffect(()=>{
    const object=new Object3D(),color=new Color();lit.forEach((item,i)=>{const sideWindow=item.scale[0]<.1;object.position.set(...item.position);object.rotation.set(0,sideWindow?(item.position[0]<0?Math.PI/2:-Math.PI/2):0,0);if(sideWindow)object.position.x+=item.position[0]<0?.036:-.036;else object.position.z+=.036;object.scale.set(sideWindow?item.scale[2]:item.scale[0],item.scale[1],1);object.updateMatrix();mesh.current!.setMatrixAt(i,object.matrix);mesh.current!.setColorAt(i,color.set(i%3?'#cbb582':'#9dbbc2'));});
    mesh.current!.instanceMatrix.needsUpdate=true;if(mesh.current!.instanceColor)mesh.current!.instanceColor.needsUpdate=true;mesh.current!.computeBoundingSphere();
  },[lit]);
  useFrame(()=>{if(!mesh.current)return;const night=courtAtmosphere.night;mesh.current.visible=night>.01;const material=mesh.current.material;if(!Array.isArray(material))material.opacity=night*.8;});
  return <instancedMesh ref={mesh} name="rooftop-night-window-lights" args={[geometry,undefined,lit.length]} visible={false}><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false}/></instancedMesh>;
}

function RooftopFence({geometry}:{geometry:BufferGeometry}){
  const material=useRef<LineBasicMaterial>(null),colors=useMemo(()=>[new Color('#6c8080'),new Color('#283b40')],[]);
  useFrame(()=>{material.current?.color.lerpColors(colors[0],colors[1],courtAtmosphere.night);});
  return <lineSegments geometry={geometry} name="rooftop-chain-link-fence"><lineBasicMaterial ref={material} color="#6c8080" transparent opacity={.50}/></lineSegments>;
}

function PracticeScoreboard() {
  const made = useActivity(s => s.made), shots = useActivity(s => s.shots);
  return <group name="practice-scoreboard">
    <Label text="JIE TIAN / PRACTICE" position={[0, 8.85, -21.05]} size={.23} color="#d9ddcb" maxWidth={6} />
    <Label text={String(made).padStart(2, "0") + "   /   " + String(shots).padStart(2, "0")} position={[0, 8.02, -21.05]} size={.64} color="#d8bb7e" maxWidth={6} />
    <Label text="MADE                       ATTEMPTED" position={[0, 7.24, -21.05]} size={.15} color="#a2b1a7" maxWidth={6} />
  </group>;
}

function BenchGear({ items }: { items: CourtSetBlock[] }) {
  return <group name="training-bench-gear">{items.map((item, i) => <group key={i} position={item.position}>
    {item.kind === "bag" ? <>
      <mesh scale={item.scale} castShadow><sphereGeometry args={[.5, 16, 12]} /><meshStandardMaterial color={item.color} roughness={.88} /></mesh>
      <mesh position={[0, .16, 0]} castShadow><torusGeometry args={[.095, .013, 6, 12]} /><meshStandardMaterial color="#303d3e" roughness={.90} /></mesh>
    </> : <>
      <mesh scale={item.scale} castShadow><cylinderGeometry args={[.5, .5, 1, 12]} /><meshStandardMaterial color={item.color} roughness={.42} metalness={.22} /></mesh>
      <mesh position={[0, .18, 0]}><cylinderGeometry args={[.034, .034, .024, 10]} /><meshStandardMaterial color="#303d3e" roughness={.72} /></mesh>
    </>}
  </group>)}</group>;
}

function SetScenery({ id }: { id: Exclude<CourtSetId, "park"> }) {
  const quality = usePalaceStore(s => s.effectiveQuality);
  const style = courtSets[id], indoor = style.indoor, layout = useMemo(() => courtSetLayout(id), [id]);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []), lines = useMemo(() => courtLines(), []);
  const grain = useMemo(() => indoor ? woodGrain() : undefined, [indoor]);
  const masonry = useMemo(() => id === "blacktop" ? masonryGrain() : undefined, [id]);
  const fence = useMemo(() => !indoor ? chainLinkGeometry() : undefined, [indoor]);
  useEffect(() => () => { box.dispose(); lines.dispose(); grain?.dispose(); masonry?.dispose(); fence?.dispose(); }, [box, lines, grain, masonry, fence]);
  return <group name={"court-set-" + id}>
    <group name="court-set-floor">
      {!indoor ? <AsphaltFloor roof={id==='rooftop'}/> : <>
        <mesh name="indoor-floor-apron" position={[0, -.018, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[id === "retro-arena" ? 40 : 33.4, 43]} /><meshStandardMaterial color={id === "retro-arena" ? "#76665c" : "#ac9e85"} roughness={.78} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[24, 36]} /><meshStandardMaterial color="#856745" roughness={.72} /></mesh>
        <PlankFloor items={layout.floor} map={grain} />
      </>}
      {[-1, 1].map(side => <mesh key={side} position={[0, .013, side * 11.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.90, 5.7]} /><meshStandardMaterial color={style.accent} transparent opacity={!indoor ? .60 : id === "retro-arena" ? .68 : .50} depthWrite={false} roughness={.69} />
      </mesh>)}
      <mesh geometry={lines}><meshBasicMaterial color={style.line} toneMapped={false} /></mesh>
      {id === "retro-arena" && <Label text="JIE TIAN" position={[0, .026, 0]} rotation={[-Math.PI / 2, 0, 0]} size={.40} color="#71313a" maxWidth={2.6} />}
    </group>
    <group name="court-set-structure"><Instances geometry={box} items={layout.structure} roughness={.81} shadows /></group>
    {layout.facades.length > 0 && <group name={id==='rooftop'?'rooftop-city-skyline':"city-masonry-facades"}><Instances geometry={box} items={layout.facades} map={masonry} bumpMap={masonry} roughness={id==='rooftop'?.74:.90} shadows /></group>}
    {fence && (id==='rooftop'?<RooftopFence geometry={fence}/>:<lineSegments geometry={fence} name="city-chain-link-fence"><lineBasicMaterial color="#6a7770" transparent opacity={.58} /></lineSegments>)}
    {layout.seats.length > 0 && <group name="retro-maroon-seating"><Instances geometry={box} items={layout.seats} roughness={.72} shadows /></group>}
    {layout.windows.length > 0 && <group name={indoor ? "practice-high-windows" : "city-building-windows"}>
      <Instances geometry={box} items={layout.windows} color={indoor ? "#c4d6d0" : "#384e58"} roughness={.33} metalness={.18} />
    </group>}
    {id==='rooftop'&&<RooftopWindowLights items={layout.windows}/>}
    {layout.gear.length > 0 && <BenchGear items={layout.gear} />}
    <group name="court-set-luminaires">{layout.lamps.map((item, i) => <mesh key={i} position={item.position} scale={item.scale}>
      <boxGeometry /><meshStandardMaterial color="#e9ebdd" emissive="#fff3d8" emissiveIntensity={indoor ? .85 : .3} roughness={.3} />
    </mesh>)}</group>
    {indoor && <>
      <hemisphereLight args={[id === "retro-arena" ? "#ebe3d7" : "#eaf0e6", "#79695b", id === "retro-arena" ? .28 : .40]} />
      <spotLight position={[-6, id === "retro-arena" ? 11.15 : 9.35, -8]} intensity={id === "retro-arena" ? 850 : 730} angle={1.06} penumbra={.65} distance={52} decay={2} color="#fff3df" castShadow={quality !== "low"} shadow-mapSize={[1024, 1024]} shadow-normalBias={.018} shadow-bias={-.00015} />
      <spotLight position={[6, id === "retro-arena" ? 11.15 : 9.35, 8]} intensity={id === "retro-arena" ? 750 : 730} angle={1.06} penumbra={.65} distance={52} decay={2} color="#e7eeea" />
    </>}
    {id === "retro-arena" && <PracticeScoreboard />}
    {id === "practice-gym" && <Label text="JIE TIAN / TRAINING HALL" position={[0, 4.3, -21.20]} size={.31} color="#39575c" maxWidth={7} />}
    {indoor && <Label text="RETURN / MEMORY PALACE" position={[0, 3.16, 20.98]} rotation={[0, Math.PI, 0]} size={.18} color="#c7d4c4" maxWidth={3} />}
    {id === "blacktop" && <Label text="JIE TIAN / STREET COURT" position={[-9, 1.35, -18.25]} size={.20} color="#eee5cd" maxWidth={4} />}
    {id==='rooftop'&&<Label text="JIE TIAN / ROOFTOP COURT" position={[-8.9,1.35,-18.25]} size={.19} color="#f0e6d2" maxWidth={4.2}/>}
  </group>;
}

export default function CourtSets() {
  const selected = useCourtSet(s => s.selected);
  return selected === "park" ? null : <SetScenery key={selected} id={selected} />;
}
