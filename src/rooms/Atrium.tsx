import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3, MeshBasicMaterial } from "three";
import {
  Block,
  ContactShadow,
  Door,
  Floor,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import { GlassSculpture } from "../world/GlassSculpture";
import { usePalaceStore } from "../systems/store";
import { useLibraryStore } from "../systems/library";
import { projects } from "../content/catalog";
import { VisualWall } from "./PersonalRooms";

function MemoryReveal() {
  const library = useLibraryStore();
  const viewed = usePalaceStore((s) => s.viewed);
  const collected = [...library.wallpapers, ...library.personal.visuals].filter(
    (x) => x.favorite,
  );
  const recent = projects.filter((x) => viewed.includes(x.id) && x.cover);
  const src =
    collected[0]?.displaySrc ||
    collected[0]?.src ||
    recent[0]?.cover ||
    library.wallpapers[0]?.src;
  const texture = useImageTexture(src);
  const aspect = texture?.image
    ? texture.image.width / texture.image.height
    : 16 / 9;
  const imageWidth = Math.min(5.6, 3.15 * aspect),
    imageHeight = imageWidth / aspect;
  const panels = useRef<Group>(null);
  const age = useRef(0),
    strength = useRef(0);
  const active = usePalaceStore((s) => s.memoryReveal);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (active) {
      age.current += Math.min(dt, 0.1);
      if (age.current > 9)
        usePalaceStore.getState().update({ memoryReveal: false });
    } else age.current = 0;
    strength.current +=
      (Number(active) - strength.current) *
      (reduced ? 1 : 1 - Math.exp(-dt * 2.4));
    panels.current?.traverse((o) => {
      if (
        "material" in o &&
        (o as import("three").Mesh).material instanceof MeshBasicMaterial
      ) {
        const m = (o as import("three").Mesh).material as MeshBasicMaterial;
        m.opacity = strength.current * 0.88;
      }
    });
  });
  return (
    <group ref={panels}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 6.2, 4.4, -2.5]}
          rotation={[0, -side * 0.2, 0]}
        >
          <planeGeometry args={[imageWidth, imageHeight]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.32, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[imageWidth * 1.46, imageHeight * 1.46]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
function Core() {
  const direction = useMemo(() => new Vector3(), []),
    toward = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    camera.getWorldDirection(direction);
    toward.set(0, 3.6, 0).sub(camera.position).normalize();
    const near =
      camera.position.x ** 2 + camera.position.z ** 2 < 100 &&
      direction.dot(toward) > 0.7;
    if (usePalaceStore.getState().coreNear !== near)
      usePalaceStore.getState().update({ coreNear: near });
  });
  return (
    <group>
      <ContactShadow width={9} depth={9} opacity={0.37} />
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[3.5, 3.56, 0.3, 80]} />
        <meshStandardMaterial
          color="#d8eaf0"
          roughness={0.25}
          metalness={0.12}
        />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.7, 3.74, 96]} />
        <meshStandardMaterial color="#486a82" roughness={0.45} />
      </mesh>
      <group
        position={[0, 3.7, 0]}
        onClick={(e) => {
          if (e.delta < 5 && usePalaceStore.getState().coreNear) {
            e.stopPropagation();
            usePalaceStore.getState().update({
              memoryReveal: !usePalaceStore.getState().memoryReveal,
            });
          }
        }}
      >
        <Suspense fallback={null}>
          <GlassSculpture radius={2.7} />
        </Suspense>
      </group>
      <MemoryReveal />
    </group>
  );
}
/** Compression → release → a luminous optical solid against a recessed blue archive. */
export default function Atrium() {
  const images = useLibraryStore((s) => s.wallpapers);
  const hero = projects.find((x) => x.id === "giannis-fansite");
  return (
    <group>
      <Floor width={42} depth={54} color="#bfced5" />
      <Block position={[0, -0.22, 0]} scale={[42, 0.38, 54]} color="#b1c7d1" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 7.3, 2.8, 21]}
            scale={[7.4, 5.6, 12]}
            color="#1d344c"
            castShadow
          />
          <Block
            position={[side * 3.57, 2.65, 17]}
            scale={[0.07, 5.3, 1.8]}
            color="#a8cfe5"
            metalness={0.65}
            roughness={0.2}
          />
          <Block
            position={[side * 20.6, 7, 0]}
            scale={[0.8, 14, 54]}
            color="#e4eff2"
          />
          <Block
            position={[side * 20.12, 0.18, 0]}
            scale={[0.05, 0.12, 52]}
            color="#38596a"
          />
          <Block
            position={[side * 17.6, 13.7, -4]}
            scale={[5.5, 0.7, 44]}
            color="#cbdfe9"
            castShadow
          />
          {[-19, -9, 1, 11].map((z) => (
            <group key={z}>
              <Block
                position={[side * 19.8, 7, z]}
                scale={[1.1, 14, 0.55]}
                color="#d0e4eb"
                castShadow
              />
              <ContactShadow
                position={[side * 19.5, 0.01, z]}
                width={4}
                depth={3}
                opacity={0.2}
              />
            </group>
          ))}
        </group>
      ))}
      <Block
        position={[0, 5.5, 21]}
        scale={[21.5, 0.6, 12]}
        color="#233b54"
        castShadow
      />
      <Block
        position={[0, 5.05, 15.2]}
        scale={[7.1, 0.055, 0.32]}
        color="#d7eefd"
        emissive="#cae5f5"
        emissiveIntensity={0.4}
      />
      <Block
        position={[0, 7.3, -25.5]}
        scale={[42, 14.6, 0.8]}
        color="#2a4864"
      />
      <Block
        position={[-9, 5.4, -24.92]}
        scale={[8.2, 8.8, 0.26]}
        color="#18334b"
        roughness={0.5}
      />
      <Label
        text={"THE MEMORY\nPALACE"}
        position={[-9, 6.1, -24.7]}
        size={0.7}
        color="#dceffc"
        maxWidth={8}
      />
      <Label
        text="JIE TIAN / COLLECTED WORLDS"
        position={[-9, 3.9, -24.7]}
        size={0.16}
        color="#acc9dd"
      />
      {[-1, 1].map((side) => (
        <Block
          key={side}
          position={[side * 4.5, 5.3, -24.5]}
          scale={[1, 10.6, 2.2]}
          color="#bdd8e8"
          castShadow
        />
      ))}
      <Block
        position={[0, 10.55, -24.5]}
        scale={[10, 0.8, 2.2]}
        color="#bdd8e8"
      />
      <group position={[0, 0, -25]}>
        {Array.from({ length: 5 }, (_, i) => (
          <group key={i} position={[0, 0, -2 - i * 3]}>
            <Block
              position={[-3.4, 3.9, 0]}
              scale={[0.25, 7.8, 0.35]}
              color="#557e9b"
            />
            <Block
              position={[3.4, 3.9, 0]}
              scale={[0.25, 7.8, 0.35]}
              color="#557e9b"
            />
            <Block
              position={[0, 7.8, 0]}
              scale={[7, 0.25, 0.35]}
              color="#c4e9f5"
              emissive="#b6ddee"
              emissiveIntensity={0.35}
            />
          </group>
        ))}
        <Door
          id="corridor"
          title="Infinite Corridor"
          position={[0, 0, 0]}
          dark
        />
      </group>
      {[-17, -7, 3].map((z, i) => (
        <group key={z}>
          <Block
            position={[i % 2 ? -2 : 2, 14, -8 + z]}
            scale={[26, 0.55, 5]}
            color="#b7d1df"
            castShadow
          />
          <Block
            position={[0, 14.7, z]}
            scale={[29, 0.04, 4.4]}
            color="#d8f2ff"
            emissive="#e2f4ff"
            emissiveIntensity={0.7}
          />
        </group>
      ))}
      <Core />
      {hero && (
        <group
          position={[-12.2, 4.8, -8.5]}
          rotation={[0, 0.28, 0]}
          onClick={(e) => {
            e.stopPropagation();
            usePalaceStore.getState().focusItem(hero);
          }}
        >
          <Block scale={[9.8, 5.7, 0.35]} color="#11243a" />
          <Picture
            src={hero.cover}
            width={9.5}
            height={5.35}
            position={[0, 0, 0.2]}
          />
          <Label
            text={hero.title.toUpperCase()}
            position={[-4.7, -3.1, 0.2]}
            align="left"
            size={0.22}
            color="#315972"
          />
        </group>
      )}
      {images[0] && (
        <VisualWall
          item={images[0]}
          position={[12.5, 4.6, -10]}
          width={10.2}
          height={5.74}
          rotation={[0, -0.28, 0]}
          atmosphere={false}
        />
      )}
      <Block
        position={[-20, 4.2, 3]}
        scale={[0.12, 7.5, 7]}
        color="#61472f"
        emissive="#ac7447"
        emissiveIntensity={0.1}
      />
      <pointLight
        position={[-17.5, 4.2, 3]}
        color="#edc99d"
        intensity={100}
        distance={16}
      />
      <spotLight
        position={[-6, 12, 7]}
        target-position={[0, 3, 0]}
        intensity={180}
        angle={0.47}
        penumbra={0.8}
        distance={28}
        color="#ddf4ff"
      />
      <pointLight
        position={[7, 5, -3]}
        intensity={35}
        distance={14}
        color="#c0e9ff"
      />
      {[
        ["projects", "Project Gallery", -1, -12],
        ["research", "Research Vault", 1, -12],
        ["music", "Listening Room", -1, 3],
        ["wallpapers", "Wallpaper Vault", 1, 3],
        ["liquid-web", "Liquid Web", -1, 13],
        ["archive", "Archive", 1, 13],
      ].map(([id, title, side, z]) => (
        <Door
          key={id}
          id={String(id)}
          title={String(title)}
          position={[Number(side) * 19.95, 0, Number(z)]}
          rotation={[0, (-Number(side) * Math.PI) / 2, 0]}
        />
      ))}
      <Door
        id="imagined-worlds"
        title="Imagined Worlds"
        position={[14.3, 0, -24.8]}
        dark
      />
      <Door
        id="my-collection"
        title="My Collection"
        position={[-15.3, 0, -24.8]}
        dark
      />
      {[-10, 0, 10].map((x) => (
        <Block
          key={x}
          position={[x, 0.01, -1]}
          scale={[0.009, 0.005, 48]}
          color="#8aa8bc"
        />
      ))}
    </group>
  );
}
