import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Color, Group, MeshStandardMaterial, type Texture } from "three";
import { useLibraryStore } from "../systems/library";
import { useAudioStore } from "../audio/player";
import { usePalaceStore } from "../systems/store";
import {
  Block,
  ContactShadow,
  Door,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import { RoomShell } from "./Architecture";

export function sampledColor(texture: Texture | null, fallback = "#849aa7") {
  const color = new Color(fallback);
  if (!texture?.image) return color;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const context = canvas.getContext("2d")!;
    context.drawImage(texture.image, 0, 0, 8, 8);
    const pixels = context.getImageData(0, 0, 8, 8).data;
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
    }
    color
      .setRGB(r / 64 / 255, g / 64 / 255, b / 64 / 255)
      .convertSRGBToLinear();
    color.lerp(new Color("#bdd9dd"), 0.6);
  } catch {
    /* Remote images without CORS remain usable; lighting retains its neutral palette. */
  }
  return color;
}

function Speaker({ x }: { x: number }) {
  return (
    <group position={[x, 0, -9.6]}>
      <ContactShadow width={2.9} depth={2.6} opacity={0.25} />
      <Block
        position={[0, 1.48, 0]}
        scale={[1.05, 2.96, 0.85]}
        color="#1b211f"
        roughness={0.7}
      />
      {[1.13, 2.22].map((y, index) => (
        <group key={y} position={[0, y, 0.45]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[index ? 0.22 : 0.36, index ? 0.22 : 0.36, 0.025, 32]}
            />
            <meshStandardMaterial color="#101615" roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[index ? 0.225 : 0.365, 0.016, 6, 32]} />
            <meshStandardMaterial
              color="#66706a"
              roughness={0.5}
              metalness={0.45}
            />
          </mesh>
        </group>
      ))}
      <Block
        position={[0, 0.05, 0]}
        scale={[1.26, 0.1, 1.05]}
        color="#272f29"
      />
    </group>
  );
}

function Turntable() {
  const vinyl = useRef<Group>(null);
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  useFrame((_, delta) => {
    if (vinyl.current && useAudioStore.getState().playing && !reducedMotion)
      vinyl.current.rotation.y += delta * 0.6;
  });
  return (
    <group
      position={[0, 0, -5.6]}
      onClick={(event) => {
        if (event.delta > 5) return;
        event.stopPropagation();
        usePalaceStore.getState().setOverlay("collection");
      }}
    >
      <ContactShadow width={5.8} depth={3.7} opacity={0.3} />
      <Block
        position={[0, 0.63, 0]}
        scale={[3.5, 1.26, 1.5]}
        color="#3b3931"
        roughness={0.6}
      />
      <Block
        position={[0, 1.29, 0]}
        scale={[3.56, 0.1, 1.55]}
        color="#665f50"
        roughness={0.4}
      />
      <Block
        position={[-0.23, 1.43, 0]}
        scale={[1.92, 0.18, 1.1]}
        color="#131c1b"
        metalness={0.32}
        roughness={0.23}
      />
      <group ref={vinyl} position={[-0.35, 1.555, 0]}>
        <mesh>
          <cylinderGeometry args={[0.49, 0.49, 0.025, 64]} />
          <meshStandardMaterial
            color="#0b1110"
            roughness={0.28}
            metalness={0.38}
          />
        </mesh>
        <mesh position={[0, 0.019, 0]}>
          <cylinderGeometry args={[0.125, 0.125, 0.004, 32]} />
          <meshStandardMaterial color="#b0c8c8" />
        </mesh>
        {[0.25, 0.33, 0.42].map((radius) => (
          <mesh
            key={radius}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.015, 0]}
          >
            <torusGeometry args={[radius, 0.003, 4, 64]} />
            <meshBasicMaterial color="#26312e" />
          </mesh>
        ))}
      </group>
      <Block
        position={[0.5, 1.59, -0.2]}
        rotation={[0, -0.5, 0]}
        scale={[0.5, 0.033, 0.035]}
        color="#a9afaa"
        metalness={0.7}
        roughness={0.2}
      />
      <Label
        text="THE LISTENING TABLE"
        position={[0, 0.74, 0.8]}
        size={0.18}
        color="#bcc5bb"
      />
      <Label
        text="OPEN COLLECTION  →"
        position={[0, 0.42, 0.81]}
        size={0.12}
        color="#8da29b"
      />
    </group>
  );
}

function NightWindow() {
  const city = useRef<Group>(null);
  const playing = useAudioStore((s) => s.playing);
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  useFrame((_, delta) => {
    if (city.current)
      city.current.position.y +=
        ((playing ? 0 : -1.3) - city.current.position.y) *
        Math.min(delta * (reducedMotion ? 20 : 0.65), 1);
  });
  const skyline = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        x: -10.5 + i * 1.22,
        height: 1.8 + (Math.sin(i * 7.17) + 1) * 2.4,
      })),
    [],
  );
  return (
    <group position={[13.42, 0, -2]} rotation={[0, -Math.PI / 2, 0]}>
      <Block
        position={[0, 4.1, -0.12]}
        scale={[23, 8.2, 0.2]}
        color="#122028"
        roughness={0.23}
        metalness={0.2}
      />
      <Block
        position={[0, 3.5, -0.01]}
        scale={[22, 0.035, 0.04]}
        color="#597b83"
        emissive="#698996"
        emissiveIntensity={0.3}
      />
      <group ref={city}>
        {skyline.map((building, i) => (
          <group key={i} position={[building.x, 0, 0]}>
            <Block
              position={[0, building.height / 2, 0.015]}
              scale={[1.02, building.height, 0.04]}
              color={i % 2 ? "#233038" : "#1b2b34"}
            />
            {[0.45, 1.05, 1.65]
              .filter((y) => y < building.height - 0.3)
              .map((y) => (
                <Block
                  key={y}
                  position={[0.17, y, 0.05]}
                  scale={[0.07, 0.018, 0.02]}
                  color="#929c85"
                  emissive="#d8c7a2"
                  emissiveIntensity={0.15}
                />
              ))}
          </group>
        ))}
      </group>
      <Block
        position={[0, 1.1, 0.12]}
        scale={[23, 2.2, 0.12]}
        color="#1e2d32"
        roughness={0.08}
        metalness={0.25}
      />
      {[-11.4, -3.8, 3.8, 11.4].map((x) => (
        <Block
          key={x}
          position={[x, 4.2, 0.16]}
          scale={[0.09, 8.4, 0.15]}
          color="#333b37"
        />
      ))}
    </group>
  );
}

function LoungeSeat({ side }: { side: number }) {
  return (
    <group position={[side * 5.4, 0, 2.8]} rotation={[0, side * -0.22, 0]}>
      <ContactShadow width={6.6} depth={4.4} opacity={0.3} />
      <Block
        position={[0, 0.29, 0]}
        scale={[3.72, 0.24, 1.6]}
        color="#232824"
        roughness={0.8}
      />
      <RoundedBox
        args={[3.56, 0.37, 1.56]}
        radius={0.13}
        smoothness={2}
        position={[0, 0.53, -0.03]}
        castShadow
      >
        <meshStandardMaterial color="#54584e" roughness={0.95} />
      </RoundedBox>
      <RoundedBox
        args={[3.6, 0.89, 0.36]}
        radius={0.14}
        smoothness={2}
        position={[0, 0.99, 0.62]}
        rotation={[0.11, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color="#5c6055" roughness={0.94} />
      </RoundedBox>
      {[-1.78, 1.78].map((x) => (
        <group key={x}>
          <RoundedBox
            args={[0.28, 0.52, 1.62]}
            radius={0.095}
            smoothness={2}
            position={[x, 0.73, 0]}
          >
            <meshStandardMaterial color="#484d43" roughness={0.94} />
          </RoundedBox>
          {[-0.55, 0.55].map((z) => (
            <mesh key={z} position={[x * 0.92, 0.13, z]}>
              <cylinderGeometry args={[0.035, 0.035, 0.25, 8]} />
              <meshStandardMaterial
                color="#161e1d"
                roughness={0.36}
                metalness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default function ListeningRoom() {
  const tracks = useLibraryStore((s) => s.music);
  const currentId = useAudioStore((s) => s.currentId);
  const playing = useAudioStore((s) => s.playing);
  const track = tracks.find((item) => item.id === currentId) || tracks[0];
  const artwork = useRef<Group>(null);
  const light = useRef<import("three").PointLight>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const texture = useImageTexture(track?.displayCover || track?.cover);
  const tint = useMemo(() => sampledColor(texture, "#b8cbc7"), [texture]);
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);
  useFrame(({ clock }, delta) => {
    const response = useAudioStore.getState().energy;
    if (artwork.current)
      artwork.current.position.y +=
        ((playing ? 0.6 : 0) - artwork.current.position.y) *
        Math.min(delta * (reducedMotion ? 20 : 0.8), 1);
    if (light.current) {
      light.current.color.lerp(tint, Math.min(delta * 0.45, 1));
      light.current.intensity +=
        ((playing ? 34 : 16) + response * 5 - light.current.intensity) *
        Math.min(delta * 2, 1);
    }
    if (material.current) {
      material.current.color.lerp(tint, Math.min(delta * 0.4, 1));
      material.current.emissiveIntensity =
        0.09 +
        response * 0.06 +
        (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.25) * 0.01);
    }
  });
  return (
    <group>
      <RoomShell width={28} depth={34} height={8.8} dark warm />
      <Label
        text="THE LISTENING ROOM"
        position={[0, 7.2, -16.52]}
        size={0.58}
        color="#bac9c4"
      />
      <Label
        text="A PRIVATE PLACE FOR SOUND."
        position={[0, 6.45, -16.51]}
        size={0.2}
        color="#647f7c"
      />
      <group ref={artwork}>
        <Block
          position={[0, 4, -15.8]}
          scale={[4.95, 4.95, 0.17]}
          color="#222e30"
          roughness={0.2}
          metalness={0.35}
        />
        <Picture
          src={track?.displayCover || track?.cover}
          width={4.7}
          height={4.7}
          position={[0, 4, -15.68]}
          color="#6a959e"
        />
      </group>
      <Label
        text={track?.title || "YOUR COLLECTION STARTS HERE"}
        position={[0, 1.43, -15.68]}
        size={0.24}
        color="#c2d0c8"
        maxWidth={10}
      />
      <Label
        text={
          track
            ? `${track.artist}  /  ${track.album}`
            : "Import a song, or save an official share link."
        }
        position={[0, 0.94, -15.68]}
        size={0.14}
        color="#768d86"
        maxWidth={10}
      />
      <Turntable />
      <Speaker x={-5.2} />
      <Speaker x={5.2} />
      <NightWindow />
      {/* Dark walnut slats, shadow gaps, and a recessed record archive. */}
      {Array.from({ length: 20 }, (_, i) => (
        <Block
          key={i}
          position={[-13.52, 3.35, -13 + i * 1.36]}
          scale={[0.17, 6.7, 0.42]}
          color={i % 2 ? "#373932" : "#424239"}
          roughness={0.82}
        />
      ))}
      <group position={[-10.2, 0, -5]} rotation={[0, Math.PI / 2, 0]}>
        <Block
          position={[0, 1.8, 0]}
          scale={[7.6, 3.6, 0.55]}
          color="#393b31"
        />
        {[0.2, 1.35, 2.65, 3.65].map((y) => (
          <Block
            key={y}
            position={[0, y, 0.4]}
            scale={[7.7, 0.07, 0.65]}
            color="#686753"
          />
        ))}
        {tracks.slice(0, 6).map((item, i) => (
          <group
            key={item.id}
            position={[-2.9 + i * 1.15, 2.06, 0.43]}
            onClick={(event) => {
              if (event.delta < 5) {
                event.stopPropagation();
                void useAudioStore.getState().play(item.id);
              }
            }}
          >
            <Block scale={[1.05, 1.05, 0.06]} color="#1c2b2c" />
            <Picture
              src={item.displayCover || item.cover}
              width={0.99}
              height={0.99}
              position={[0, 0, 0.037]}
              color="#91a8a7"
            />
          </group>
        ))}
      </group>
      {[-1, 1].map((side) => (
        <LoungeSeat key={side} side={side} />
      ))}
      <ContactShadow
        position={[0, 0.015, 2.4]}
        width={4.9}
        depth={4.9}
        opacity={0.24}
      />
      <mesh position={[0, 0.35, 2.4]}>
        <cylinderGeometry args={[1.25, 1.15, 0.7, 48]} />
        <meshStandardMaterial
          color="#323b36"
          roughness={0.45}
          metalness={0.14}
        />
      </mesh>
      <mesh position={[0, 7.92, -5.8]}>
        <cylinderGeometry args={[0.36, 0.76, 0.38, 40]} />
        <meshStandardMaterial
          color="#b8aa91"
          metalness={0.6}
          roughness={0.27}
        />
      </mesh>
      <mesh position={[0, 7.725, -5.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.65, 32]} />
        <meshBasicMaterial color="#ffedce" />
      </mesh>
      <Block
        position={[0, 8.63, -5.8]}
        scale={[0.018, 0.58, 0.018]}
        color="#bfc9b7"
      />
      <mesh position={[0, 0.012, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 19]} />
        <meshStandardMaterial
          ref={material}
          color="#94a9a4"
          roughness={0.6}
          transparent
          opacity={0.055}
          emissive="#a4c7c7"
          emissiveIntensity={0.1}
        />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 4.2, -10]}
        intensity={16}
        color="#b8cbc7"
        distance={23}
        decay={2}
      />
      <spotLight
        position={[0, 7.9, -5.8]}
        target-position={[0, 0, -5.8]}
        angle={0.66}
        penumbra={1}
        intensity={150}
        distance={17}
        color="#f5ddb5"
      />
      <Door
        id="atrium"
        title="The Atrium"
        number="01"
        position={[8.8, 0, 15.6]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group>
  );
}
