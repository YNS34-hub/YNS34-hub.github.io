import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Object3D, Vector3, MeshBasicMaterial } from "three";
import {
  ContactShadow,
  Door,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import { GlassSculpture } from "../world/GlassSculpture";
import { usePalaceStore } from "../systems/store";
import { useLibraryStore } from "../systems/library";
import { projects } from "../content/catalog";
import { VisualWall } from "./PersonalRooms";
import { AtriumSurfaces, EntryBlock as Block, useEntrySurfaces } from "./atrium/surfaces";
import AtriumAtmosphere from "./atrium/environment";
import EntryFloor from "./atrium/EntryFloor";
import { EntryCameraReveal, OpticalCore } from "./atrium/optics";
import { entryScreens } from "./atrium/exhibits";
import AtriumSkylight from "./atrium/AtriumSkylight";
import RearDaylight from "./atrium/RearDaylight";
import "./atrium/presentation.css";

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
  const surfaces = useEntrySurfaces();
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
      <mesh position={[0, 0.16, 0]} material={surfaces.get("#849099", .52, .04, 1)} receiveShadow>
        <cylinderGeometry args={[3.5, 3.56, 0.3, 80]} />
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
          <OpticalCore><GlassSculpture radius={2.7} /></OpticalCore>
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
  const coreLightTarget = useMemo(() => { const target = new Object3D(); target.position.set(0, 3.7, 0); return target; }, []);
  return (
    <AtriumSurfaces><group>
      <AtriumAtmosphere />
      <EntryCameraReveal />
      <EntryFloor />
      <Block position={[0, -0.22, 0]} scale={[42, 0.38, 54]} color="#b1c7d1" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 7.3, 2.8, 21]}
            scale={[7.4, 5.6, 12]}
            color="#0b1d31"
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
            color="#dcded5"
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
        color="#101e30"
        castShadow
      />
      <Block
        position={[0, 5.05, 15.2]}
        scale={[7.1, 0.055, 0.32]}
        color="#d7eefd"
        emissive="#cae5f5"
        emissiveIntensity={0.4}
      />
      <RearDaylight />
      <Label
        text="THE MEMORY PALACE"
        position={[-11.9, 13.45, -24.94]}
        size={0.42}
        color="#d7d6cc"
        maxWidth={15}
      />
      <Label
        text="JIE TIAN / COLLECTED WORLDS"
        position={[10.8, 13.45, -24.94]}
        size={0.16}
        color="#bcb6a7"
        maxWidth={12}
      />
      {[-1, 1].map((side) => (
        <Block
          key={side}
          position={[side * 4.5, 5.3, -24.5]}
          scale={[1, 10.6, 2.2]}
            color="#e6f0f7"
          castShadow
        />
      ))}
      <Block
        position={[0, 10.55, -24.5]}
        scale={[10, 0.8, 2.2]}
        color="#e6f0f7"
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
      <AtriumSkylight />
      <Core />
      {entryScreens.map(screen=><group key={`screen-support-${screen.x}`} position={[screen.x,0,screen.z]} rotation={[0,screen.yaw,0]}>
        {[-2.6,2.6].map(offset=><Block key={offset} position={[offset,screen.height/2,0]} scale={[.22,screen.height,.33]} color="#8797a2" roughness={.24} metalness={.75} castShadow />)}
      </group>)}
      {hero && (
        <group
          position={[entryScreens[0].x, 4.2, entryScreens[0].z]}
          rotation={[0, entryScreens[0].yaw, 0]}
          onClick={(e) => {
            e.stopPropagation();
            usePalaceStore.getState().focusItem(hero);
          }}
        >
          <Block scale={[8, 4.6, 0.25]} color="#11243a" />
          <Picture
            src={hero.cover}
            width={7.7}
            height={4.33}
            position={[0, 0, 0.2]}
          />
          <Label
            text={hero.title.toUpperCase()}
            position={[-3.75, -2.65, 0.2]}
            align="left"
            size={0.18}
            color="#c0cdd5"
          />
        </group>
      )}
      {images[0] && (
        <VisualWall
          item={images[0]}
          position={[entryScreens[1].x, 4.2, entryScreens[1].z]}
          width={8}
          height={4.5}
          rotation={[0, entryScreens[1].yaw, 0]}
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
        target={coreLightTarget}
        intensity={220}
        angle={0.47}
        penumbra={0.8}
        distance={28}
        color="#ddf4ff"
      />
      <primitive object={coreLightTarget} />
      <pointLight
        position={[7, 5, -3]}
        intensity={16}
        distance={14}
        color="#dee9e4"
      />
      {[
        ["projects", "Project Gallery", -1, -12],
        ["research", "Research Vault", 1, -12],
        ["music", "Listening Room", -1, 3],
        ["private-gym", "私人健身房", -1, -4.5],
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
          dark
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
    </group></AtriumSurfaces>
  );
}
