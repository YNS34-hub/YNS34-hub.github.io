import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, MeshStandardMaterial } from "three";
import { Block, Label } from "../../world/primitives";
import Instances, { type Instance } from "../Instances";
import CourtTrees from "./Trees";
import CourtCrowd from "./Crowd";
import { courtAtmosphere } from "./state";

function ParkFurniture() {
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []), lens = useMemo(() => new MeshStandardMaterial({ color: "#dfddd1", emissive: "#ffe4ba", emissiveIntensity: .02 }), []);
  const batches = useMemo(() => {
    const metal: Instance[] = [], wood: Instance[] = [], lights: Instance[] = [];
    for (const side of [-1, 1]) {
      for (const z of [-5, 5]) {
        for (let plank = 0; plank < 4; plank++) {
          wood.push({ position: [side * 10.2 + (plank - 1.5) * .14, .5, z], scale: [.11, .07, 3.7], color: "#8a7050" });
          wood.push({ position: [side * 10.2 + side * .29, .75 + plank * .135, z], scale: [.075, .11, 3.7], color: "#9b8160" });
        }
        for (const dz of [-1.4, 1.4]) {
          metal.push({ position: [side * 10.2, .25, z + dz], scale: [.56, .45, .045] });
          metal.push({ position: [side * 10.2 + side * .29, .7, z + dz], scale: [.06, 1.05, .06] });
          metal.push({ position: [side * 10.2, .77, z + dz], scale: [.65, .055, .045] });
        }
      }
      for (const z of [-8, 8]) {
        metal.push({ position: [side * 10.6, 4.7, z], scale: [.115, 9.4, .115] });
        metal.push({ position: [side * 10.6, .1, z], scale: [.38, .2, .38] });
        metal.push({ position: [side * 10.1, 9.35, z], scale: [1.05, .16, .22] });
        metal.push({ position: [side * 10.2, 9.18, z], scale: [.75, .21, .54] });
        lights.push({ position: [side * 10.2, 9.065, z], scale: [.67, .015, .46] });
      }
    }
    return { metal, wood, lights };
  }, []);
  useEffect(() => () => { box.dispose(); lens.dispose(); }, [box, lens]);
  useFrame(() => { lens.emissiveIntensity = .02 + courtAtmosphere.night * 3.6; });
  return <>
    <Instances geometry={box} items={batches.metal} color="#253431" roughness={.43} metalness={.68} shadows />
    <Instances geometry={box} items={batches.wood} roughness={.87} shadows />
    {batches.lights.map((item, i) => <mesh key={i} position={item.position} scale={item.scale} material={lens}>
      <boxGeometry />
    </mesh>)}
    {[-1, 1].map(side => <group key={side} position={[side * 14.7, 0, 14.5]}>
      <mesh position={[0, .43, 0]} castShadow><cylinderGeometry args={[.35, .28, .86, 20]} /><meshStandardMaterial color="#2d3930" roughness={.7} metalness={.5} /></mesh>
      <mesh position={[0, .88, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.32, .035, 6, 24]} /><meshStandardMaterial color="#424941" roughness={.5} metalness={.6} /></mesh>
    </group>)}
  </>;
}
function ParkContext() {
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const context = useMemo(() => {
    const brick: Instance[] = [], trim: Instance[] = [], windows: Instance[] = [];
    // 街区位于树林后方，提供距离线索，球场周围留给真实树冠与场边人群。
    for (let i = 0; i < 9; i++) {
      const x = -58 + i * 14.5, h = 11 + i * 7 % 17, z = -65 - i % 3 * 5;
      brick.push({ position: [x, h * .5, z], scale: [10.4, h, 10], color: ["#9e8f7a", "#a69e90", "#8c8f88"][i % 3] });
      trim.push({ position: [x, h - .1, z], scale: [10.7, .35, 10.2], color: "#c3bba9" });
      trim.push({ position: [x, .45, z + 5.1], scale: [10.5, .9, .25], color: "#747c73" });
      for (let y = 2.2; y < h - 1; y += 2.7) for (const dx of [-3.4, -1.1, 1.1, 3.4]) {
        trim.push({ position: [x + dx, y - .57, z + 5.06], scale: [1.12, .08, .18], color: "#bbb9ac" });
        windows.push({ position: [x + dx, y, z + 5.08], scale: [.9, 1.12, .035], color: (i + Math.round(y)) % 5 ? "#445357" : "#afa287" });
      }
    }
    return { brick, trim, windows };
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <>
    <Instances geometry={geometry} items={context.brick} roughness={.91} color="#908d82" />
    <Instances geometry={geometry} items={context.trim} roughness={.81} color="#a8aa9c" />
    <Instances geometry={geometry} items={context.windows} roughness={.33} metalness={.2} />
    <Block position={[-17.8, .43, 0]} scale={[.55, .86, 40]} color="#747a6c" roughness={.96} />
    <Block position={[17.8, .43, 0]} scale={[.55, .86, 40]} color="#747a6c" roughness={.96} />
    <Block position={[0, .12, -22.5]} scale={[34, .24, .7]} color="#9a9d8c" roughness={.95} />
    <Label text="JIE TIAN / PARK COURT" position={[-9.6, 1.15, -18.16]} size={.17} color="#e6dcc4" maxWidth={3} />
  </>;
}
export default function CourtPark() {
  return <group name="public-park-court-context"><CourtTrees /><CourtCrowd /><ParkContext /><ParkFurniture /></group>;
}
