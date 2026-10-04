import { useEffect, useRef, useId } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, MeshPhysicalMaterial, PointLight, Vector3 } from "three";
import { imageAtmospheres } from "../world/imageAtmosphere";
import type { ContentItem, WallpaperItem } from "../content/types";
import { projects, research, archive, experiments } from "../content/catalog";
import {
  Block,
  Door,
  Floor,
  Label,
  Picture,
  useImageTexture,
} from "../world/primitives";
import { RoomShell } from "./Architecture";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { useAudioStore } from "../audio/player";

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
  tint = "#497cb0",
}: {
  item: ContentItem;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  tint?: string;
}) {
  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        if (e.delta < 5) {
          e.stopPropagation();
          usePalaceStore.getState().focusItem(item);
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
        width={width}
        height={height}
        position={[0, 0, 0.12]}
      />
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
  const personal = useLibraryStore((s) => s.personal.projects);
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
  const hero = works.find((p) => p.id === "void-echo") || works[0];
  return (
    <group>
      <RoomShell dark palette="projects" width={28} depth={34} height={11} />
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
  const personal = useLibraryStore((s) => s.personal.research);
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
      <RoomShell dark palette="research" width={28} depth={34} height={11} />
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
export function PersonalMusic() {
  const object = useRef<Group>(null);
  const glass = useRef<MeshPhysicalMaterial>(null);
  const glow = useRef<PointLight>(null);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  const tracks = useLibraryStore((s) => s.music);
  const currentId = useAudioStore((s) => s.currentId);
  const track = tracks.find((t) => t.id === currentId);
  useFrame(({ clock }, dt) => {
    const audio = useAudioStore.getState();
    const energy = audio.playing && !reduced ? audio.energy : 0;
    if (object.current && !reduced) {
      object.current.rotation.y +=
        Math.min(dt, 0.05) * (audio.playing ? 0.023 : 0.004);
      object.current.position.y =
        3.9 + (audio.playing ? Math.sin(clock.elapsedTime * 0.5) * 0.045 : 0);
    }
    if (glass.current) glass.current.ior = 1.43 + energy * 0.06;
    if (glow.current) glow.current.intensity = 60 + energy * 14;
  });
  return (
    <group>
      <RoomShell dark palette="music" width={28} depth={34} height={11} />
      <Heading
        title="PERSONAL LISTENING ROOM"
        subtitle="梁博 / A STAGE FOR THE HOURS AFTER DARK"
        color="#e5ccb0"
      />
      <mesh position={[0, 0.08, -3]}>
        <cylinderGeometry args={[5.4, 5.4, 0.16, 80]} />
        <meshStandardMaterial
          color="#0b1831"
          metalness={0.65}
          roughness={0.2}
        />
      </mesh>
      <group
        position={[0, 3.9, -3]}
        ref={object}
        onClick={(e) => {
          e.stopPropagation();
          usePalaceStore.getState().setOverlay("player");
        }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 9, 0.13]}>
            <boxGeometry args={[0.2, 4.2 + Math.sin(i) * 0.5, 4.7]} />
            <meshPhysicalMaterial
              ref={i === 0 ? glass : undefined}
              color="#81a7e3"
              transmission={0.82}
              thickness={0.5}
              roughness={0.14}
              metalness={0.08}
              transparent
              opacity={0.66}
            />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[0, side * 2.55, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[3.2, 0.028, 8, 100]} />
            <meshBasicMaterial color={side === 1 ? "#cd9258" : "#4266b5"} />
          </mesh>
        ))}
      </group>
      {[-10.6, 10.6].map((x) => (
        <group key={x}>
          <Block
            position={[x, 3.8, -5]}
            scale={[0.1, 7.6, 18]}
            color="#111c36"
            opacity={0.72}
            metalness={0.4}
          />
          <Block
            position={[x, 1, -5]}
            scale={[0.12, 0.025, 18]}
            color="#b78254"
            emissive="#b78254"
            emissiveIntensity={0.9}
          />
        </group>
      ))}
      <Label
        text={track ? `${track.artist} — ${track.title}` : "梁博"}
        position={[0, 3.4, -15.4]}
        size={0.72}
        color="#e5c6a4"
      />
      <Label
        text="男孩     出现又离开     日落大道     灵魂歌手"
        position={[0, 2.3, -15.4]}
        size={0.25}
        color="#b19a83"
        maxWidth={22}
      />
      <Label
        text="OPEN LISTENING SHELF / LOCAL MUSIC"
        position={[0, 0.02, 6]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.18}
        color="#7494bf"
      />
      <pointLight
        ref={glow}
        position={[0, 6, -3]}
        color="#6289d9"
        intensity={60}
        distance={23}
      />
      <pointLight
        position={[0, 5, -13]}
        color="#ffc58a"
        intensity={55}
        distance={20}
      />
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
}: {
  item: WallpaperItem;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
}) {
  const texture = useImageTexture(item.displaySrc || item.src);
  const atmosphereId = useId();
  const light = useRef<PointLight>(null);
  const frame = useRef<Group>(null);
  const tint = useRef(new Color(item.color || "#679ac3"));
  useEffect(() => {
    if (frame.current) {
      frame.current.updateWorldMatrix(true, false);
      imageAtmospheres.set(atmosphereId, {
        position: frame.current.getWorldPosition(new Vector3()),
        color: tint.current,
      });
    }
    return () => {
      imageAtmospheres.delete(atmosphereId);
    };
  }, [item.id, atmosphereId]);
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
  useFrame(({ camera }, dt) => {
    if (light.current && frame.current) {
      const distance = camera.position.distanceTo(frame.current.position);
      light.current.color.lerp(tint.current, 1 - Math.exp(-dt / 1.5));
      light.current.intensity +=
        ((distance < 18 ? 95 : 25) - light.current.intensity) *
        (1 - Math.exp(-dt / 2));
    }
  });
  return (
    <group
      ref={frame}
      position={position}
      rotation={rotation}
      onClick={(e) => {
        if (e.delta < 5) {
          e.stopPropagation();
          usePalaceStore.getState().update({ cinemaImage: item });
          usePalaceStore.getState().enterRoom("cinema");
        }
      }}
    >
      <Block
        scale={[width + 0.2, height + 0.2, 0.12]}
        color="#12212b"
        metalness={0.6}
      />
      <Picture
        texture={texture}
        width={width}
        height={height}
        position={[0, 0, 0.09]}
      />
      <Label
        text={item.title.toUpperCase()}
        align="left"
        position={[-width / 2, -height / 2 - 0.38, 0.1]}
        size={0.18}
        color="#b4cbd5"
      />
      <Label
        text={`${item.date} / ${item.source?.startsWith("http") ? "COLLECTED VISUAL / ORIGINAL CREATOR" : item.source || "PERSONAL COLLECTION"}`}
        align="left"
        position={[-width / 2, -height / 2 - 0.66, 0.1]}
        size={0.1}
        color="#8ea7b5"
        maxWidth={width}
      />
      <pointLight
        ref={light}
        position={[0, 0, 3]}
        intensity={25}
        distance={27}
      />
    </group>
  );
}
export function PersonalWallpaper() {
  const images = useLibraryStore((s) => s.wallpapers);
  const room = usePalaceStore((s) => s.roomId);
  const page = Math.max(0, (Number(room.split("-page-")[1]) || 1) - 1);
  const works = images.slice(page * 5, page * 5 + 5);
  return (
    <group>
      <RoomShell dark palette="wallpapers" width={28} depth={36} height={12} />
      <Heading
        title="THE WALLPAPER VAULT"
        subtitle="MY OTHER HORIZONS / COLLECTED, NOT GENERATED"
      />
      {works[0] && (
        <VisualWall
          item={works[0]}
          position={[0, 5, -12.5]}
          width={22}
          height={11}
        />
      )}
      {works.slice(1).map((item, i) => (
        <VisualWall
          key={item.id}
          item={item}
          position={[i % 2 ? 11.7 : -11.7, 4.9, 5 - Math.floor(i / 2) * 9]}
          rotation={[0, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0]}
          width={8.6}
          height={7.7}
        />
      ))}
      {!works.length && (
        <Label
          text="BRING A HORIZON WITH YOU"
          position={[0, 4, -12]}
          size={0.6}
          color="#b2c8d5"
        />
      )}
      <Label
        text="OPEN COLLECTION / IMPORT YOUR WALLPAPERS"
        position={[0, 0.02, 6]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.17}
        color="#68889a"
      />
      {page > 0 && (
        <Door
          id={page === 1 ? "wallpapers" : `wallpapers-page-${page}`}
          title="Previous horizons"
          position={[-10, 0, 14.6]}
          rotation={[0, Math.PI, 0]}
          dark
        />
      )}
      {(page + 1) * 5 < images.length && (
        <Door
          id={`wallpapers-page-${page + 2}`}
          title="More horizons"
          position={[0, 0, -17]}
          dark
        />
      )}
      <Exit />
    </group>
  );
}
export function ImaginedWorlds({ roomId }: { roomId: string }) {
  const works = useLibraryStore((s) => s.personal.visuals);
  const baseRoom = roomId.split("-page-")[0];
  const page = Math.max(0, (Number(roomId.split("-page-")[1]) || 1) - 1);
  const category =
    baseRoom === "glass-life"
      ? "glass"
      : baseRoom === "portraits"
        ? "portrait"
        : baseRoom === "cosmic"
          ? "cosmic"
          : undefined;
  const collection = category
    ? works.filter((x) => x.category === category)
    : [
        ...works.filter((x) => x.category === "cosmic"),
        ...works.filter((x) => x.category !== "cosmic"),
      ];
  const images = collection.slice(page * 5, page * 5 + 5);
  const roof = useRef<Group>(null);
  const aqua = category === "glass";
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame(({ camera }, dt) => {
    if (roof.current) {
      const target = reduced || camera.position.z < 5 ? 0.04 : 0.7;
      roof.current.scale.y +=
        (target - roof.current.scale.y) * (reduced ? 1 : 1 - Math.exp(-dt / 2));
    }
  });
  return (
    <group>
      <Floor width={28} depth={34} color={aqua ? "#213d55" : "#080e20"} />
      <Block
        position={[-14, 5, 0]}
        scale={[0.4, 10, 34]}
        color={aqua ? "#275471" : "#0b1933"}
      />
      <Block
        position={[14, 5, 0]}
        scale={[0.4, 10, 34]}
        color={aqua ? "#275471" : "#0b1933"}
      />
      <group ref={roof} position={[0, 11, -9]}>
        <Block scale={[28, 0.35, 16]} color="#1b2841" />
      </group>
      <Heading
        title={
          aqua
            ? "GLASS LIFE ROOM"
            : category === "portrait"
              ? "HUMAN / PORTRAIT ROOM"
              : category === "cosmic"
                ? "COSMIC ROOM"
                : "IMAGINED WORLDS"
        }
        subtitle={
          category === "portrait"
            ? "JIE TIAN / SAVED VISUAL WORKS / PROVENANCE ON EACH WORK"
            : "JIE TIAN / SAVED VISUAL WORKS / PROVENANCE ON EACH WORK"
        }
      />
      {images[0] && (
        <VisualWall
          item={images[0]}
          position={[0, 5, -11]}
          width={17}
          height={9.4}
        />
      )}
      {images.slice(1, 5).map((item, i) => (
        <VisualWall
          key={item.id}
          item={item}
          position={[i % 2 ? 10 : -10, 4.3, 3 - Math.floor(i / 2) * 8]}
          width={5.5}
          height={7.8}
          rotation={[0, i % 2 ? -0.7 : 0.7, i % 2 ? 0.03 : -0.03]}
        />
      ))}
      {!images.length && (
        <Label
          text="A PLACE FOR YOUR NEXT WORLD"
          position={[0, 4, -11]}
          color="#8dafc9"
          size={0.55}
        />
      )}
      <pointLight
        position={[0, 8, -7]}
        intensity={90}
        distance={28}
        color={
          aqua ? "#71d6db" : category === "portrait" ? "#d9a180" : "#5a78cd"
        }
      />
      <Door id="glass-life" title="Glass life" position={[-8, 0, -15.5]} dark />
      <Door
        id="portraits"
        title="Human studies"
        position={[8, 0, -15.5]}
        dark
      />
      <Door
        id="cosmic"
        title="Cosmic room"
        position={[-12.5, 0, 9]}
        rotation={[0, Math.PI / 2, 0]}
        dark
      />
      {page > 0 && (
        <Door
          id={page === 1 ? baseRoom : `${baseRoom}-page-${page}`}
          title="Previous studies"
          position={[-10, 0, 14.6]}
          rotation={[0, Math.PI, 0]}
          dark
        />
      )}
      {(page + 1) * 5 < collection.length && (
        <Door
          id={`${baseRoom}-page-${page + 2}`}
          title="More imagined worlds"
          position={[0, 0, -16.5]}
          dark
        />
      )}
      <Exit />
    </group>
  );
}
export function PersonalArchive({
  unfinished = false,
}: {
  unfinished?: boolean;
}) {
  const parts = useRef<Group>(null);
  const studies = useLibraryStore((s) => s.personal.projects)
    .filter((work) => work.category === "liquid-web")
    .slice(4, 6);
  const reduced = usePalaceStore((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (parts.current && !reduced)
      parts.current.position.y = Math.sin(clock.elapsedTime * 0.16) * 0.1;
  });
  return (
    <group>
      <RoomShell
        dark
        palette={unfinished ? "unfinished" : "archive"}
        width={28}
        depth={34}
        height={11}
      />
      <Heading
        title={unfinished ? "UNFINISHED WING" : "THE ARCHIVE"}
        subtitle={
          unfinished
            ? "IDEAS I HAVE NOT FINISHED / THE STRUCTURE IS STILL BECOMING"
            : "EXPERIMENT · PROTOTYPE · REFERENCE · ARCHIVE"
        }
        color={unfinished ? "#8a9cbe" : "#cac3a5"}
      />
      <group ref={parts}>
        {unfinished
          ? Array.from({ length: 8 }, (_, i) => (
              <group key={i} position={[0, 0, 6 - i * 2.8]}>
                <Block
                  position={[-6 - i * 0.45, 4, 0]}
                  scale={[0.35, 8, 0.35]}
                  color="#252d36"
                  opacity={1 - i * 0.09}
                />
                <Block
                  position={[6 + i * 0.45, 4, 0]}
                  scale={[0.35, 8, 0.35]}
                  color="#252d36"
                  opacity={1 - i * 0.09}
                />
                <Block
                  position={[0, 8, 0]}
                  scale={[12 + i * 0.9, 0.3, 0.35]}
                  color="#263849"
                  opacity={1 - i * 0.11}
                />
              </group>
            ))
          : archive.map((work, i) => (
              <group
                key={work.id}
                position={[
                  i % 2 ? 6.6 : -6.6,
                  2.8 + (i % 3) * 0.5,
                  4 - Math.floor(i / 2) * 7,
                ]}
                rotation={[0, i % 2 ? -0.28 : 0.28, i % 2 ? 0.07 : -0.07]}
                onClick={(e) => {
                  e.stopPropagation();
                  usePalaceStore.getState().focusItem(work);
                }}
              >
                <Block
                  scale={[6.2, 3.4, 0.07]}
                  color="#465451"
                  opacity={0.35}
                />
                {work.cover && (
                  <Picture
                    src={work.cover}
                    width={5.8}
                    height={2.7}
                    position={[0, 0.1, 0.06]}
                  />
                )}
                <Label
                  text={work.title.toUpperCase()}
                  position={[0, -1.35, 0.1]}
                  size={0.2}
                  color="#d3cbbb"
                />
                <Label
                  text={
                    work.tags.includes("Fork")
                      ? "REFERENCE / UPSTREAM AUTHORSHIP"
                      : work.status
                  }
                  position={[0, -1.7, 0.1]}
                  size={0.11}
                  color="#a7aa95"
                />
              </group>
            ))}
      </group>
      {unfinished && (
        <group>
          {studies.map((work, i) => (
            <VisualWall
              key={work.id}
              item={work}
              position={[i ? 6.2 : -6.2, 3.7, -7 - i * 3]}
              width={7.2}
              height={4.5}
              rotation={[0, i ? -0.2 : 0.2, i ? 0.04 : -0.04]}
            />
          ))}
          <Label
            text="OPEN STUDIES / PLACES TO RETURN TO"
            position={[0, 0.03, -4]}
            rotation={[-Math.PI / 2, 0, 0]}
            size={0.17}
            color="#6b91bd"
          />
        </group>
      )}
      {unfinished && (
        <Label
          text="SOME THINGS ARE STILL BECOMING."
          position={[0, 3, -15.8]}
          size={0.33}
          color="#6080a0"
        />
      )}
      <pointLight
        position={[0, 6, -2]}
        color={unfinished ? "#5074b8" : "#d1a975"}
        intensity={unfinished ? 40 : 100}
        distance={24}
      />
      <Door
        id={unfinished ? "archive" : "unfinished"}
        title={unfinished ? "The Archive" : "Unfinished Wing"}
        position={[0, 0, -16]}
        dark
      />
      <Exit />
    </group>
  );
}
export function MyCollection() {
  const images = useLibraryStore((s) => s.wallpapers);
  const visuals = useLibraryStore((s) => s.personal.visuals);
  const tracks = useLibraryStore((s) => s.music);
  const favorites = [...images, ...visuals].filter((x) => x.favorite);
  const work = favorites[0] || images[0] || visuals[0];
  return (
    <group>
      <RoomShell dark palette="collection" width={28} depth={34} height={11} />
      <Heading
        title="MY COLLECTION"
        subtitle="THINGS I BUILT. THINGS I KEEP. THINGS I AM STILL THINKING ABOUT."
      />
      {projects.slice(0, 2).map((p, i) => (
        <ProjectScreen
          key={p.id}
          item={p}
          position={[i ? 7.5 : -7.5, 4, -7]}
          width={8}
          height={5.3}
          rotation={[0, i ? -0.15 : 0.15, 0]}
        />
      ))}
      {work && (
        <VisualWall
          item={work}
          position={[0, 4.5, -14]}
          width={9}
          height={7.4}
        />
      )}
      {(visuals.find((x) => x.favorite) || visuals[0]) && (
        <VisualWall
          item={visuals.find((x) => x.favorite) || visuals[0]}
          position={[-11.8, 4, 4]}
          width={8}
          height={7}
          rotation={[0, Math.PI / 2, 0]}
        />
      )}
      <Block
        position={[0, 1.2, -2]}
        scale={[9, 0.12, 3.5]}
        color="#274354"
        opacity={0.6}
      />
      <Label
        text={
          tracks
            .filter((x) => x.favorite)
            .slice(0, 4)
            .map((x) => `${x.artist} — ${x.title}`)
            .join("\n") || "梁博 / 男孩 / 日落大道"
        }
        position={[0, 1.4, -1]}
        rotation={[-0.7, 0, 0]}
        color="#d3b18b"
        size={0.3}
        maxWidth={9}
      />
      <Door
        id="research"
        title="The questions"
        position={[-10, 0, 3]}
        rotation={[0, Math.PI / 2, 0]}
        dark
      />
      <Door
        id="unfinished"
        title="Still becoming"
        position={[10, 0, 3]}
        rotation={[0, -Math.PI / 2, 0]}
        dark
      />
      <pointLight
        position={[0, 5, -2]}
        color="#80b8d0"
        intensity={70}
        distance={22}
      />
      <Exit />
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
