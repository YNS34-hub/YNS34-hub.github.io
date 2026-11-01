import { Block } from "../../world/primitives";
import { BoxBatch, Rod, type BoxInstance } from "../../world/StudioObjects";
import { studyDesk as desk, studyChairs, studyBookcase as shelf } from "./studyPlan";
import { ArchitecturalBlock as Stone } from "./ArchitecturalSurfaces";

const steel: BoxInstance[] = [];
for (const x of [-1, 1]) for (const z of [-1, 1]) steel.push({ position: [desk.x + x * 2.1, .37, desk.z + z * .65], scale: [.065, .74, .065] });
for (const chair of studyChairs) for (const x of [-1, 1]) for (const z of [-1, 1]) steel.push({ position: [chair.x + x * .28, .21, chair.z + z * .27], scale: [.04, .42, .04] });
for (const chair of studyChairs) for (const side of [-1, 1]) steel.push({ position: [chair.x + side * .29, .59, chair.z + .275], scale: [.036, .7, .036], rotation: [-.043, 0, 0] });
const shelves: BoxInstance[] = [
  { position: [-1.56, 1.65, 0], scale: [.08, 3.3, .5] }, { position: [1.56, 1.65, 0], scale: [.08, 3.3, .5] },
  ...[.1, 1.15, 2.2, 3.25].map(y => ({ position: [0, y, 0] as [number, number, number], scale: [3.2, .07, .5] as [number, number, number] })),
];
const books: BoxInstance[] = [];
for (let row = 0; row < 3; row++) for (let i = 0; i < 10; i++) {
  const height = [.39, .44, .35, .42, .4][i % 5];
  books.push({ position: [-1.28 + i * .24, .135 + row * 1.05 + height / 2, .055], scale: [.15 + (i % 3) * .015, height, .27], color: ["#b7b6a3", "#58675a", "#8e7051", "#d1cbb4", "#525b60"][i % 5] });
}
export default function StudyFurniture() {
  return <group name="reference-study-furniture">
    <BoxBatch items={steel} color="#3f4840" metalness={.65} roughness={.4} name="study-metal-frames" />
    <group name="reference-study-desk" position={[desk.x, 0, desk.z]}>
      <Stone position={[0, desk.height, 0]} scale={[desk.width, .085, desk.depth]} finish="timber" color="#b6a28c" roughness={.58} bevel={.04} castShadow />
      <Stone position={[0, desk.height - .1, 0]} scale={[desk.width - .16, .09, desk.depth - .16]} finish="timber" color="#77604d" />
      <Block position={[-1.25, .85, -.2]} scale={[.5, .055, .34]} color="#d3c8a9" roughness={.92} />
      <Block position={[-1.25, .885, -.2]} scale={[.48, .015, .33]} color="#536459" roughness={.86} />
    </group>
    {studyChairs.map((chair, i) => <group key={i} position={[chair.x, 0, chair.z]} name={`reference-study-chair-${i}`}>
      <Block position={[0, .44, 0]} scale={[.7, .07, .7]} color="#3d444b" roughness={.55} metalness={.6} bevel={.025} castShadow />
      <Block position={[0, .505, 0]} scale={[.69, .13, .68]} color="#716154" roughness={.86} bevel={.06} castShadow />
      <Block position={[0, .87, .29]} rotation={[-.07, 0, 0]} scale={[.69, .7, .1]} color="#746251" roughness={.83} bevel={.04} castShadow />
      <Block position={[0, .865, .23]} rotation={[-.07, 0, 0]} scale={[.6, .58, .025]} color="#82715f" roughness={.9} bevel={.025} castShadow />
    </group>)}
    <group position={[shelf.x, 0, shelf.z]} rotation={[0, Math.PI / 2, 0]} name="reference-study-bookcase">
      <BoxBatch items={shelves} color="#70634c" roughness={.85} />
      <BoxBatch items={books} roughness={.92} />
    </group>
    <Rod a={[9.1, .83, 3.5]} b={[9.1, 1.38, 3.5]} color="#51594a" radius={.018} />
    <mesh position={[9.1, 1.42, 3.5]}><coneGeometry args={[.18, .2, 24, 1, true]} /><meshStandardMaterial color="#5f624b" roughness={.65} metalness={.28} /></mesh>
    <mesh position={[9.1, 1.32, 3.5]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[.17, 24]} /><meshStandardMaterial color="#ede2c8" emissive="#ecd9ae" emissiveIntensity={.5} roughness={.8} /></mesh>
  </group>;
}
