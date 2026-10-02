import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearMipmapLinearFilter,
  Mesh,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type EulerTuple,
  type Vector3Tuple,
} from "three";
import type { ContentItem } from "../content/types";
import { usePalaceStore } from "../systems/store";
import { setWalkTarget } from "./walkTarget";
import { registerProximity } from "./proximity";

export interface BlockProps {
  position?: Vector3Tuple;
  rotation?: EulerTuple;
  scale?: Vector3Tuple;
  color?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}
export function Block({
  position,
  rotation,
  scale = [1, 1, 1],
  color = "#e4e5e2",
  roughness = 0.76,
  metalness = 0,
  opacity = 1,
  emissive,
  emissiveIntensity = 1,
  castShadow = false,
  receiveShadow = true,
  onClick,
}: BlockProps) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
    >
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}
export const Beam = Block;

/** A baked soft footprint keeps objects grounded even with GPU shadows disabled. */
export function ContactShadow({
  position = [0, 0.012, 0],
  width = 4,
  depth = 4,
  opacity = 0.26,
}: {
  position?: Vector3Tuple;
  width?: number;
  depth?: number;
  opacity?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);
    gradient.addColorStop(0, "#18313ef0");
    gradient.addColorStop(0.2, "#18313eaa");
    gradient.addColorStop(0.55, "#18313e45");
    gradient.addColorStop(1, "#18313e00");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** The museum's typography is rendered locally. No remote font CDN or SDF font fetch. */
export function Label({
  text,
  position = [0, 0, 0],
  rotation,
  size = 0.22,
  color = "#253134",
  align = "center",
  maxWidth = 16,
  opacity = 1,
}: {
  text: string;
  position?: Vector3Tuple;
  rotation?: EulerTuple;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  opacity?: number;
}) {
  const [fontVersion, setFontVersion] = useState(0);
  useEffect(() => {
    let active = true;
    document.fonts.ready.then(() => {
      if (active) setFontVersion((v) => v + 1);
    });
    return () => {
      active = false;
    };
  }, []);
  const rendered = useMemo(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const pixelSize = 110;
    context.font = `${pixelSize}px "Palace Sans", Arial, sans-serif`;
    const limit = (maxWidth / size) * pixelSize;
    const lines: string[] = [];
    text.split("\n").forEach((paragraph) => {
      let line = "";
      paragraph.split(" ").forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (line && context.measureText(next).width > limit) {
          lines.push(line);
          line = word;
        } else line = next;
      });
      lines.push(line);
    });
    const contentWidth = Math.max(
      1,
      ...lines.map((line) => context.measureText(line).width),
    );
    const padding = 18;
    const originalWidth = contentWidth + padding * 2;
    const originalHeight = lines.length * pixelSize * 1.32 + padding * 2;
    const rasterScale = Math.min(
      1,
      2048 / originalWidth,
      2048 / originalHeight,
    );
    canvas.width = Math.max(1, Math.ceil(originalWidth * rasterScale));
    canvas.height = Math.max(1, Math.ceil(originalHeight * rasterScale));
    context.scale(rasterScale, rasterScale);
    context.font = `${pixelSize}px "Palace Sans", Arial, sans-serif`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = "middle";
    const x =
      align === "left"
        ? padding
        : align === "right"
          ? originalWidth - padding
          : originalWidth / 2;
    lines.forEach((line, i) =>
      context.fillText(
        line,
        x,
        padding + pixelSize * 0.67 + i * pixelSize * 1.32,
      ),
    );
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    return {
      texture,
      width: (originalWidth / pixelSize) * size,
      height: (originalHeight / pixelSize) * size,
    };
    // A locally loaded face becoming available requires rebuilding its raster.
  }, [text, size, color, align, maxWidth, fontVersion]);
  useEffect(() => () => rendered.texture.dispose(), [rendered]);
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={[rendered.width, rendered.height]} />
      <meshBasicMaterial
        map={rendered.texture}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/** Textures belong to the mounted room, and are released when that room is left. */
export function useImageTexture(src?: string) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const tier = usePalaceStore((s) => s.effectiveQuality);
  useEffect(() => {
    setTexture(null);
    if (!src) return;
    let disposed = false;
    let loaded: Texture | null = null;
    const url = src.startsWith("/")
      ? `${import.meta.env.BASE_URL}${src.slice(1)}`
      : src;
    new TextureLoader().load(
      url,
      (image) => {
        if (disposed) {
          image.dispose();
          return;
        }
        loaded = image;
        const budget = tier === "low" ? 768 : tier === "medium" ? 1280 : 2048;
        const source = image.image as HTMLImageElement;
        if (Math.max(source.width, source.height) > budget) {
          const scale = budget / Math.max(source.width, source.height);
          const resized = document.createElement("canvas");
          resized.width = Math.max(1, Math.round(source.width * scale));
          resized.height = Math.max(1, Math.round(source.height * scale));
          const context = resized.getContext("2d");
          if (context) {
            context.drawImage(source, 0, 0, resized.width, resized.height);
            image.image = resized;
          }
        }
        image.colorSpace = SRGBColorSpace;
        image.anisotropy = 2;
        image.needsUpdate = true;
        setTexture(image);
      },
      undefined,
      () => {
        if (!disposed) setTexture(null);
      },
    );
    return () => {
      disposed = true;
      loaded?.dispose();
    };
  }, [src, tier]);
  return texture;
}

export function Picture({
  src,
  width = 5,
  height = 3,
  position = [0, 0, 0],
  rotation,
  color = "#8c9da0",
  fit = "contain",
}: {
  src?: string;
  width?: number;
  height?: number;
  position?: Vector3Tuple;
  rotation?: EulerTuple;
  color?: string;
  fit?: "contain" | "cover";
}) {
  const texture = useImageTexture(src);
  const aspect = texture?.image
    ? texture.image.width / texture.image.height
    : width / height;
  const dimensions =
    fit === "cover"
      ? [width, height]
      : aspect > width / height
        ? [width, width / aspect]
        : [height * aspect, height];
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[dimensions[0], dimensions[1]]} />
      <meshBasicMaterial
        key={texture?.uuid || "unloaded"}
        map={texture}
        color={texture ? "#ffffff" : color}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

export function Floor({
  width = 28,
  depth = 34,
  color = "#d5d8d6",
  opacity = 1,
}: {
  width?: number;
  depth?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <mesh
      position={[0, -0.035, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(event) => {
        if (event.delta < 5 && usePalaceStore.getState().mode === "tour") {
          event.stopPropagation();
          setWalkTarget(event.point);
        }
      }}
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color={color}
        roughness={0.32}
        metalness={0.13}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

export function Door({
  id,
  title,
  number = "",
  position,
  rotation,
  dark = false,
}: {
  id: string;
  title: string;
  number?: string;
  position: Vector3Tuple;
  rotation?: EulerTuple;
  dark?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const frame = useRef<Mesh>(null);
  const unlit = useMemo(() => new Color(dark ? "#53696b" : "#d3e0df"), [dark]);
  const lit = useMemo(() => new Color("#b3e1ec"), []);
  useEffect(
    () =>
      frame.current
        ? registerProximity(
            `door:${id}:${position.join(",")}`,
            frame.current,
            title,
            6,
          )
        : undefined,
    [id, title, position],
  );
  useFrame((_, delta) => {
    if (!frame.current) return;
    const material = frame.current
      .material as import("three").MeshStandardMaterial;
    material.color.lerp(hovered ? lit : unlit, Math.min(delta * 5, 1));
  });
  const enter = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    usePalaceStore.getState().enterRoom(id);
  };
  return (
    <group position={position} rotation={rotation}>
      <Block
        position={[-1.57, 2.45, 0]}
        scale={[0.32, 4.9, 0.46]}
        color={dark ? "#282d2c" : "#e4e6e2"}
      />
      <Block
        position={[1.57, 2.45, 0]}
        scale={[0.32, 4.9, 0.46]}
        color={dark ? "#282d2c" : "#e4e6e2"}
      />
      <Block
        position={[0, 4.73, 0]}
        scale={[3.45, 0.36, 0.46]}
        color={dark ? "#282d2c" : "#e4e6e2"}
      />
      <mesh
        ref={frame}
        position={[0, 2.25, 0.045]}
        onClick={enter}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[2.8, 4.5]} />
        <meshStandardMaterial
          color={dark ? "#53696b" : "#d3e0df"}
          roughness={0.7}
          emissive={dark ? "#142427" : "#718986"}
          emissiveIntensity={hovered ? 0.4 : 0.13}
          side={DoubleSide}
        />
      </mesh>
      <Block
        position={[0, 4.53, 0.045]}
        scale={[2.85, 0.028, 0.08]}
        color="#c5e3e8"
        emissive="#c5e3e8"
        emissiveIntensity={1.2}
      />
      <Label
        text={number}
        position={[-1.98, 3.6, 0.08]}
        size={0.16}
        color={dark ? "#99aaa9" : "#59706f"}
      />
      <Label
        text={title.toUpperCase()}
        position={[0, 5.22, 0.08]}
        size={0.23}
        color={dark ? "#d4dfdb" : "#304847"}
      />
      <Label
        text="ENTER  →"
        position={[0, 1.55, 0.095]}
        size={0.13}
        color={dark ? "#cddbd8" : "#536967"}
        opacity={hovered ? 1 : 0.65}
      />
    </group>
  );
}

export function Exhibit({
  item,
  position = [0, 0, 0],
  rotation,
  index = 0,
  kind = "sculpture",
}: {
  item: ContentItem;
  position?: Vector3Tuple;
  rotation?: EulerTuple;
  index?: number;
  kind?: "screen" | "sculpture" | "poster" | "wireframe";
}) {
  const [hovered, setHovered] = useState(false);
  const artwork = useRef<import("three").Group>(null);
  const container = useRef<import("three").Group>(null);
  useEffect(
    () =>
      container.current
        ? registerProximity(
            `exhibit:${item.id}`,
            container.current,
            item.title,
            5.5,
          )
        : undefined,
    [item.id, item.title],
  );
  const reducedMotion = usePalaceStore((s) => s.reducedMotion);
  useFrame(({ clock }, delta) => {
    if (
      artwork.current &&
      !reducedMotion &&
      kind !== "poster" &&
      kind !== "screen"
    ) {
      artwork.current.rotation.y += delta * 0.095;
      artwork.current.position.y =
        2.15 + Math.sin(clock.elapsedTime * 0.45 + index) * 0.09;
    }
  });
  const open = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    usePalaceStore.getState().focusItem(item);
  };
  const color = hovered ? "#a9dce9" : "#b9d4da";
  return (
    <group
      ref={container}
      position={position}
      rotation={rotation}
      onClick={open}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {kind === "screen" || kind === "poster" ? (
        <>
          <Block
            position={[0, 2.95, 0]}
            scale={[4.6, kind === "poster" ? 4.8 : 2.86, 0.1]}
            color={kind === "poster" ? "#dddeda" : "#121e24"}
            roughness={0.3}
            metalness={0.15}
          />
          {item.cover ? (
            <Picture
              src={item.cover}
              width={4.4}
              height={kind === "poster" ? 4.5 : 2.65}
              position={[0, 2.95, 0.06]}
            />
          ) : (
            <>
              <Label
                text={
                  item.category === "research"
                    ? item.equation || "∇ · F = 0"
                    : item.title.toUpperCase()
                }
                position={[0, 3.1, 0.065]}
                size={item.category === "research" ? 0.4 : 0.29}
                maxWidth={4}
                color={kind === "poster" ? "#365455" : "#c5e1e7"}
              />
              <Label
                text={item.subtitle}
                position={[0, 2.42, 0.07]}
                size={0.14}
                maxWidth={3.8}
                color={kind === "poster" ? "#607474" : "#748e9a"}
              />
            </>
          )}
          {kind === "screen" && (
            <Block
              position={[0, 0.38, -0.08]}
              scale={[3, 0.75, 0.75]}
              color="#c5c9c5"
            />
          )}
        </>
      ) : (
        <>
          <ContactShadow width={4.8} depth={4.8} opacity={0.2} />
          <Block
            position={[0, 0.28, 0]}
            scale={[3.05, 0.55, 3.05]}
            color={kind === "wireframe" ? "#9fa5a4" : "#dbddd8"}
            roughness={0.38}
          />
          <group ref={artwork} position={[0, 2.15, 0]}>
            <mesh castShadow>
              {index % 3 === 0 ? (
                <torusKnotGeometry args={[0.83, 0.2, 100, 14, 2, 3]} />
              ) : index % 3 === 1 ? (
                <icosahedronGeometry args={[1.15, 2]} />
              ) : (
                <torusGeometry args={[1, 0.27, 16, 56]} />
              )}
              <meshPhysicalMaterial
                color={color}
                roughness={0.14}
                metalness={kind === "wireframe" ? 0.3 : 0.05}
                transmission={kind === "wireframe" ? 0 : 0.4}
                thickness={0.65}
                transparent={kind === "wireframe"}
                opacity={kind === "wireframe" ? 0.75 : 1}
                wireframe={kind === "wireframe"}
                clearcoat={1}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]} scale={1.2}>
              <torusGeometry args={[1.16, 0.015, 6, 80]} />
              <meshStandardMaterial
                color="#acc7ce"
                metalness={0.45}
                roughness={0.22}
              />
            </mesh>
          </group>
        </>
      )}
      <Label
        text={`${String(index + 1).padStart(2, "0")}   /   ${item.title}`}
        position={[0, kind === "poster" ? 0.3 : -0.01, 1.67]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={0.14}
        color="#344e52"
        maxWidth={3.6}
      />
      <Label
        text={item.title.toUpperCase()}
        position={[
          0,
          kind === "screen" ? 4.67 : kind === "poster" ? 5.67 : 0.92,
          kind === "sculpture" || kind === "wireframe" ? 1.58 : 0.08,
        ]}
        size={0.2}
        color={kind === "wireframe" ? "#9db4b7" : "#345358"}
        maxWidth={4.5}
      />
      {hovered && (
        <Label
          text="VIEW EXHIBIT  →"
          position={[0, kind === "screen" ? 1.12 : 0.63, 1.64]}
          size={0.12}
          color="#477582"
        />
      )}
    </group>
  );
}
