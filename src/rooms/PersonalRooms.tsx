import { useEffect, useRef, useId } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, Vector3 } from "three";
import { imageAtmospheres } from "../world/imageAtmosphere";
import type { ContentItem, WallpaperItem } from "../content/types";
import { projects, research, experiments } from "../content/catalog";
import {
  Block,
  Door,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import {
  RoomShell,
  ProjectArchitecture,
  ResearchArchitecture,
} from "./Architecture";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { worksForRoom } from "../systems/mediaPlacement";
import WorkAttention from "../motion/WorkAttention";
import PosterCaption from "../motion/PosterCaption";
import { useInteractable } from "../interaction/useInteractable";
import { acknowledge } from "../interaction/registry";

function Heading({
  title,
  subtitle,
  color = "#d5e5ef",
}: {
  title: string;
  subtitle: string;
  color?: string;
}) {
  return (
    <group position={[-10.7, 8.7, -16.45]}>
      <Label
        text={title}
        align="left"
        size={0.64}
        color={color}
        maxWidth={24}
      />
      <Label
        text={subtitle}
        align="left"
        position={[0, -0.86, 0]}
        size={0.16}
        color="#92a9b5"
        maxWidth={23}
      />
    </group>
  );
}
function Exit() {
  return (
    <Door
      id="atrium"
      title="The Atrium"
      position={[10, 0, 14.6]}
      rotation={[0, Math.PI, 0]}
      dark
    />
  );
}
export function ProjectScreen({
  item,
  position,
  width = 12,
  height = 6.75,
  rotation = [0, 0, 0],
  medium = "screen",
  tint = "#497cb0",
}: {
  item: ContentItem;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  tint?: string;
  medium?: "screen" | "print" | "projection";
}) {
  const hovered = useRef(false);
  const frame = useRef<Group>(null);
  const open = () => {
    acknowledge("Opening " + item.title);
    usePalaceStore.getState().focusItem(item);
  };
  const attention = useInteractable(frame, { title: item.title, hint: "View project", radius: 13, activate: open });
  return (
    <group
      ref={frame}
      name={`project:${item.id}`}
      position={position}
      rotation={rotation}
      onPointerOver={() => { hovered.current = true; }}
      onPointerOut={() => { hovered.current = false; }}
      onClick={(e) => {
        if (e.delta < 5) {
          e.stopPropagation();
          open();
        }
      }}
    >
      <Block
        scale={[width + 0.2, height + 0.2, 0.18]}
        color="#0c1723"
        metalness={0.7}
        roughness={0.2}
      />
      <Picture
        src={item.cover}
        medium={medium}
        width={width}
        height={height}
        position={[0, 0, 0.12]}
      />
      <WorkAttention width={width} height={height} hovered={hovered} warm={medium === "print"} attention={attention} />
      <Block
        position={[0, -height / 2 - 0.1, 0]}
        scale={[width, 0.035, 0.22]}
        color={tint}
        emissive={tint}
        emissiveIntensity={0.9}
      />
      <Label
        text={item.title.toUpperCase()}
        position={[-width / 2, -height / 2 - 0.5, 0.2]}
        align="left"
        size={0.2}
        color="#d7e7ee"
      />
      <Label
        text={item.status}
        position={[-width / 2, -height / 2 - 0.83, 0.2]}
        align="left"
        size={0.11}
        color="#90a6b5"
      />
    </group>
  );
}
export function PersonalProjects() {
  const personal = worksForRoom(
    useLibraryStore((s) => s.personal.projects),
    "projects",
  );
  const room = usePalaceStore((s) => s.roomId);
  if (room.includes("-page-"))
    return (
      <MediaWing
        images={personal.slice(2)}
        base="projects"
        title="WORKS / PERSONAL STUDIES"
        palette="projects"
      />
    );
  const works = projects.filter((p) => p.id !== "the-memory-palace");
  const hero = works.find((p) => p.id === "big-mouth-burger") || works[0];
  return (
    <group>
      <ProjectArchitecture />
      <Heading
        title="WORKS I HAVE BUILT"
        subtitle="JIE TIAN / ORIGINAL WORLDS, CODE AND VISUAL EXPERIMENTS"
      />
      {hero && (
        <ProjectScreen
          item={hero}
          position={[-2.5, 4.8, -8]}
          width={15.5}
          height={8.4}
        />
      )}
      {works
        .filter((w) => w !== hero)
        .map((work, i) => (
          <ProjectScreen
            key={work.id}
            item={work}
            position={
              i === 0
                ? [10.3, 3.8, 0.3]
                : i === 1
                  ? [-10.6, 4.6, 4]
                  : [7.2, 4.6, -13.8]
            }
            width={i === 1 ? 5.4 : 6.8}
            height={i === 1 ? 7.6 : 4.2}
            rotation={[0, i === 0 ? -0.9 : i === 1 ? 0.85 : -0.15, 0]}
            tint={i === 0 ? "#ca7546" : "#477ac6"}
          />
        ))}
      {[-7.6, 2.6].map((x) => (
        <Block
          key={x}
          position={[x, 8.9, -8]}
          scale={[0.035, 4.3, 0.035]}
          color="#8c9caa"
          metalness={0.8}
        />
      ))}
      <Block
        position={[-2.5, 0.13, -8]}
        scale={[16, 0.26, 2.2]}
        color="#1e2a3c"
        roughness={0.2}
      />
      <pointLight
        position={[6, 6, -1]}
        color="#ffab6d"
        intensity={65}
        distance={22}
      />
      <pointLight
        position={[-8, 5, 3]}
        color="#416fb5"
        intensity={90}
        distance={26}
      />
      {personal.slice(0, 2).map((work, i) => (
        <VisualWall
          key={work.id}
          item={work}
          position={[-7 + i * 14, 4, -15.8]}
          width={6.5}
          height={4}
        />
      ))}
      <ProjectScreen
        item={projects.find((p) => p.id === "the-memory-palace")!}
        position={[-12.3, 4.5, -5]}
        rotation={[0, Math.PI / 2, 0]}
        width={8}
        height={4.7}
      />
      <ProjectScreen
        item={experiments.find((p) => p.id === "nonlinear-glass-study")!}
        position={[11.8, 4.3, 8]}
        rotation={[0, -Math.PI / 2, 0]}
        width={6}
        height={5.6}
        tint="#86c4cf"
      />
      {personal.length > 2 && (
        <Door
          id="projects-page-2"
          title="Personal project studies"
          position={[0, 0, -16.5]}
          dark
        />
      )}
      <Exit />
    </group>
  );
}
export function PersonalResearch() {
  const personal = worksForRoom(
    useLibraryStore((s) => s.personal.research),
    "research",
  );
  const object = useRef<Group>(null);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (object.current && !reduced)
      object.current.rotation.y += Math.min(dt, 0.05) * 0.035;
  });
  const audit = research.find((x) => x.id === "reviewer-first-audit");
  const room = usePalaceStore((s) => s.roomId);
  if (room.includes("-page-"))
    return (
      <MediaWing
        images={personal.slice(2)}
        base="research"
        title="RESEARCH / PERSONAL VISUAL NOTES"
        palette="research"
      />
    );
  return (
    <group>
      <ResearchArchitecture />
      <Heading
        title="RESEARCH VAULT"
        subtitle="NONLINEAR ANALYSIS / EVIDENCE / HUMAN JUDGMENT"
      />
      <group position={[-3.4, 4, -4]} ref={object}>
        {Array.from({ length: 13 }, (_, i) => (
          <mesh
            key={i}
            position={[0, (i - 6) * 0.27, 0]}
            rotation={[Math.PI / 2, 0, i * 0.09]}
          >
            <torusGeometry
              args={[
                Math.sqrt(1 - Math.pow((i - 6) / 7, 2)) * 2.85,
                0.027,
                8,
                96,
              ]}
            />
            <meshStandardMaterial
              color="#91c7e4"
              emissive="#39799b"
              emissiveIntensity={0.6}
              metalness={0.45}
              roughness={0.25}
            />
          </mesh>
        ))}
        <mesh rotation={[0.4, 0.3, 0.1]}>
          <torusKnotGeometry args={[1.4, 0.09, 160, 12, 2, 3]} />
          <meshPhysicalMaterial
            color="#a4e5ff"
            transmission={0.7}
            roughness={0.12}
            thickness={0.7}
          />
        </mesh>
      </group>
      <Block
        position={[-3.4, 0.2, -4]}
        scale={[7, 0.4, 7]}
        color="#112a3a"
        metalness={0.55}
        roughness={0.23}
      />
      <Label
        text="−div(a(x,u,∇u)) = H(x,u,∇u)"
        position={[-3, 6.6, -14.8]}
        size={0.5}
        color="#d0e8f4"
      />
      <Label
        text="ORLICZ GROWTH · REARRANGEMENT · COMPARISON"
        position={[-3, 5.7, -14.8]}
        size={0.18}
        color="#759cb1"
      />
      {audit && (
        <ProjectScreen
          item={audit}
          position={[8, 4, -7]}
          width={8.4}
          height={5.2}
          rotation={[0, -0.25, 0]}
        />
      )}
      {research
        .filter((w) => w !== audit)
        .slice(0, 3)
        .map((work, i) => (
          <group
            key={work.id}
            position={[-11.5, 2.2, 6 - i * 6]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => {
              e.stopPropagation();
              usePalaceStore.getState().focusItem(work);
            }}
          >
            <Label
              text={work.title.toUpperCase()}
              size={0.23}
              color="#b8d4e5"
              maxWidth={6}
            />
            <Label
              text={work.equation || work.subtitle}
              position={[0, -0.6, 0]}
              size={0.18}
              color="#749ab3"
              maxWidth={6}
            />
          </group>
        ))}
      <pointLight
        position={[-3, 6, -4]}
        intensity={75}
        distance={22}
        color="#6eabc9"
      />
      {personal.slice(0, 2).map((work, i) => (
        <VisualWall
          key={work.id}
          item={work}
          position={[11.5, 4, 5 - i * 8]}
          rotation={[0, -Math.PI / 2, 0]}
          width={7}
          height={5}
        />
      ))}
      {personal.length > 2 && (
        <Door
          id="research-page-2"
          title="More research studies"
          position={[0, 0, -16.5]}
          dark
        />
      )}
      <Exit />
    </group>
  );
}
export function VisualWall({
  item,
  position,
  width = 16,
  height = 9,
  rotation = [0, 0, 0],
  medium = "screen",
  atmosphere = true,
}: {
  item: WallpaperItem;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  medium?: "screen" | "print" | "projection";
  atmosphere?: boolean;
}) {
  const texture = useImageTexture(item.displaySrc || item.src);
  const atmosphereId = useId();
  const frame = useRef<Group>(null);
  const hovered = useRef(false);
  const open = () => {
    acknowledge("Viewing " + item.title);
    usePalaceStore.getState().openCinema(item);
  };
  const collect = async () => {
    try {
      await useLibraryStore.getState().favoriteWallpaper(item.id);
      const library = useLibraryStore.getState();
      const saved = [...library.wallpapers, ...library.personal.visuals, ...library.personal.projects, ...library.personal.research].find(work => work.id === item.id)?.favorite;
      acknowledge(saved ? "Kept in My Collection" : "Released from My Collection");
    } catch { acknowledge("Could not save. Try again."); }
  };
  const attention = useInteractable(frame, { title: item.title, hint: "View image", radius: 12, activate: open, secondary: () => { void collect(); } });
  const tint = useRef(new Color(item.color || "#679ac3"));
  useEffect(() => {
    if (frame.current && atmosphere && medium !== "print") {
      frame.current.updateWorldMatrix(true, false);
      imageAtmospheres.set(atmosphereId, {
        position: frame.current.getWorldPosition(new Vector3()),
        color: tint.current,
      });
    }
    return () => {
      imageAtmospheres.delete(atmosphereId);
    };
  }, [item.id, atmosphereId, atmosphere, medium]);
  useEffect(() => {
    if (texture?.image && !item.color) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(texture.image, 0, 0, 1, 1);
        const p = ctx.getImageData(0, 0, 1, 1).data;
        tint.current
          .setRGB(p[0] / 255, p[1] / 255, p[2] / 255)
          .convertSRGBToLinear();
      } catch {
        /* Neutral color for non-CORS images. */
      }
    }
  }, [texture, item.color]);
  const worldPosition = useRef(new Vector3());
  useFrame(() => {
    if (frame.current && atmosphere) {
      frame.current.getWorldPosition(worldPosition.current);
      imageAtmospheres.get(atmosphereId)?.position.copy(worldPosition.current);
    }
  });
  const aspect = texture?.image
    ? texture.image.width / texture.image.height
    : item.width && item.height
      ? item.width / item.height
      : width / height;
  const actualWidth = Math.min(width, height * aspect),
    actualHeight = actualWidth / aspect;
  return (
    <group
      ref={frame}
      name={`work:${item.id}`}
      userData={{ resourceId: item.id, medium }}
      position={position}
      rotation={rotation}
      onPointerOver={() => { hovered.current = true; }}
      onPointerOut={() => { hovered.current = false; }}
      onClick={(e) => {
        if (e.delta < 5) {
          e.stopPropagation();
          open();
        }
      }}
    >
      <Block
        scale={[actualWidth + 0.16, actualHeight + 0.16, 0.24]}
        color="#12212b"
        metalness={0.6}
      />
      <Picture
        texture={texture}
        medium={medium}
        width={actualWidth}
        height={actualHeight}
        position={[0, 0, 0.135]}
      />
      <WorkAttention width={actualWidth} height={actualHeight} hovered={hovered} warm={medium === "print"} attention={attention} />
      <PosterCaption enabled={item.category === "editorial"} width={actualWidth} height={actualHeight} hovered={hovered} attention={attention}>
      <Label
        text={item.title.toUpperCase()}
        align="left"
        position={[-actualWidth / 2, -actualHeight / 2 - 0.34, 0.14]}
        size={0.18}
        color="#b4cbd5"
      />
      <Label
        text={`${item.date} / ${item.source?.startsWith("http") ? "COLLECTED VISUAL / ORIGINAL CREATOR" : item.source || "PERSONAL COLLECTION"}`}
        align="left"
        position={[-actualWidth / 2, -actualHeight / 2 - 0.63, 0.14]}
        size={0.1}
        color="#8ea7b5"
        maxWidth={width}
      />
      </PosterCaption>
    </group>
  );
}
/** Extra files grow physical wings instead of being silently dropped after the first room. */
function MediaWing({
  images,
  base,
  title,
  palette,
}: {
  images: WallpaperItem[];
  base: string;
  title: string;
  palette: "projects" | "research";
}) {
  const room = usePalaceStore((s) => s.roomId);
  const page = Math.max(0, (Number(room.split("-page-")[1]) || 2) - 2);
  const works = images.slice(page * 5, page * 5 + 5);
  return (
    <group>
      <RoomShell dark palette={palette} width={28} depth={34} height={11} />
      <Heading title={title} subtitle="A COLLECTION THAT GROWS WITH ME" />
      {works[0] && (
        <VisualWall
          item={works[0]}
          position={[0, 5, -12.5]}
          width={21}
          height={10}
        />
      )}
      {works.slice(1).map((work, i) => (
        <VisualWall
          key={work.id}
          item={work}
          position={[i % 2 ? 11.7 : -11.7, 4.6, 5 - Math.floor(i / 2) * 9]}
          width={8}
          height={7.2}
          rotation={[0, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0]}
        />
      ))}
      <Door
        id={page === 0 ? base : `${base}-page-${page + 1}`}
        title="Previous studies"
        position={[-10, 0, 14.6]}
        rotation={[0, Math.PI, 0]}
        dark
      />
      {(page + 1) * 5 < images.length && (
        <Door
          id={`${base}-page-${page + 3}`}
          title="More studies"
          position={[0, 0, -16.5]}
          dark
        />
      )}
      <Exit />
    </group>
  );
}
