import CourtSets from "./court/CourtVenue";
import {useCourtSet} from "./court/courtSets";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, Quaternion, SphereGeometry, Vector3, MeshPhysicalMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useQuietMotion } from "../motion/useMotionCue";
import { Block } from "../world/primitives";
import CourtPark from "./court/Park";
import CourtSurface from "./court/Surface";
import { makeBackboardGlass } from "./court/backboardGlass";


export const courtResponse = { hoop: -1, rim: 0, net: 0, board: 0 };
function mergeHoopPieces(pieces: BufferGeometry[]) {
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  return geometry;
}
function appendRope(pieces: BufferGeometry[], a: Vector3, b: Vector3, radius: number, sides = 5) {
  const direction = b.clone().sub(a), center = a.clone().add(b).multiplyScalar(.5);
  const rope = new CylinderGeometry(radius, radius, direction.length(), sides, 1);
  rope.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()));
  rope.translate(center.x, center.y, center.z); pieces.push(rope);
}
export function makeHoopNetGeometry() {
  const pieces: BufferGeometry[] = [];
  for (let row = 0; row < 5; row++) for (let i = 0; i < 16; i++) {
    const y = -row * .083, radius = .225 - row * .021, lower = radius - .021;
    const a = i / 16 * Math.PI * 2 + row * .09;
    const top = new Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
    for (const offset of [-1, 1]) appendRope(pieces, top, new Vector3(Math.cos(a + offset * Math.PI / 16 + .09) * lower, y - .083, Math.sin(a + offset * Math.PI / 16 + .09) * lower), .0019);
    // 小结点让网绳在近景保持实体连接，全部合并成一张受光照的网。
    const knot = new SphereGeometry(.0031, 6, 4); knot.translate(top.x, top.y, top.z); pieces.push(knot);
  }
  return mergeHoopPieces(pieces);
}
export function makeHoopHardwareGeometry(side: number) {
  const pieces: BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const point = (radius: number, y: number) => new Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
    appendRope(pieces, point(.225, -.006), point(.225, -.029), .0024, 6);
    appendRope(pieces, point(.225, -.029), point(.213, -.029), .0024, 6);
    appendRope(pieces, point(.213, -.029), point(.213, -.015), .0024, 6);
  }
  for (const x of [-.83, .83]) for (const y of [.15, .95]) {
    const clamp = new BoxGeometry(.065, .065, .036); clamp.translate(x, y, side * .622); pieces.push(clamp);
    const bolt = new CylinderGeometry(.009, .009, .045, 8); bolt.rotateX(Math.PI / 2); bolt.translate(x, y, side * .593); pieces.push(bolt);
  }
  return mergeHoopPieces(pieces);
}
function Hoop({ side }: { side: number }) {
  const rim = useRef<Group>(null), net = useRef<Group>(null), board = useRef<MeshPhysicalMaterial>(null);
  const quiet = useQuietMotion();
  const glass = useMemo(makeBackboardGlass, []);
  useEffect(() => () => glass.dispose(), [glass]);
  const geometry = useMemo(makeHoopNetGeometry, []), hardware = useMemo(() => makeHoopHardwareGeometry(side), [side]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => hardware.dispose(), [hardware]);
  useFrame(({ clock }, dt) => {
    // 风只轻轻带动篮网，安静模式归零；不移动篮圈、篮板或碰撞体。
    const breeze = quiet ? 0 : Math.sin(clock.elapsedTime * .43 + side) * .002;
    if (net.current) net.current.rotation.x = breeze;
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
    <Block position={[0, 2.78, side * 14.25]} rotation={[side * .38, 0, 0]} scale={[.18, .2, 2.9]} color="#415750" metalness={.7} />
    <Block position={[0, .08, side * 15.4]} scale={[.9, .16, 1.2]} color="#606259" />
    <Block position={[0, .79, side * 15.4]} scale={[.36, 1.36, .36]} color="#202d2e" roughness={.83} />
    <Block position={[0, 3.32, side * 12.94]} scale={[.19, .17, .46]} color="#354340" metalness={.7} roughness={.35} />
    <Block position={[0, 3.33, side * 12.775]} scale={[.24, .44, .09]} color="#43524c" metalness={.65} roughness={.38} />
    <mesh position={[0, 3.6, side * 12.72]} castShadow>
      <boxGeometry args={[1.8, 1.05, .055]} /><primitive object={glass} attach="material" ref={board} />
    </mesh>
    {[-1, 1].map(s => <Block key={s} position={[s * .91, 3.6, side * 12.72]} scale={[.035, 1.09, .07]} color="#d9e0d2" metalness={.4} />)}
    {[3.06, 4.14].map(y => <Block key={y} position={[0, y, side * 12.72]} scale={[1.86, .035, .07]} color="#d9e0d2" metalness={.4} />)}
    <Block position={[0, 3.025, side * 12.72]} scale={[1.82, .075, .115]} color="#293635" roughness={.94} bevel={.017} />
    <mesh geometry={hardware} position={[0, 3.05, side * 12.1]}><meshStandardMaterial color="#b8bdb8" metalness={.76} roughness={.34} /></mesh>
    <group position={[0, 3.34, side * 12.68]}>
      {[-.29, .29].map(x => <Block key={x} position={[x, 0, 0]} scale={[.025, .43, .018]} color="#eef0dd" />)}
      {[-.215, .215].map(y => <Block key={y} position={[0, y, 0]} scale={[.6, .025, .018]} color="#eef0dd" />)}
    </group>
    <Block position={[0, 3.02, side * 12.4]} scale={[.12, .1, .4]} color="#bd6f3e" metalness={.65} />
    <group ref={rim} position={[0, 3.05, side * 12.1]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.225, .009, 8, 48]} /><meshStandardMaterial color="#d4753d" roughness={.3} metalness={.55} /></mesh>
      <group ref={net}><mesh geometry={geometry}><meshStandardMaterial color="#e5e3d6" roughness={.94} /></mesh></group>
    </group>
  </group>;
}
function Fence() {
  const geometry = useMemo(() => {
    const p: Vector3[] = [];
    // 在矩形内裁切真实小菱形围网；四米高的整面交叉线不能表现铁丝网的尺度。
    const weave = (side: number, lower: number, upper: number, end: boolean) => {
      for (const slope of [-1, 1]) for (let start = lower - 3.2; start <= upper + 3.2; start += .24) {
        const y0 = Math.max(.1, .1 + (slope === 1 ? lower - start : start - upper));
        const y1 = Math.min(3.25, .1 + (slope === 1 ? upper - start : start - lower));
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
    <lineSegments geometry={geometry}><lineBasicMaterial color="#34413c" transparent opacity={.55} /></lineSegments>
    {[-1, 1].flatMap(side => [-16, -8, 0, 8, 16].map(z => <Block key={side + ":" + z} position={[side * 12, 1.65, z]} scale={[.07, 3.3, .07]} color="#3b4b41" metalness={.6} />))}
    {[-1, 1].map(side => <Block key={side} position={[side * 12, 3.3, 0]} scale={[.055, .055, 36]} color="#566457" metalness={.5} />)}
  </>;
}
export default function CourtArchitecture() {
  const set=useCourtSet(s=>s.selected);
  return <group name="original-after-hours-court">
    {set==="park"?<><CourtSurface/><Fence/><CourtPark/></>:<CourtSets/>}<Hoop side={-1} /><Hoop side={1} />
  </group>;
}
