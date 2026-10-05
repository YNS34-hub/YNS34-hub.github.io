import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Group } from "three";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import type { WallpaperItem } from "../content/types";
import {
  Block,
  Door,
  Floor,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import { RoomShell } from "./Architecture";
import { sampledColor } from "./ListeningRoom";

function FramedWork({ item, index }: { item: WallpaperItem; index: number }) {
  const side = index % 2 ? 1 : -1;
  const enter = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    usePalaceStore.getState().update({ cinemaImage: item });
    usePalaceStore.getState().enterRoom("cinema");
  };
  return (
    <group
      position={[side * 11.2, 0, 7.6 - Math.floor(index / 2) * 9.1]}
      rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
      onClick={enter}
    >
      <Block
        position={[0, 3.5, -0.1]}
        scale={[7.6, 5.3, 0.19]}
        color="#faf9f2"
        roughness={0.9}
      />
      <Block
        position={[0, 3.5, -0.005]}
        scale={[7.15, 4.8, 0.045]}
        color="#617b80"
        roughness={0.3}
        metalness={0.2}
      />
      <Picture
        src={item.displaySrc || item.src}
        width={7.07}
        height={4.7}
        position={[0, 3.5, 0.022]}
      />
      <Label
        text={`${String(index + 1).padStart(2, "0")}   /   ${item.title.toUpperCase()}`}
        position={[0, 0.75, 0.035]}
        size={0.18}
        color="#42605f"
      />
      <Label
        text="ENTER THIS IMAGE  →"
        position={[0, 0.4, 0.035]}
        size={0.11}
        color="#7a8b85"
      />
    </group>
  );
}

export function WallpaperGallery({ roomId }: { roomId: string }) {
  const images = useLibraryStore((s) => s.wallpapers);
  const page = Math.min(
    Math.max(0, (Number(roomId.split("-page-")[1]) || 1) - 1),
    Math.max(0, Math.ceil(images.length / 6) - 1),
  );
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);
  return (
    <group>
      <RoomShell width={28} depth={36} height={10.8} warm />
      <Label
        text="IMAGES TO INHABIT"
        position={[0, 7.1, -17.6]}
        size={0.58}
        color="#344d4c"
      />
      <Label
        text="04 / THE VISUAL ARCHIVE       A COLLECTION OF OTHER HORIZONS."
        position={[0, 6.24, -17.58]}
        size={0.17}
        color="#728b84"
      />
      {images.slice(page * 6, page * 6 + 6).map((item, index) => (
        <FramedWork key={item.id} item={item} index={index} />
      ))}
      <Block
        position={[0, 0.28, -1]}
        scale={[4.8, 0.56, 1.5]}
        color="#adb6ad"
        roughness={0.8}
      />
      <Label
        text="STAND STILL. LET A WORLD FIND YOU."
        position={[0, 0.015, 4]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.17}
        color="#5e7471"
      />
      {page > 0 && (
        <Door
          id={page === 1 ? "wallpapers" : `wallpapers-page-${page}`}
          title="Previous Collection"
          position={[-9, 0, -16.6]}
        />
      )}
      {(page + 1) * 6 < images.length && (
        <Door
          id={`wallpapers-page-${page + 2}`}
          title="More Images"
          position={[9, 0, -16.6]}
        />
      )}
      <Door
        id="atrium"
        title="The Atrium"
        number="01"
        position={[9, 0, 16.5]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  );
}

export function WallpaperCinema() {
  const images = useLibraryStore((s) => s.wallpapers);
  const selected = usePalaceStore((s) => s.cinemaImage);
  const image = selected || images[0];
  const projection = useRef<Group>(null);
  const light = useRef<import("three").PointLight>(null);
  const elapsed = useRef(0);
  const texture = useImageTexture(image?.displaySrc || image?.src);
  const tint = useMemo(() => sampledColor(texture, "#95b5c3"), [texture]);
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  useFrame(({ camera }, delta) => {
    elapsed.current += Math.min(delta, 0.05);
    const reveal = reducedMotion ? 1 : 1 - Math.exp(-elapsed.current * 0.44);
    if (projection.current) {
      projection.current.scale.setScalar(0.28 + reveal * 0.72);
      projection.current.position.x = camera.position.x * -0.14;
      projection.current.position.y = 0;
    }
    if (light.current) {
      light.current.color.lerp(tint, Math.min(delta * 0.5, 1));
      light.current.intensity = 27 + reveal * 38;
    }
  });
  return (
    <group>
      <Floor width={48} depth={38} color="#172830" />
      {/* The image grows past the architecture; only a quiet threshold remains. */}
      <group ref={projection}>
        <Picture
          src={image?.displaySrc || image?.src}
          width={53}
          height={33}
          position={[0, 18, -18]}
        />
        <group position={[0, -0.065, -17.8]} scale={[1, -0.63, 1]}>
          <mesh position={[0, -4, 0.01]}>
            <planeGeometry args={[49, 24]} />
            <meshBasicMaterial
              map={texture}
              color="#8da6a9"
              transparent
              opacity={0.12}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 14.2, 5.4, 4]}
            scale={[0.26, 10.8, 30]}
            color="#24383d"
            opacity={0.36}
          />
          <Block
            position={[side * 14.05, 0.04, 4]}
            scale={[0.015, 0.026, 30]}
            color="#9cbecb"
            emissive="#7193a0"
            emissiveIntensity={0.3}
          />
        </group>
      ))}
      <pointLight
        ref={light}
        position={[0, 7, -10]}
        color="#95b5c3"
        intensity={27}
        distance={50}
        decay={2}
      />
      <Label
        text={image?.title.toUpperCase() || "WALLPAPER CINEMA"}
        position={[0, 0.02, 7]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.23}
        color="#9dbac2"
      />
      <Label
        text="AN IMAGE BECOMES A PLACE."
        position={[0, 0.02, 8]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.11}
        color="#647f8a"
      />
      <Door
        id="wallpapers"
        title="The Visual Archive"
        number="05"
        position={[10.4, 0, 16]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group>
  );
}
