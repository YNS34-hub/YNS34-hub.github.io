import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Group,
  InstancedMesh,
  Object3D,
  PointLight,
  MeshStandardMaterial,
} from "three";
import {
  Block,
  Door,
  Label,
  Picture,
  ContactShadow,
} from "../world/primitives";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { useAudioStore } from "../audio/player";
import { audioSignal } from "../audio/signal";
import LyricsWall from "./LyricsWall";
import { measuredEnergy, settleMotion } from "../motion/tokens";
import { useQuietMotion } from "../motion/useMotionCue";
import GalleryFloor from "./reference/GalleryFloor";
import { ArchitecturalSurfaces, useArchitecturalSurfaces } from "./reference/ArchitecturalSurfaces";
import ListeningArchitecture from "./reference/ListeningArchitecture";

const bands = ["bass", "mid", "treble"] as const;
// 三个现有频段采用不同包络：低频较慢，中频跟随，高频快速归位；幅度和构件保持不变。
const responses = { bass: [0.24, 0.55], mid: [0.16, 0.42], treble: [0.08, 0.24] } as const;

function AcousticWall() {
  const surfaces = useArchitecturalSurfaces();
  const ribs = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!ribs.current) return;
    for (let i = 0; i < 58; i++) {
      const theta = -Math.PI * 0.88 + (i / 57) * Math.PI * 1.76;
      dummy.position.set(Math.sin(theta) * 12, 4.4, -4 - Math.cos(theta) * 12);
      dummy.rotation.set(0, theta, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ribs.current.setMatrixAt(i, dummy.matrix);
    }
    ribs.current.instanceMatrix.needsUpdate = true;
    ribs.current.computeBoundingSphere();
  }, [dummy]);
  return (
    <instancedMesh
      ref={ribs}
      args={[surfaces.geometry(.28, 8.8, .68, .025), surfaces.material("timber", "#b69a7d", .76, .015), 58]}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
function Instrument() {
  const surfaces = useArchitecturalSurfaces();
  const fins = useRef<Group>(null);
  const baseLight = useRef<PointLight>(null);
  const rim = useRef<MeshStandardMaterial>(null);
  const values = useRef({ bass: 0, mid: 0, treble: 0 });
  const reduced = useQuietMotion();
  useFrame((_, dt) => {
    for (const key of bands) {
      const target = audioSignal.available && !reduced ? measuredEnergy(audioSignal[key]) : 0;
      values.current[key] = settleMotion(values.current[key], target, dt, ...responses[key]);
      if (!target && values.current[key] < 0.0001) values.current[key] = 0;
    }
    if (fins.current)
      fins.current.children.forEach((fin, i) => {
        fin.rotation.z =
          (i - 3) * 0.055 + values.current.mid * 0.055 * Math.sin(i * 0.9);
        fin.position.y = values.current.mid * 0.025 * Math.cos(i);
      });
    if (baseLight.current)
      baseLight.current.intensity = 48 + values.current.bass * 34;
    if (rim.current)
      rim.current.emissiveIntensity = 0.14 + values.current.treble * 0.65;
  });
  return (
    <group
      position={[0, 0, -5]}
      onClick={(e) => {
        if (e.delta < 5) {
          e.stopPropagation();
          usePalaceStore.getState().setOverlay("player");
        }
      }}
    >
      <ContactShadow width={8.6} depth={5.2} opacity={0.7} />
      <Block
        position={[0, 0.24, 0]}
        scale={[7.6, 0.48, 3.2]}
        color="#303b45"
        roughness={0.62}
        metalness={0.14}
      />
      <Block
        position={[0, 0.49, 0]}
        scale={[7.3, 0.035, 2.9]}
        color="#6e7d88"
        roughness={0.42}
        metalness={0.4}
      />
      <group ref={fins} name="audio-fins">
        {Array.from({ length: 7 }, (_, i) => {
          const h = 4.4 + Math.cos((i - 3) * 0.55) * 1.6;
          return (
            <group
              key={i}
              position={[(i - 3) * 0.82, 0, Math.abs(i - 3) * 0.17]}
              rotation={[0, (i - 3) * 0.08, (i - 3) * 0.055]}
            >
              <Block
                position={[-.14, h / 2 + 0.58, 0]}
                scale={[0.025, h, 0.3]}
                color="#9faab2"
                metalness={0.5}
                roughness={0.5}
              />
              <mesh position={[0.12, h / 2 + 0.58, 0]} geometry={surfaces.geometry(.54, h, .62, .028)}>
                <meshPhysicalMaterial
                  color="#e3f2f9"
                  roughness={0.045}
                  metalness={0}
                  transmission={0.92}
                  thickness={0.7}
                  ior={1.46}
                  attenuationColor="#bddce9"
                  attenuationDistance={14}
                  envMapIntensity={0.65}
                />
              </mesh>
              <mesh position={[0.405, h / 2 + 0.58, 0.29]}>
                <boxGeometry args={[0.014, h, 0.024]} />
                <meshStandardMaterial
                  ref={i === 3 ? rim : undefined}
                  color="#e5c6a0"
                  emissive="#d9b47d"
                  emissiveIntensity={0.18}
                  roughness={0.22}
                  metalness={0.4}
                />
              </mesh>
            </group>
          );
        })}
      </group>
      <pointLight
        ref={baseLight}
        position={[0, 1, 2.6]}
        intensity={48}
        distance={15}
        color="#b8d2d0"
      />
    </group>
  );
}
function RhythmDetails() {
  const materials = useRef<(MeshStandardMaterial | null)[]>([]);
  const reduced = useQuietMotion();
  const values = useRef([0, 0, 0]);
  useFrame((_, dt) => {
    for (let i = 0; i < 3; i++) {
      const target = audioSignal.available && !reduced ? measuredEnergy(audioSignal[bands[i]]) : 0;
      values.current[i] = settleMotion(values.current[i], target, dt, 0.24, 0.4);
      if (!target && values.current[i] < 0.0001) values.current[i] = 0;
      const material = materials.current[i];
      if (material) material.emissiveIntensity = 0.08 + values.current[i] * 0.2;
    }
  });
  return <group name="rhythm-light-details">{[0, 1, 2].map(i => <mesh key={i} position={[-2.1 + i * 2.1, 8.3, -2.5 - i * 3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.025, 4.5]} /><meshStandardMaterial ref={m => { materials.current[i] = m; }} color="#cdb89b" emissive="#c7ad84" emissiveIntensity={0.08} roughness={0.7} /></mesh>)}</group>;
}

export default function ListeningRoom() {
  const tracks = useLibraryStore((s) => s.music),
    id = useAudioStore((s) => s.currentId);
  const track = tracks.find((x) => x.id === id);
  const keyTarget = useMemo(() => { const target = new Object3D(); target.position.set(0, 3, -5); return target; }, []);
  return (
    <ArchitecturalSurfaces radiance="music"><group>
      <GalleryFloor color="#757c83" />
      <AcousticWall />
      <ListeningArchitecture />
      <Instrument />
      <RhythmDetails />
      <LyricsWall />
      {/* The listening datum is below eye height, separate from the sculpture's stage. */}
      <ContactShadow
        position={[-4, 0.02, 6.5]}
        width={6}
        depth={2.6}
        opacity={0.35}
      />
      <group position={[-7.9, 3.3, -8]} rotation={[0, 0.36, 0]}>
        {track?.cover ? (
          <Picture
            src={track.displayCover || track.cover}
            width={3.8}
            height={3.8}
            medium="print"
          />
        ) : (
          <>
            <Block scale={[3.8, 3.8, 0.12]} color="#394337" />
            <Label
              text={track ? "LOCAL AUDIO\nNO ARTWORK" : "梁博\nLISTENING SHELF"}
              position={[0, 0.3, 0.08]}
              size={0.27}
              color="#d4deed"
              maxWidth={3}
            />
            <Label
              text={
                track
                  ? "YOUR BROWSER LIBRARY"
                  : "男孩\n出现又离开\n日落大道\n灵魂歌手"
              }
              position={[0, -0.8, 0.08]}
              size={0.13}
              color="#c4ae90"
              maxWidth={3}
            />
          </>
        )}
        <Label
          text={track?.artist || "梁博 / LISTENING PREFERENCE"}
          position={[0, -2.35, 0.1]}
          size={0.2}
          color="#d8ba91"
          maxWidth={5}
        />
      </group>
      <spotLight
        position={[-4, 8, 3]}
        target={keyTarget}
        color="#e1ebf4"
        intensity={320}
        angle={0.5}
        penumbra={0.7}
        distance={26}
      />
      <primitive object={keyTarget} />
      <pointLight
        position={[-7, 5, -9]}
        intensity={30}
        distance={22}
        color="#e7c89f"
      />
      <Door
        id="atrium"
        title="The Atrium"
        position={[7.5, 0, 12.8]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group></ArchitecturalSurfaces>
  );
}
