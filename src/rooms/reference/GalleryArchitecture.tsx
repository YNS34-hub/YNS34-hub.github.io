import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { BackSide, SRGBColorSpace } from "three";
import { Block, Label } from "../../world/primitives";
import { BoxBatch, Planter, type BoxInstance } from "../../world/StudioObjects";
import { ArchitecturalBlock as Stone, ArchitecturalSurfaces, architecturalDaylightUrl } from "./ArchitecturalSurfaces";
import GalleryFloor from "./GalleryFloor";
import StudyFurniture from "./StudyFurniture";
import ArchitecturalBatch from "./ArchitecturalBatch";

const noRaycast = () => {};
function SkyCourt() {
  const source = useTexture(architecturalDaylightUrl);
  const sky = useMemo(() => { const texture = source.clone(); texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; return texture; }, [source]);
  useEffect(() => () => sky.dispose(), [sky]);
  return <mesh name="architectural-daylight-sky" raycast={noRaycast}>
    <sphereGeometry args={[85, 40, 20]} /><meshBasicMaterial map={sky} side={BackSide} toneMapped={false} fog={false} />
  </mesh>;
}

export function GalleryCoffers({ height = 9.8, warm = false }: { height?: number; warm?: boolean }) {
  const beams: BoxInstance[] = [-13, -6.5, 0, 6.5, 13].flatMap(z => [
    { position: [0, height, z], scale: [27.1, .36, .28] },
    ...[-1, 1].map(side => ({ position: [side * 13.32, height / 2, z] as [number, number, number], scale: [.28, height, .3] as [number, number, number] })),
  ]);
  return <group name="gallery-bearing-coffers">
    <BoxBatch items={beams} color="#353c42" roughness={.64} metalness={.18} />
    {[-1, 1].map(side => <group key={side}>
      <Stone position={[side * 8.1, height + .27, -1]} scale={[11, .5, 33]} color={warm ? "#55504a" : "#4a5057"} castShadow />
      <Stone position={[side * 2.57, height + .24, -1]} scale={[.075, .48, 32]} finish="bronze" />
      <Block position={[side * 13.18, height - .22, -1]} scale={[.045, .035, 31.7]} color="#e4cfb0" emissive="#e7cc9d" emissiveIntensity={.9} />
    </group>)}
    {[-10, -2, 6].map(z => <group key={z} position={[0, height - .32, z]}>
      <Block scale={[20, .045, .06]} color="#242b31" metalness={.65} />
      {[-8, 8].map(x => <group key={x} position={[x, -.11, 0]}>
        <mesh rotation={[.24, 0, x < 0 ? -.35 : .35]}><cylinderGeometry args={[.085, .095, .22, 16]} /><meshStandardMaterial color="#252c32" metalness={.55} roughness={.4} /></mesh>
        <mesh position={[0, -.115, .02]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.067, 16]} /><meshBasicMaterial color="#dfd6c6" /></mesh>
      </group>)}
    </group>)}
  </group>;
}

export function ProjectGalleryArchitecture() {
  return <ArchitecturalSurfaces radiance="projects"><group name="project-gallery-finished-shell">
    <SkyCourt />
    <GalleryFloor color="#9b897a" wood />
    <Stone position={[-13.8, 5.4, 0]} scale={[.7, 10.8, 34]} color="#8a9095" />
    <Stone position={[13.8, 6.6, -4]} scale={[.7, 13.2, 26]} color="#414950" />
    <Stone position={[0, 5.7, -16.8]} scale={[28, 11.4, .8]} color="#5e646a" />
    <GalleryCoffers warm />
    <Stone position={[6.8, 4.2, -10]} scale={[.45, 8.4, 8.5]} color="#5a6268" />
    <Stone position={[-8, .12, 2]} scale={[4, .24, 9]} color="#484e53" roughness={.5} />
    {[-1, 1].map(side => <group key={side}>
      <Stone position={[side * 13.37, .19, 0]} scale={[.075, .28, 33]} color="#252d33" />
      <Block position={[side * 13.3, 1.05, 0]} scale={[.012, .014, 33]} color="#a5a9aa" roughness={.6} />
    </group>)}
  </group></ArchitecturalSurfaces>;
}

function ReadingWindow() {
  return <group name="research-daylight-window">
    <SkyCourt />
    <Stone position={[13.8, .6, 0]} scale={[.7, 1.2, 34]} finish="limestone" color="#a7aaa8" />
    <Stone position={[13.8, 8.6, 0]} scale={[.7, .8, 34]} color="#555d64" castShadow />
    {[-13.6, 12].map(z => <Stone key={z} position={[13.8, 4.8, z]} scale={[.7, 7.2, z < 0 ? 6.8 : 10]} color="#646d73" />)}
    <Stone position={[13.33, 1.22, -1.8]} scale={[.92, .12, 17.2]} finish="limestone" color="#adb0ae" />
    <mesh position={[13.62, 4.72, -1.8]} rotation={[0, -Math.PI / 2, 0]}>
      <planeGeometry args={[17.2, 6.9]} /><meshPhysicalMaterial color="#e3eff7" metalness={0} roughness={.025} transparent opacity={.09} depthWrite={false} ior={1.46} envMapIntensity={.6} />
    </mesh>
    <ArchitecturalBatch name="research-window-mullions" finish="bronze" color="#737c83" items={[-10.4, -6.1, -1.8, 2.5, 6.8].map(z => ({ position: [13.37, 4.72, z], scale: [.11, 7.02, .065] }))} />
    <Stone position={[17.7, -.16, -1.8]} scale={[7.5, .24, 23]} color="#939a9b" />
    <Planter position={[16.1, 0, 5]} scale={2.4} />
    <rectAreaLight position={[13.1, 4.7, -1.8]} rotation={[0, Math.PI / 2, 0]} color="#d3e5f3" intensity={2.4} width={16.8} height={6.7} />
  </group>;
}

function LibraryWall() {
  const shelves: BoxInstance[] = [], books: BoxInstance[] = [];
  for (const x of [-10.9, -7.2]) {
    shelves.push({ position: [x - 1.65, 3.1, -16.05], scale: [.12, 6.2, .55] }, { position: [x + 1.65, 3.1, -16.05], scale: [.12, 6.2, .55] });
    for (let row = 0; row < 6; row++) {
      const y = .18 + row * 1.04;
      shelves.push({ position: [x, y, -16.05], scale: [3.35, .09, .58] });
      for (let i = 0; i < 12; i++) {
        const h = .33 + ((i * 7 + row * 3) % 5) * .05;
        books.push({ position: [x - 1.38 + i * .24, y + .045 + h / 2, -15.96], scale: [.14 + (i % 3) * .018, h, .29], color: ["#a49a80", "#5e6c72", "#8c725c", "#b4ada0", "#48545e"][i % 5] });
      }
    }
  }
  return <group name="research-built-in-library">
    <Stone position={[-9.05, 3.15, -16.38]} scale={[7.1, 6.3, .2]} finish="timber" color="#6c5846" />
    <BoxBatch items={shelves} color="#655544" roughness={.7} />
    <BoxBatch items={books} roughness={.86} />
    <Block position={[-9.05, 6.39, -15.95]} scale={[6.9, .025, .035]} color="#f5dfb6" emissive="#efd09a" emissiveIntensity={1.3} />
  </group>;
}

export function ResearchGalleryArchitecture() {
  return <ArchitecturalSurfaces radiance="research"><group name="research-finished-architecture">
    <GalleryFloor color="#93999d" />
    <Stone position={[-13.8, 4.5, 0]} scale={[.7, 9, 34]} color="#555d63" />
    <Stone position={[0, 4.5, -16.8]} scale={[28, 9, .7]} color="#3b444d" />
    <ArchitecturalBatch name="research-bearing-roof-panels" color="#5d656b" items={[-8, 0, 8].map(x => ({ position: [x, 9.2, 0], scale: [7.4, .6, 34] }))} />
    <ArchitecturalBatch name="research-roof-light-wells" finish="limestone" color="#dde4e5" items={[-8, 0, 8].map(x => ({ position: [x + 3.95, 9.5, 0], scale: [.65, .2, 33] }))} />
    <ArchitecturalBatch name="research-roof-cross-members" color="#414a53" items={[-12, -4, 4, 12].map(z => ({ position: [0, 8.88, z], scale: [27, .2, .25] }))} />
    <ReadingWindow />
    <LibraryWall />
    <StudyFurniture />
    <Stone position={[-13.34, .17, 0]} scale={[.08, .28, 33]} color="#252d33" />
    <group name="research-reading-pendant" position={[7.5, 4.5, 4]}>
      <Stone scale={[4.6, .085, .16]} finish="bronze" color="#6e7477" />
      <Block position={[0, -.05, 0]} scale={[4.45, .018, .09]} color="#f5e3c8" emissive="#ffe4b6" emissiveIntensity={1.1} />
    </group>
    <BoxBatch name="research-suspension-cables" items={[
      ...[-1.6, 1.6].map(x => ({ position: [7.5 + x, 6.73, 4] as [number, number, number], scale: [.014, 4.34, .014] as [number, number, number] })),
      ...[-1, 1].map(side => ({ position: [-3.4 + side * 1.3, 7.325, -4] as [number, number, number], scale: [.014, 3.01, .014] as [number, number, number] })),
    ]} color="#87949e" metalness={.6} roughness={.4} />
    <Label text="STUDIES / NONLINEAR ANALYSIS" position={[-9.1, 7.2, -16.38]} size={.22} color="#c7d4da" />
  </group></ArchitecturalSurfaces>;
}
