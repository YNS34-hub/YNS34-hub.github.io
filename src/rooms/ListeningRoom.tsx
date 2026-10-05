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
  Floor,
  Label,
  Picture,
  ContactShadow,
} from "../world/primitives";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { useAudioStore } from "../audio/player";
import { audioSignal } from "../audio/signal";
import LyricsWall from "./LyricsWall";

const bands = ["bass", "mid", "treble"] as const;

function AcousticWall() {
  const ribs = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!ribs.current) return;
    for (let i = 0; i < 58; i++) {
      const theta = -Math.PI * 0.88 + (i / 57) * Math.PI * 1.76;
      dummy.position.set(Math.sin(theta) * 12, 4.4, -4 - Math.cos(theta) * 12);
      dummy.rotation.set(0, theta, 0);
      dummy.scale.set(0.28, 8.8, 0.68);
      dummy.updateMatrix();
      ribs.current.setMatrixAt(i, dummy.matrix);
    }
    ribs.current.instanceMatrix.needsUpdate = true;
    ribs.current.computeBoundingSphere();
  }, [dummy]);
  return (
    <instancedMesh
      ref={ribs}
      args={[undefined, undefined, 58]}
      castShadow
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial color="#38445a" roughness={0.83} metalness={0.05} />
    </instancedMesh>
  );
}
function Instrument() {
  const fins = useRef<Group>(null);
  const baseLight = useRef<PointLight>(null);
  const rim = useRef<MeshStandardMaterial>(null);
  const values = useRef({ bass: 0, mid: 0, treble: 0 });
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    const decay = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
    for (const key of bands)
      values.current[key] +=
        ((audioSignal.available && !reduced ? audioSignal[key] : 0) -
          values.current[key]) *
        decay;
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
        color="#1a2840"
        roughness={0.27}
        metalness={0.5}
      />
      <Block
        position={[0, 0.49, 0]}
        scale={[7.3, 0.035, 2.9]}
        color="#708caa"
        roughness={0.25}
        metalness={0.6}
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
                position={[0, h / 2 + 0.58, 0]}
                scale={[0.08, h, 0.42]}
                color="#748eaa"
                metalness={0.7}
                roughness={0.24}
              />
              <mesh position={[0.12, h / 2 + 0.58, 0]}>
                <boxGeometry args={[0.28, h, 1.04]} />
                <meshPhysicalMaterial
                  color="#c4e6fa"
                  roughness={0.08}
                  metalness={0}
                  transmission={0.92}
                  thickness={0.7}
                  ior={1.46}
                  attenuationColor="#64a6e4"
                  attenuationDistance={7}
                  envMapIntensity={1.5}
                />
              </mesh>
              <mesh position={[0.275, h / 2 + 0.58, 0.48]}>
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
        color="#598ed6"
      />
    </group>
  );
}
function RhythmDetails() {
  const materials = useRef<(MeshStandardMaterial | null)[]>([]);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  const values = useRef([0, 0, 0]);
  useFrame((_, dt) => {
    const response = 1 - Math.exp(-Math.min(dt, 0.1) * 2.5);
    for (let i = 0; i < 3; i++) {
      values.current[i] += ((audioSignal.available && !reduced ? audioSignal[bands[i]] : 0) - values.current[i]) * response;
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
  return (
    <group>
      <Floor width={28} depth={34} color="#17233b" />
      <AcousticWall />
      <Block
        position={[0, 9.5, -5]}
        scale={[26, 0.65, 24]}
        color="#0c172d"
        castShadow
      />
      {/* Suspended amber canopy, open along its center. It has a weight and a front edge. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 5.2, 8.5, -5]}
            scale={[5.8, 0.36, 22]}
            color="#524534"
            metalness={0.28}
            roughness={0.55}
          />
          <Block
            position={[side * 2.25, 8.31, -5]}
            scale={[0.1, 0.06, 20.8]}
            color="#e0be91"
            emissive="#dfb981"
            emissiveIntensity={0.65}
          />
        </group>
      ))}
      <Instrument />
      <RhythmDetails />
      <LyricsWall />
      {/* The listening datum is below eye height, separate from the sculpture's stage. */}
      <Block
        position={[-4, 0.32, 6.5]}
        scale={[4.8, 0.64, 1.25]}
        color="#233349"
        roughness={0.7}
      />
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
            <Block scale={[3.8, 3.8, 0.12]} color="#283951" />
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
        target-position={[0, 3, -5]}
        color="#d7e7fa"
        intensity={220}
        angle={0.5}
        penumbra={0.7}
        distance={26}
      />
      <pointLight
        position={[7, 5, -9]}
        intensity={85}
        distance={22}
        color="#e9be83"
      />
      <Door
        id="atrium"
        title="The Atrium"
        position={[7.5, 0, 12.8]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group>
  );
}
