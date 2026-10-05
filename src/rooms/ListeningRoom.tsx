import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, InstancedMesh, Object3D, type Texture } from "three";
import { useLibraryStore } from "../systems/library";
import { useAudioStore } from "../audio/player";
import { usePalaceStore } from "../systems/store";
import {
  Block,
  ContactShadow,
  Door,
  Floor,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import { useSurfaceTexture } from "../world/materials";

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
    color.lerp(new Color("#c5d4d5"), 0.72);
  } catch {
    // A remote cover without CORS can still be shown; its lighting stays neutral.
  }
  return color;
}

/** Deep walnut fins are repeated in two draw calls, rather than individual furniture. */
function AcousticFins({ wood }: { wood: Texture }) {
  const sides = useRef<InstancedMesh>(null);
  const back = useRef<InstancedMesh>(null);
  useEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < 56; i++) {
      dummy.position.set(i < 28 ? -13.25 : 13.25, 4.1, -14.4 + (i % 28) * 1.03);
      dummy.scale.set(0.32, 7.5, 0.18);
      dummy.updateMatrix();
      sides.current?.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < 50; i++) {
      dummy.position.set(-13.25 + i * 0.54, 4.15, -15.52);
      dummy.scale.set(0.075, 7.65, 0.22);
      dummy.updateMatrix();
      back.current?.setMatrixAt(i, dummy.matrix);
    }
    for (const mesh of [sides.current, back.current]) {
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }, []);
  return (
    <>
      <instancedMesh
        ref={sides}
        args={[undefined, undefined, 56]}
        castShadow
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial color="#8a7360" map={wood} roughness={0.72} />
      </instancedMesh>
      <instancedMesh
        ref={back}
        args={[undefined, undefined, 50]}
        castShadow
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial color="#7c6654" map={wood} roughness={0.73} />
      </instancedMesh>
    </>
  );
}

function IntegratedSpeaker({ side, wood }: { side: number; wood: Texture }) {
  return (
    <group position={[side * 6.8, 0, -10.6]}>
      <ContactShadow width={3.4} depth={2.8} opacity={0.4} />
      <Block
        position={[0, 3.15, -0.18]}
        scale={[1.62, 6.3, 0.96]}
        color="#806b59"
        map={wood}
        roughness={0.68}
        castShadow
      />
      <Block
        position={[0, 3.12, 0.32]}
        scale={[1.26, 5.55, 0.12]}
        color="#292d2b"
        roughness={0.91}
      />
      {[1.6, 2.6, 4.35].map((y, i) => (
        <group key={y} position={[0, y, 0.397]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[i === 2 ? 0.18 : 0.43, i === 2 ? 0.18 : 0.43, 0.025, 48]}
            />
            <meshStandardMaterial color="#121716" roughness={0.85} />
          </mesh>
          <mesh>
            <torusGeometry args={[i === 2 ? 0.187 : 0.438, 0.012, 6, 48]} />
            <meshStandardMaterial
              color="#60655e"
              metalness={0.35}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
      <Block
        position={[0, 0.07, 0]}
        scale={[1.84, 0.14, 1.3]}
        color="#3d423d"
        metalness={0.18}
        roughness={0.6}
      />
      <Label
        text={side < 0 ? "L / 01" : "R / 02"}
        position={[0, 0.45, 0.4]}
        size={0.075}
        color="#89918b"
      />
    </group>
  );
}

function ListeningInstallation({ wood }: { wood: Texture }) {
  const vinyl = useRef<Group>(null);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame((_, delta) => {
    if (vinyl.current && useAudioStore.getState().playing && !reduced)
      vinyl.current.rotation.y += Math.min(delta, 0.05) * 0.58;
  });
  return (
    <group
      position={[0, 0, -3.8]}
      onClick={(event) => {
        if (event.delta > 5) return;
        event.stopPropagation();
        usePalaceStore.getState().setOverlay("collection");
      }}
    >
      <ContactShadow width={8} depth={5.2} opacity={0.44} />
      <Block
        position={[0, 0.42, 0]}
        scale={[5.5, 0.74, 2.6]}
        color="#bbb5a8"
        roughness={0.46}
        castShadow
      />
      <Block
        position={[0, 0.055, 0]}
        scale={[5.2, 0.11, 2.3]}
        color="#222a26"
        roughness={0.64}
      />
      <group position={[0, -0.28, 0]}>
        <Block
          position={[0, 1.12, 0]}
          scale={[5.56, 0.12, 2.66]}
          color="#c6c2b5"
          roughness={0.27}
          metalness={0.06}
        />
        <Block
          position={[-0.2, 1.32, -0.05]}
          scale={[3.85, 0.27, 1.94]}
          color="#9b806b"
          map={wood}
          roughness={0.46}
          castShadow
        />
        <Block
          position={[-0.2, 1.47, -0.05]}
          scale={[3.77, 0.035, 1.87]}
          color="#505952"
          roughness={0.4}
          metalness={0.62}
        />
        <group ref={vinyl} position={[-0.66, 1.52, -0.05]}>
          <mesh>
            <cylinderGeometry args={[0.83, 0.83, 0.055, 80]} />
            <meshStandardMaterial
              color="#a7afa7"
              metalness={0.78}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.033, 0]}>
            <cylinderGeometry args={[0.79, 0.79, 0.012, 80]} />
            <meshStandardMaterial
              color="#171d1b"
              roughness={0.29}
              metalness={0.18}
            />
          </mesh>
          {[0.3, 0.41, 0.52, 0.63, 0.74].map((radius) => (
            <mesh
              key={radius}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.042, 0]}
            >
              <torusGeometry args={[radius, 0.0025, 3, 64]} />
              <meshStandardMaterial
                color="#41483f"
                roughness={0.34}
                metalness={0.1}
              />
            </mesh>
          ))}
          <mesh position={[0, 0.044, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.008, 40]} />
            <meshStandardMaterial color="#d7dacb" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.09, 12]} />
            <meshStandardMaterial
              color="#bcc1b6"
              metalness={0.85}
              roughness={0.22}
            />
          </mesh>
        </group>
        <mesh position={[1.02, 1.57, -0.56]}>
          <cylinderGeometry args={[0.12, 0.12, 0.18, 24]} />
          <meshStandardMaterial
            color="#a4afa5"
            metalness={0.7}
            roughness={0.36}
          />
        </mesh>
        <Block
          position={[0.87, 1.69, -0.16]}
          rotation={[0, -0.45, 0]}
          scale={[0.055, 0.04, 0.91]}
          color="#c1c8be"
          metalness={0.82}
          roughness={0.28}
        />
        <Block
          position={[0.66, 1.655, 0.28]}
          scale={[0.13, 0.07, 0.22]}
          color="#242c28"
          roughness={0.6}
        />
      </group>
      <Label
        text="04 / THE LISTENING TABLE"
        position={[-0.65, 0.58, 1.31]}
        size={0.11}
        color="#424c45"
        maxWidth={4}
      />
      <Label
        text="OPEN COLLECTION  ↗"
        position={[-0.88, 0.32, 1.315]}
        size={0.095}
        color="#606a60"
        maxWidth={4}
      />
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
  const texture = useImageTexture(track?.displayCover || track?.cover);
  const artworkHeight = texture?.image
    ? Math.min(6.18, (6.18 * texture.image.height) / texture.image.width)
    : 6.18;
  const tint = useMemo(() => sampledColor(texture, "#d5c6ac"), [texture]);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  const wood = useSurfaceTexture("walnut");
  const quality = usePalaceStore((s) => s.effectiveQuality);
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);
  useFrame((_, delta) => {
    const easing = Math.min(delta * (reduced ? 12 : 0.65), 1);
    if (artwork.current)
      artwork.current.position.y +=
        ((playing ? 0.45 : 0) - artwork.current.position.y) * easing;
    if (light.current) {
      light.current.color.lerp(tint, Math.min(delta * 0.3, 1));
      light.current.intensity +=
        ((playing ? 38 : 24) +
          useAudioStore.getState().energy * 2 -
          light.current.intensity) *
        easing;
    }
  });
  return (
    <group>
      <Floor width={28} depth={34} color="#97988d" />
      <Block
        position={[0, 4.5, -16.2]}
        scale={[28.7, 9, 0.9]}
        color="#514b40"
        map={wood}
        roughness={0.85}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 14, 4.5, 0]}
            scale={[0.8, 9, 34]}
            color="#3c3e36"
            roughness={0.91}
          />
          <Block
            position={[side * 13.48, 4.1, 0]}
            scale={[0.15, 7.8, 30]}
            color="#554a3c"
            map={wood}
            roughness={0.78}
          />
          <Block
            position={[side * 13.51, 0.12, 0]}
            scale={[0.09, 0.1, 33]}
            color="#161c18"
          />
          <Block
            position={[side * 12.9, 8.12, 0]}
            scale={[1.3, 0.18, 32]}
            color="#1b211c"
            roughness={0.88}
          />
          <Block
            position={[side * 12.3, 8.22, 0]}
            scale={[0.045, 0.035, 30]}
            color="#e6d6b7"
            emissive="#ffe1ae"
            emissiveIntensity={0.65}
          />
          <IntegratedSpeaker side={side} wood={wood} />
          <pointLight
            position={[side * 9, 5.2, -12.3]}
            color="#ffdfb8"
            intensity={70}
            distance={16}
            decay={2}
          />
        </group>
      ))}
      <AcousticFins wood={wood} />
      <Block position={[0, 9, 0]} scale={[28, 0.4, 34]} color="#222921" />
      {[-8, -4, 0, 4, 8].map((x) => (
        <group key={x}>
          <Block
            position={[x, 8.47, 0]}
            scale={[2.8, 0.28, 30]}
            color="#383d32"
            roughness={0.97}
            castShadow
          />
          <Block
            position={[x, 8.31, -3.2]}
            scale={[0.035, 0.035, 15]}
            color="#e7ddcb"
            emissive="#f6e0bb"
            emissiveIntensity={0.45}
          />
        </group>
      ))}
      <Label
        text="A ROOM FOR LISTENING"
        position={[-9.8, 6.62, -15.39]}
        size={0.24}
        color="#d5d4c6"
        maxWidth={5}
      />
      <Label
        text="04 / SOUND COLLECTION"
        position={[-9.8, 6.06, -15.38]}
        size={0.1}
        color="#959b8b"
      />
      <Label
        text={playing ? "NOW PLAYING" : "SELECTED RECORD"}
        position={[0, 7.5, -9.66]}
        size={0.105}
        color="#bdc4b8"
      />
      <group ref={artwork}>
        <ContactShadow
          position={[0, 0.025, -9.5]}
          width={8.2}
          depth={3.5}
          opacity={0.24}
        />
        <Block
          position={[0, 4.13, -9.76]}
          scale={[6.3, artworkHeight + 0.12, 0.08]}
          color="#353e32"
          roughness={0.72}
        />
        <Picture
          src={track?.displayCover || track?.cover}
          width={6.18}
          height={6.18}
          position={[0, 4.13, -9.697]}
          color="#7b8d85"
        />
      </group>
      <Label
        text={track?.title || "YOUR COLLECTION STARTS HERE"}
        position={[0, 4.13 - artworkHeight / 2 - 0.5, -9.65]}
        size={0.21}
        color="#d4dace"
        maxWidth={7}
      />
      <Label
        text={
          track
            ? `${track.artist}   /   ${track.album}`
            : "Import a record. Make this space yours."
        }
        position={[0, 4.13 - artworkHeight / 2 - 0.94, -9.64]}
        size={0.115}
        color="#9fa99b"
        maxWidth={8}
      />
      <ListeningInstallation wood={wood} />
      {/* One monolithic listening bench; space is the luxury here. */}
      <ContactShadow
        position={[6.2, 0.018, 4.6]}
        width={5.1}
        depth={2.4}
        opacity={0.38}
      />
      <Block
        position={[6.2, 0.55, 4.6]}
        scale={[4, 0.2, 1.05]}
        color="#b0ae9e"
        roughness={0.86}
        castShadow
      />
      {[4.7, 7.7].map((x) => (
        <Block
          key={x}
          position={[x, 0.26, 4.6]}
          scale={[0.15, 0.45, 0.76]}
          color="#454c42"
          roughness={0.47}
          metalness={0.5}
        />
      ))}
      <group position={[-12.25, 0, -3.5]} rotation={[0, Math.PI / 2, 0]}>
        <Block
          position={[0, 1.17, -0.13]}
          scale={[6.4, 0.12, 0.75]}
          color="#83745b"
          map={wood}
          roughness={0.58}
        />
        <Label
          text="THE RECORD ARCHIVE"
          position={[0, 3.25, 0]}
          size={0.14}
          color="#bdc4b4"
        />
        {tracks.slice(0, 5).map((item, i) => (
          <group
            key={item.id}
            position={[-2.6 + i * 1.3, 1.95, 0]}
            onClick={(event) => {
              if (event.delta < 5) {
                event.stopPropagation();
                void useAudioStore.getState().play(item.id);
              }
            }}
          >
            <Block scale={[1.12, 1.12, 0.055]} color="#202c25" />
            <Picture
              src={item.displayCover || item.cover}
              width={1.08}
              height={1.08}
              position={[0, 0, 0.035]}
            />
          </group>
        ))}
      </group>
      <pointLight
        ref={light}
        position={[0, 5.5, -8]}
        intensity={24}
        color="#d5c6ac"
        distance={18}
        decay={2}
      />
      <spotLight
        position={[-1.5, 7.9, 0]}
        target-position={[0, 0.8, -3.8]}
        color="#ffe2b6"
        intensity={320}
        angle={0.58}
        penumbra={1}
        distance={22}
        castShadow={quality !== "low"}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <pointLight
        position={[0, 5, 9]}
        color="#efe4cb"
        intensity={80}
        distance={22}
        decay={2}
      />
      <Door
        id="atrium"
        title="The Atrium"
        number="01"
        position={[9.1, 0, 15.5]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group>
  );
}
