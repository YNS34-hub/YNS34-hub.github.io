import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
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
import { sampledColor } from "../world/imageColor";
import ProjectionReveal from "../motion/ProjectionReveal";
import { imageTransition } from "../motion/choreography";

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
  const images = useLibraryStore((s) => s.wallpapers),
    selected = usePalaceStore((s) => s.cinemaImage);
  const image = selected || images[0];
  const previousImage = useRef<WallpaperItem | undefined>(undefined);
  const transition = useMemo(() => image ? imageTransition(previousImage.current, image) : "room-tone", [image]);
  useEffect(() => { previousImage.current = image; }, [image]);
  const texture = useImageTexture(image?.displaySrc || image?.src),
    tint = useMemo(() => sampledColor(texture, "#95b5c3"), [texture]);
  const light = useRef<import("three").PointLight>(null);
  useFrame((_, dt) => {
    if (light.current) light.current.color.lerp(tint, 1 - Math.exp(-dt / 2.2));
  });
  return (
    <group>
      <Floor width={42} depth={38} color="#14253a" />
      <Block position={[0, 6.5, -16]} scale={[34, 13, 0.65]} color="#07172b" />
      <Block
        position={[0, 5.6, -14.2]}
        scale={[27.6, 11.2, 0.3]}
        color="#0b1a2c"
        metalness={0.5}
        roughness={0.3}
      />
      <ProjectionReveal resourceKey={texture?.uuid || "loading"} ready={!!texture} variant={transition}>
        <Picture
          texture={texture}
          width={27}
          height={10.8}
          position={[0, 5.6, -13.98]}
          medium="projection"
        />
      </ProjectionReveal>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * 15, 4.6, -2]}
            scale={[1.2, 9.2, 27]}
            color="#1b3247"
          />
          <Block
            position={[side * 10.8, 5.8, 10]}
            scale={[2.8, 11.6, 1.1]}
            color="#0e2339"
          />
          <Block
            position={[side * 14.3, 0.04, -2]}
            scale={[0.06, 0.03, 28]}
            color="#8cbbc9"
            emissive="#8cbbc9"
            emissiveIntensity={0.2}
          />
        </group>
      ))}
      <Block position={[0, 11.1, -6]} scale={[29, 0.5, 20]} color="#0c2035" />
      <pointLight
        ref={light}
        position={[0, 4, -10]}
        intensity={45}
        distance={30}
      />
    </group>
  );
}
