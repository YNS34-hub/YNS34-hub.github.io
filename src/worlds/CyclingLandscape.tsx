import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, PlaneGeometry, MeshPhysicalMaterial, Vector3 } from "three";
import { Block, Label } from "../world/primitives";
import { route, stopDistances, routeLength } from "./cyclingRoute";
import Instances, { type Instance } from "./Instances";
import { useWorldTexture } from "./materials";
import { usePalaceStore } from "../systems/store";
import LakeReflection from "./LakeReflection";
import { groundHeight, lakeRadius, roadRibbon } from "./cyclingGeometry";

const lakeX = 53, lakeZ = -13;
function Terrain() {
  const geo = useMemo(() => {
    const p: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    const n = 140;
    for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
      const wx = x / n * 430 - 160, wz = z / n * 380 - 170, h = groundHeight(wx, wz);
      p.push(wx, h, wz);
      uv.push(wx / 80, wz / 80);
      const shore = lakeRadius(wx, wz), warm = shore < 1.12 ? .16 : 0;
      const shade = .018 * Math.sin(wx * .24) * Math.cos(wz * .19);
      colors.push(.24 + warm + shade, .30 + warm * .65 + shade, .20 + warm * .45 + shade);
      if (x < n && z < n) { const i = z * (n + 1) + x; indices.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2); }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(p, 3)); geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }, []);
  const road = useMemo(() => roadRibbon(4.7), []), edgeLeft = useMemo(() => roadRibbon(.055, -2.13, .016), []), edgeRight = useMemo(() => roadRibbon(.055, 2.13, .016), []);
  const grain = useWorldTexture("grain"), land = useWorldTexture("land");
  useEffect(() => () => { geo.dispose(); road.dispose(); edgeLeft.dispose(); edgeRight.dispose(); }, [geo, road, edgeLeft, edgeRight]);
  return <>
    <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors map={land} roughness={.93} /></mesh>
    <mesh geometry={road} receiveShadow name="continuous-forest-road"><meshStandardMaterial color="#858c84" map={grain} roughness={.84} bumpMap={grain} bumpScale={.012} /></mesh>
    {[edgeLeft, edgeRight].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color="#c1c1a6" roughness={.9} /></mesh>)}
  </>;
}
function Forest() {
  const trunkGeo = useMemo(() => new CylinderGeometry(.5, 1, 1, 8), []), leafGeo = useMemo(() => new PlaneGeometry(1, 1), []);
  const foliage = useWorldTexture("leaves");
  const trees = useMemo(() => {
    const trunks: Instance[] = [], leaves: Instance[] = [], branches: Instance[] = [];
    let seed = 57; const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    for (let i = 0; i < 300; i++) {
      const t = random(), point = route.getPointAt(t), tangent = route.getTangentAt(t), normal = new Vector3(-tangent.z, 0, tangent.x).normalize();
      const side = t > .16 && t < .8 ? -1 : random() > .5 ? 1 : -1;
      const distance = 6 + random() * 22;
      const x = point.x + normal.x * distance * side, z = point.z + normal.z * distance * side;
      if (lakeRadius(x, z) < 1.08) continue;
      const y = groundHeight(x, z), height = 4.8 + random() * 6, radius = 1.45 + random() * 1.1;
      trunks.push({ position: [x, y + height * .4, z], scale: [.19 + random() * .16, height * .8, .19 + random() * .16], color: "#6a6553" });
      const color = ["#ad955f", "#8e946e", "#778260", "#aaa17a", "#75856b", "#b09358"][i % 6];
      for (let j = 0; j < 28; j++) {
        const a = j * 2.4 + random(), r = Math.sqrt(random()) * radius;
        const spread = 1.4 + random() * 1.1;
        leaves.push({ position: [x + Math.cos(a) * r, y + height * .75 + (random() - .5) * radius * 1.8, z + Math.sin(a) * r], scale: [spread, spread, 1], rotation: [(random() - .5) * 1.5, a, (random() - .5) * .7], color });
        if (j % 7 === 0) branches.push({ position: [x + Math.cos(a) * radius * .38, y + height * .61, z + Math.sin(a) * radius * .38], scale: [.07, radius * 1.1, .07], rotation: [Math.sin(a) * .6, 0, Math.cos(a) * -.6] });
      }
    }
    return { trunks, leaves, branches };
  }, []);
  useEffect(() => () => { trunkGeo.dispose(); leafGeo.dispose(); }, [trunkGeo, leafGeo]);
  return <group name="instanced-golden-forest">
    <Instances geometry={trunkGeo} items={trees.trunks} color="#615644" shadows />
    <Instances geometry={trunkGeo} items={trees.branches} color="#716954" shadows />
    <Instances geometry={leafGeo} items={trees.leaves} color="#b39c63" map={foliage} cutout shadows />
  </group>;
}
function MountainRidges() {
  const geometry = useMemo(() => {
    const p: number[] = [], indices: number[] = [];
    for (let z = 0; z <= 25; z++) for (let x = 0; x <= 110; x++) {
      const wx = x / 110 * 620 - 240, wz = -130 - z * 9;
      const peak = 38 + 42 * Math.sin(wx * .012 + .5) ** 2 + 19 * Math.sin(wx * .035) ** 2;
      const profile = Math.sin(z / 25 * Math.PI) ** .7;
      p.push(wx, peak * profile - 3, wz);
      if (x < 110 && z < 25) { const i = z * 111 + x; indices.push(i, i + 1, i + 111, i + 1, i + 112, i + 111); }
    }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <>
    <mesh geometry={geometry} position={[0, 0, -35]}><meshStandardMaterial color="#6c8990" roughness={1} /></mesh>
    <mesh geometry={geometry} position={[35, -12, 45]} scale={[1, .62, .8]}><meshStandardMaterial color="#6f8276" roughness={1} /></mesh>
  </>;
}
function LowLake() {
  const material = useRef<MeshPhysicalMaterial>(null);
  useFrame((_, dt) => {
    if (!material.current?.normalMap) return;
    material.current.normalMap.offset.x += Math.min(dt, .06) * .013;
    material.current.normalMap.offset.y += Math.min(dt, .06) * .006;
  });
  const waves = useWorldTexture("waves");
  return <mesh position={[lakeX, .23, lakeZ]} rotation={[-Math.PI / 2, 0, 0]} scale={[39, 53, 1]} name="sky-reflecting-lake">
    <circleGeometry args={[1, 80]} /><meshPhysicalMaterial ref={material} color="#274c50" roughness={.2} metalness={.06} envMapIntensity={.8} clearcoat={1} clearcoatRoughness={.12} ior={1.33} normalMap={waves} normalScale={[.14, .14]} />
  </mesh>;
}
function Lake() {
  const quality = usePalaceStore(s => s.effectiveQuality);
  return quality !== "low" ? <LakeReflection /> : <LowLake />;
}
function Viewpoints() {
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const posts = useMemo(() => {
    const pieces: Instance[] = [];
    for (let i = 0; i < 140; i++) {
      const t = i / 140;
      if (t < .15 || t > .8) continue;
      const p = route.getPointAt(t), tangent = route.getTangentAt(t), normal = new Vector3(-tangent.z, 0, tangent.x).normalize();
      pieces.push({ position: [p.x + normal.x * 3, p.y + .6, p.z + normal.z * 3], scale: [.085, 1.2, .085] });
    }
    return pieces;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <>
    <Instances geometry={geo} items={posts} color="#82765a" />
    {stopDistances.map((distance, i) => {
      const t = distance / routeLength, p = route.getPointAt(t), tangent = route.getTangentAt(t), normal = new Vector3(-tangent.z, 0, tangent.x).normalize();
      const benchX = i === 0 ? 2 : -2;
      return <group key={i} position={[p.x + normal.x * 4.8, p.y, p.z + normal.z * 4.8]} rotation={[0, Math.atan2(normal.x, normal.z), 0]}>
        <Block position={[0, -.18, 0]} scale={[7.5, .3, 4.6]} color="#9a9276" roughness={.85} />
        <Block position={[benchX, .5, 1]} scale={[2.7, .16, .68]} color="#897456" castShadow />
        <Block position={[benchX, .94, 1.3]} scale={[2.7, .5, .1]} color="#938065" />
        {[-1.1, 1.1].map(x => <Block key={x} position={[benchX + x, .18, 1]} scale={[.1, .55, .56]} color="#5b6654" />)}
        {[-1.1, 1.1].map(x => <Block key={"back:" + x} position={[benchX + x, .64, 1.25]} scale={[.08, .92, .08]} color="#5b6654" metalness={.25} />)}
        <Block position={[-2.8, .7, -1.7]} scale={[.08, 1.4, .08]} color="#586457" />
        <Label text={["LAKE OPENING", "VALLEY GLOW", "THE OVERLOOK"][i]} position={[-2.8, 1.5, -1.65]} size={.18} color="#e0d5b9" maxWidth={3} />
      </group>;
    })}
  </>;
}
export default function CyclingLandscape() {
  return <group name="curated-forest-lake-landscape"><Terrain /><Lake /><MountainRidges /><Forest /><Viewpoints /></group>;
}
