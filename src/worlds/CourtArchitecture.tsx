import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferGeometry, Group, Vector3, MeshPhysicalMaterial } from "three";
import { useQuietMotion } from "../motion/useMotionCue";
import { Block, Label } from "../world/primitives";
import Instances, { type Instance } from "./Instances";
import { useWorldTexture } from "./materials";

export const courtResponse = { hoop: -1, rim: 0, net: 0, board: 0 };
function Hoop({ side }: { side: number }) {
  const rim = useRef<Group>(null), net = useRef<Group>(null), board = useRef<MeshPhysicalMaterial>(null);
  const quiet = useQuietMotion();
  const geometry = useMemo(() => {
    const points: Vector3[] = [];
    for (let row = 0; row < 5; row++) for (let i = 0; i < 16; i++) {
      const y = -row * .083, radius = .225 - row * .021;
      const lower = radius - .021;
      const a = i / 16 * Math.PI * 2 + row * .09;
      for (const offset of [-1, 1]) points.push(new Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius), new Vector3(Math.cos(a + offset * Math.PI / 16 + .09) * lower, y - .083, Math.sin(a + offset * Math.PI / 16 + .09) * lower));
    }
    return new BufferGeometry().setFromPoints(points);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    if (courtResponse.hoop !== side) {
      if (rim.current) rim.current.rotation.z = 0;
      if (net.current) { net.current.scale.y = 1; net.current.rotation.y = 0; }
      if (board.current) board.current.emissiveIntensity = 0;
      return;
    }
    if (rim.current) rim.current.rotation.z = quiet ? 0 : Math.sin(courtResponse.rim * 13) * courtResponse.rim * .025;
    if (net.current) { net.current.scale.y = quiet ? 1 : 1 + courtResponse.net * .22; net.current.rotation.y = quiet ? 0 : courtResponse.net * .11; }
    if (board.current) board.current.emissiveIntensity = courtResponse.board * .18;
    courtResponse.rim = Math.max(0, courtResponse.rim - dt * 2.5); courtResponse.net = Math.max(0, courtResponse.net - dt * 1.7);
    courtResponse.board = Math.max(0, courtResponse.board - dt * 3);
  });
  return <group name={"regulation-hoop-" + side}>
    <Block position={[0, 1.48, side * 15.4]} scale={[.27, 2.96, .27]} color="#34443e" metalness={.72} roughness={.35} castShadow />
    <Block position={[0, 2.78, side * 14.25]} rotation={[side * -.38, 0, 0]} scale={[.18, .2, 2.9]} color="#415750" metalness={.7} />
    <Block position={[0, .08, side * 15.4]} scale={[.9, .16, 1.2]} color="#606259" />
    <mesh position={[0, 3.6, side * 12.72]} castShadow>
      <boxGeometry args={[1.8, 1.05, .055]} /><meshPhysicalMaterial ref={board} color="#ebf0e6" transmission={.62} thickness={.055} ior={1.48} roughness={.12} metalness={0} emissive="#e8c597" emissiveIntensity={0} />
    </mesh>
    {[-1, 1].map(s => <Block key={s} position={[s * .91, 3.6, side * 12.72]} scale={[.035, 1.09, .07]} color="#d9e0d2" metalness={.4} />)}
    {[3.06, 4.14].map(y => <Block key={y} position={[0, y, side * 12.72]} scale={[1.86, .035, .07]} color="#d9e0d2" metalness={.4} />)}
    <group position={[0, 3.34, side * 12.68]}>
      {[-.29, .29].map(x => <Block key={x} position={[x, 0, 0]} scale={[.025, .43, .018]} color="#eef0dd" />)}
      {[-.215, .215].map(y => <Block key={y} position={[0, y, 0]} scale={[.6, .025, .018]} color="#eef0dd" />)}
    </group>
    <Block position={[0, 3.02, side * 12.4]} scale={[.12, .1, .4]} color="#bd6f3e" metalness={.65} />
    <group ref={rim} position={[0, 3.05, side * 12.1]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.225, .009, 8, 48]} /><meshStandardMaterial color="#d4753d" roughness={.3} metalness={.55} /></mesh>
      <group ref={net}><lineSegments geometry={geometry}><lineBasicMaterial color="#dde0d2" /></lineSegments></group>
    </group>
  </group>;
}
function Fence() {
  const geometry = useMemo(() => {
    const p: Vector3[] = [];
    // 在矩形内裁切真实小菱形围网；四米高的整面交叉线不能表现铁丝网的尺度。
    const weave = (side: number, lower: number, upper: number, end: boolean) => {
      for (const slope of [-1, 1]) for (let start = lower - 4.2; start <= upper + 4.2; start += .24) {
        const y0 = Math.max(.1, .1 + (slope === 1 ? lower - start : start - upper));
        const y1 = Math.min(4.25, .1 + (slope === 1 ? upper - start : start - lower));
        if (y0 >= y1) continue;
        const a = start + slope * (y0 - .1), b = start + slope * (y1 - .1);
        p.push(end ? new Vector3(a, y0, side * 18) : new Vector3(side * 12, y0, a), end ? new Vector3(b, y1, side * 18) : new Vector3(side * 12, y1, b));
      }
    };
    for (const side of [-1, 1]) {
      weave(side, -18, 18, false);
      if (side === 1) { weave(side, -12, -2.3, true); weave(side, 2.3, 12, true); }
      else weave(side, -12, 12, true);
    }
    return new BufferGeometry().setFromPoints(p);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <>
    <lineSegments geometry={geometry}><lineBasicMaterial color="#596052" transparent opacity={.58} /></lineSegments>
    {[-1, 1].flatMap(side => [-16, -8, 0, 8, 16].map(z => <Block key={side + ":" + z} position={[side * 12, 2.15, z]} scale={[.07, 4.3, .07]} color="#3b4b41" metalness={.6} />))}
    {[-1, 1].map(side => <Block key={side} position={[side * 12, 4.3, 0]} scale={[.055, .055, 36]} color="#566457" metalness={.5} />)}
  </>;
}
function UrbanContext() {
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const city = useMemo(() => {
    const buildings: Instance[] = [], windows: Instance[] = [];
    for (let i = 0; i < 16; i++) {
      const x = (i - 7.5) * 8, z = -31 - i % 3 * 6, height = 9 + i * 7 % 15;
      buildings.push({ position: [x, height / 2, z], scale: [6.8, height, 8], color: ["#616e70", "#8a8177", "#58676a", "#727c74"][i % 4] });
      buildings.push({ position: [x + 1, height + .8, z], scale: [3, 1.6, 3], color: "#566764" });
      for (let y = 2.6; y < height - 1; y += 2.3) for (const dx of [-1.8, 0, 1.8])
        windows.push({ position: [x + dx, y, z + 4.02], scale: [.68, 1.1, .03], color: (i + Math.round(y)) % 4 === 0 ? "#c9ab78" : "#354b51" });
    }
    for (const y of [2.3, 4.7]) for (let z = -3; z <= 15; z += 3)
      windows.push({ position: [14.98, y, z], scale: [.035, 1.4, 1], color: z % 3 === 0 ? "#465654" : "#b29b77" });
    return { buildings, windows };
  }, []);
  const mural = useWorldTexture("mural"), brick = useWorldTexture("brick");
  return <>
    <Instances items={city.buildings} geometry={geo} color="#6c756e" shadows map={brick} bumpMap={brick} />
    <Instances items={city.windows} geometry={geo} color="#bda678" roughness={.28} metalness={.38} />
    <Block position={[-16, 2.6, -1]} scale={[2.5, 5.2, 30]} color="#77766d" roughness={.88} castShadow />
    <mesh position={[-14.71, 2.8, -2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[15, 4.5]} /><meshStandardMaterial map={mural} roughness={.9} /></mesh>
    <Block position={[18, 3.5, 6]} scale={[6, 7, 23]} color="#76695c" />
    <Block position={[17.9, 7.1, 6]} scale={[6.2, .18, 23.3]} color="#afa48c" />
    {[-1, 1].flatMap(side => [-5, 5].map(z => <group key={side + ":" + z} position={[side * 10.2, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <Block position={[0, .5, 0]} scale={[3.7, .12, .6]} color="#876748" roughness={.8} castShadow />
      <Block position={[0, .97, -.24]} rotation={[-.15, 0, 0]} scale={[3.7, .55, .1]} color="#937953" />
      {[-1.4, 1.4].map(x => <Block key={x} position={[x, .22, 0]} scale={[.09, .45, .55]} color="#354940" metalness={.55} />)}
    </group>))}
    {[-1, 1].map(side => <group key={side} position={[side * 10.6, 0, -8]}>
      <Block position={[0, 4.4, 0]} scale={[.09, 8.8, .09]} color="#41534b" metalness={.7} />
      <Block position={[-side * .65, 8.76, 0]} scale={[1.35, .12, .3]} color="#5c685c" />
      <Block position={[-side * 1.2, 8.64, 0]} scale={[.6, .07, .28]} color="#d4dfdc" emissive="#ffce8a" emissiveIntensity={1.8} />
    </group>)}
    <spotLight position={[-9.4, 8.5, -8]} color="#e1dbba" intensity={80} angle={1.05} penumbra={.7} distance={25} />
    <spotLight position={[9.4, 8.5, -8]} color="#bacfde" intensity={65} angle={1.05} penumbra={.7} distance={25} />
  </>;
}
export default function CourtArchitecture() {
  const texture = useWorldTexture("court"), grain = useWorldTexture("grain");
  return <group name="original-after-hours-court">
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[24, 36]} /><meshStandardMaterial map={texture} roughness={.68} metalness={.035} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.04, 0]} receiveShadow><planeGeometry args={[160, 160]} /><meshStandardMaterial color="#69685e" map={grain} roughness={.9} /></mesh>
    <Fence /><UrbanContext /><Hoop side={-1} /><Hoop side={1} />
    <Label text="AFTER HOURS / PRACTICE COURT" position={[-6.6, 2.1, -18.5]} size={.32} color="#ddd2bc" align="left" />
  </group>;
}
