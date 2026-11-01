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
  elevation = 8.7,
  subtitleColor = "#92a9b5",
  position,
  centered = false,
}: {
  title: string;
  subtitle: string;
  color?: string;
  elevation?: number;
  subtitleColor?: string;
  position?: [number, number, number];
  centered?: boolean;
}) {
  return (
    <group position={position || [-10.7, elevation, -16.45]}>
      <Label
        text={title}
        align={centered ? "center" : "left"}
        size={0.64}
        color={color}
        maxWidth={24}
      />
      <Label
        text={subtitle}
        align={centered ? "center" : "left"}
        position={[0, -0.86, 0]}
        size={0.16}
        color={subtitleColor}
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
  curated = false,
}: {
  item: ContentItem;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  tint?: string;
  medium?: "screen" | "print" | "projection";
  curated?: boolean;
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
        color={curated ? "#202724" : "#0c1723"}
        metalness={curated ? .3 : .7}
        roughness={curated ? .5 : .2}
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
        emissiveIntensity={curated ? .22 : .9}
      />
      {curated && <Block position={[0, -height / 2 - .58, .12]} scale={[Math.min(width, 5.2), .76, .07]} color="#303940" roughness={.64} metalness={.18} />}
      <Label
        text={item.title.toUpperCase()}
        position={[curated ? 0 : -width / 2, -height / 2 - 0.5, 0.2]}
        align={curated ? "center" : "left"}
        size={0.2}
        color={curated ? "#d6dfe3" : "#d7e7ee"}
        maxWidth={curated ? Math.min(width, 5.2) - .36 : undefined}
      />
      <Label
        text={item.status}
        position={[curated ? 0 : -width / 2, -height / 2 - 0.83, 0.2]}
        align={curated ? "center" : "left"}
        size={0.11}
        color={curated ? "#9baeb9" : "#90a6b5"}
        maxWidth={curated ? Math.min(width, 5.2) - .36 : undefined}
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
        elevation={8.95}
        color="#d4d9cd"
        subtitleColor="#adb8aa"
        position={[-2.5, 8.95, -7.8]}
        centered
      />
      {hero && (
        <ProjectScreen
          item={hero}
          position={[-2.5, 4.4, -8]}
          width={11.6}
          height={6.28}
          curated
        />
      )}
      {works
        .filter((w) => w !== hero)
        .map((work, i) => (
          <ProjectScreen
            key={work.id}
            item={work}
            curated
            position={
              i === 0
                ? [10.3, 4.6, 0.3]
                : i === 1
                  ? [-10.6, 4.6, 4]
                  : [7.2, 4.6, -13.8]
            }
            width={i === 1 ? 5.4 : 6.8}
            height={i === 1 ? 6 : 4.2}
            rotation={[0, i === 0 ? -0.9 : i === 1 ? 0.85 : -0.15, 0]}
            tint={i === 0 ? "#ca7546" : "#477ac6"}
          />
        ))}
      {[-7.6, 2.6].map((x) => (
        <Block
          key={x}
          position={[x, 8.65, -8]}
          scale={[0.025, 2.25, 0.025]}
          color="#939b90"
          metalness={0.8}
        />
      ))}
      <Block
        position={[-2.5, 0.13, -8]}
        scale={[16, 0.26, 2.2]}
        color="#353d37"
        roughness={0.72}
      />
      <pointLight
        position={[6, 6, -1]}
        color="#f6dfb8"
        intensity={45}
        distance={22}
      />
      <rectAreaLight position={[0, 10, -1]} rotation={[-Math.PI / 2, 0, 0]} color="#e0e8f0" intensity={1.8} width={5.1} height={27} />
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
        curated
        position={[-12.3, 4.5, -5]}
        rotation={[0, Math.PI / 2, 0]}
        width={8}
        height={4.7}
      />
      <ProjectScreen
        item={experiments.find((p) => p.id === "nonlinear-glass-study")!}
        curated
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
        position={[7.2, 7.6, -16.34]}
        color="#d6e2e6"
        subtitleColor="#a6b9c4"
        centered
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
              color="#c8c9ad"
              emissive="#657269"
              emissiveIntensity={0.1}
              metalness={0.65}
              roughness={0.35}
            />
          </mesh>
        ))}
        <mesh rotation={[0.4, 0.3, 0.1]}>
          <torusKnotGeometry args={[1.4, 0.09, 160, 12, 2, 3]} />
          <meshPhysicalMaterial
            color="#d4e8e2"
            transmission={0.7}
            roughness={0.12}
            thickness={0.7}
          />
        </mesh>
      </group>
      <Block
        position={[-3.4, 0.2, -4]}
        scale={[7, 0.4, 7]}
        color="#363f38"
        metalness={0.12}
        roughness={0.65}
      />
      <Label
        text="−div(a(x,u,∇u)) = H(x,u,∇u)"
        position={[-13.29, 5.3, -2]}
        rotation={[0, Math.PI / 2, 0]}
        size={0.28}
        color="#dce0cb"
      />
      <Label
        text="ORLICZ GROWTH · REARRANGEMENT · COMPARISON"
        position={[-13.29, 4.75, -2]}
        rotation={[0, Math.PI / 2, 0]}
        size={0.14}
        color="#aab9a4"
      />
      {audit && (
        <ProjectScreen
          item={audit}
          curated
          position={[7.6, 4.1, -15.7]}
          width={7.4}
          height={4.55}
          medium="print"
          rotation={[0, 0, 0]}
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
              color="#d0dbc5"
              maxWidth={6}
            />
            <Label
              text={work.equation || work.subtitle}
              position={[0, -0.6, 0]}
              size={0.18}
              color="#a8b79f"
              maxWidth={6}
            />
          </group>
        ))}
      <pointLight
        position={[7.5, 4.35, 4]}
        intensity={92}
        distance={22}
        color="#f2ddbd"
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
  catalogue = false,
}: {
  item: WallpaperItem;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  medium?: "screen" | "print" | "projection";
  atmosphere?: boolean;
  catalogue?: boolean;
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
        color={catalogue ? "#202823" : "#12212b"}
        metalness={catalogue ? .15 : .6}
        roughness={catalogue ? .68 : .76}
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
      {catalogue && <Block position={[0, -actualHeight / 2 - .45, .1]} scale={[Math.min(actualWidth, 4.4), .85, .06]} color="#303940" roughness={.68} metalness={.14} />}
      <Label
        text={item.title.toUpperCase()}
        align={catalogue ? "center" : "left"}
        position={[catalogue ? 0 : -actualWidth / 2, -actualHeight / 2 - 0.34, 0.14]}
        size={0.18}
        color={catalogue ? "#d2dce1" : "#b4cbd5"}
        maxWidth={catalogue ? Math.min(actualWidth, 4.4) - .3 : undefined}
      />
      <Label
        text={`${item.date} / ${item.source?.startsWith("http") ? "COLLECTED VISUAL / ORIGINAL CREATOR" : item.source || "PERSONAL COLLECTION"}`}
        align={catalogue ? "center" : "left"}
        position={[catalogue ? 0 : -actualWidth / 2, -actualHeight / 2 - 0.63, 0.14]}
        size={0.1}
        color={catalogue ? "#9aadb7" : "#8ea7b5"}
        maxWidth={catalogue ? Math.min(actualWidth, 4.4) - .3 : width}
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
