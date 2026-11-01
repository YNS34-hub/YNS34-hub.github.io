import { Block, Label } from "../../world/primitives";
import type { ArtPlacement } from "../../world/spatialLayout";
import GalleryFloor from "./GalleryFloor";
import ArtworkWash from "./ArtworkWash";
import { ArchitecturalBlock as Stone, ArchitecturalSurfaces } from "./ArchitecturalSurfaces";
import { GalleryCoffers } from "./GalleryArchitecture";

export default function ArchiveArchitecture({ placements }: { placements: ArtPlacement[] }) {
  return <ArchitecturalSurfaces radiance="wallpapers"><group name="reference-image-archive-shell">
    <GalleryFloor color="#8b949b" />
    <Stone position={[0, 6.1, -16.8]} scale={[28, 12.2, .8]} color="#858f97" />
    {[-1, 1].map(side => <group key={side}>
      <Stone position={[side * 13.8, 4.6, 0]} scale={[.7, 9.2, 34]} color="#7c8790" />
      <Stone position={[side * 13.36, .17, 0]} scale={[.08, .28, 33.5]} color="#242c33" />
    </group>)}
    <GalleryCoffers height={9.2} />
    <Block position={[0, 10.3, -4]} scale={[5.1, .035, 27]} color="#e6ebed" emissive="#dce8ef" emissiveIntensity={.35} />
    <Label text="SELECTED IMAGES" position={[-9.75, 8, -16.34]} size={.32} align="left" color="#b8c9d3" />
    {placements.map(p => <group key={p.id}>
      {/* 画框沿各自墙面法线后退，旋转侧墙不再错误地只减全局 z。 */}
      <group position={p.position} rotation={p.rotation}>
        <Block position={[0, 0, -.14]} scale={[p.width + .24, p.height + .24, .08]} color="#181d1b" roughness={.62} metalness={.16} />
      </group>
      <ArtworkWash placement={p} />
    </group>)}
  </group></ArchitecturalSurfaces>;
}
