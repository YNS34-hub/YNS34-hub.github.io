import { Suspense, useEffect, useRef } from "react";
import {
  Canvas,
  events as pointerEvents,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  Color,
  PCFSoftShadowMap,
  PMREMGenerator,
  DirectionalLight,
  HemisphereLight,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { usePalaceStore } from "../systems/store";
import Atrium from "../rooms/Atrium";
import GalleryRoom from "../rooms/Galleries";
import Corridor from "../rooms/Corridor";
import { VisualLab } from "../rooms/VisualLab";
import { WallpaperCinema } from "../rooms/Wallpapers";
import { PersonalProjects, PersonalResearch } from "../rooms/PersonalRooms";
import { useLibraryStore } from "../systems/library";
import { nearestImageAtmosphere } from "./imageAtmosphere";
import Player from "./Player";
import { setWalkTarget } from "./walkTarget";
import { resolveRoomPlan } from "./roomPlan";
import { roomLighting } from "./artDirection";
import ListeningRoom from "../rooms/ListeningRoom";
import { WallpaperVault, ImageRoom } from "../rooms/ImageRooms";
import { ArchiveRoom, CollectionRoom } from "../rooms/ArchiveRooms";
import { textureStatus } from "./textureCache";
import { audioSignal } from "../audio/signal";
import IdentityContrast from "./IdentityContrast";
import { useProgress } from "@react-three/drei";
// 交互扩展开始 world-import
import InteractionFrame from "../interaction/InteractionFrame";
import ListeningAttention from "../interaction/ListeningAttention";
import WorldsBoundary, { MuseumWorldsEntry } from "../worlds/WorldsBoundary";
import WorldsEnvironment from "../worlds/OutdoorEnvironment";
// 交互扩展结束

function Environment({
  roomId,
  onReady,
}: {
  roomId: string;
  onReady?: () => void;
}) {
  const { gl, scene } = useThree();
  const { active: assetLoading } = useProgress();
  const tier = usePalaceStore((s) => s.effectiveQuality);
  const plan = resolveRoomPlan(roomId);
  const lighting = roomLighting(plan, roomId);
  const background = useRef(new Color(lighting.background));
  const key = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const targetColor = useRef(new Color());
  const targetKey = useRef(new Color());
  const targetSky = useRef(new Color());
  const targetGround = useRef(new Color());
  useFrame(({ camera }, dt) => {
    const blend = 1 - Math.exp(-Math.min(dt, 1) / 0.8);
    const imageTint = nearestImageAtmosphere(camera.position);
    targetColor.current.set(lighting.background);
    targetKey.current.set(lighting.key);
    targetSky.current.set(lighting.sky);
    targetGround.current.set(lighting.ground);
    if (imageTint) {
      targetColor.current.lerp(imageTint, 0.18);
      targetKey.current.lerp(imageTint, 0.3);
      targetSky.current.lerp(imageTint, 0.35);
    }
    background.current.lerp(targetColor.current, blend);
    if (scene.fog) scene.fog.color.copy(background.current);
    scene.environmentIntensity +=
      (lighting.environment - scene.environmentIntensity) * blend;
    if (key.current) {
      key.current.color.lerp(targetKey.current, blend);
      key.current.intensity +=
        (lighting.keyIntensity * (imageTint ? 0.78 : 1) -
          key.current.intensity) *
        blend;
    }
    if (sky.current) {
      sky.current.color.lerp(targetSky.current, blend);
      sky.current.groundColor.lerp(targetGround.current, blend);
      sky.current.intensity +=
        (lighting.hemisphere - sky.current.intensity) * blend;
    }
  });
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const environment = new RoomEnvironment();
    const target = generator.fromScene(environment, 0.035);
    scene.environment = target.texture;
    environment.dispose();
    generator.dispose();
    const lost = (event: Event) => {
      event.preventDefault();
      usePalaceStore.getState().update({ mode: "index" });
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      target.dispose();
      scene.environment = null;
      gl.domElement.removeEventListener("webglcontextlost", lost);
    };
  }, [gl, scene]);
  const readyAt = useRef(0),
    sent = useRef("");
  useEffect(() => {
    readyAt.current = performance.now();
    sent.current = "";
  }, [roomId]);
  useFrame(() => {
    if (sent.current === roomId) return;
    const status = textureStatus();
    if (
      useLibraryStore.getState().ready &&
      !status.pending &&
      !assetLoading &&
      performance.now() - readyAt.current > 650 &&
      sent.current !== roomId
    ) {
      sent.current = roomId;
      ready.current?.();
    }
  });
  const color = lighting.background;
  return (
    <>
      <primitive attach="background" object={background.current} />
      <fog
        attach="fog"
        args={[
          color,
          roomId === "corridor" ? 32 : 38,
          roomId === "corridor" ? 135 : lighting.dark ? 95 : 160,
        ]}
      />
      <hemisphereLight ref={sky} args={["#b5cfde", "#22364a", 0.5]} />
      <directionalLight
        ref={key}
        position={
          roomId === "music"
            ? [-8, 13, 5]
            : roomId === "atrium"
              ? [-12, 24, 6]
              : [10, 16, 5]
        }
        color="#d4e4f0"
        intensity={1}
        castShadow={plan.type !== "listening"}
        shadow-mapSize={tier === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={27}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={75}
        shadow-bias={-0.00035}
        shadow-normalBias={0.055}
        shadow-radius={3}
      />
      <ambientLight intensity={0.025} />
    </>
  );
}

function PerformanceMonitor() {
  const count = useRef(0),
    seconds = useRef(0),
    stable = useRef(0),
    bad = useRef(0);
  useFrame((_, delta) => {
    if (document.hidden) return;
    count.current += 1;
    seconds.current += delta;
    if (seconds.current < 2) return;
    const fps = Math.min(120, Math.round(count.current / seconds.current));
    const state = usePalaceStore.getState();
    state.update({ fps });
    if (state.quality === "auto") {
      bad.current = fps < 42 ? bad.current + 1 : 0;
      stable.current = fps > 57 ? stable.current + 1 : 0;
      if (bad.current >= 2 && state.effectiveQuality !== "low") {
        state.update({
          effectiveQuality:
            state.effectiveQuality === "high" ? "medium" : "low",
        });
        bad.current = 0;
      }
      // A conservative upward adjustment avoids oscillation on integrated GPUs.
      if (
        stable.current >= 6 &&
        state.effectiveQuality === "low" &&
        !matchMedia("(pointer: coarse)").matches
      ) {
        state.update({ effectiveQuality: "medium" });
        stable.current = 0;
      }
    }
    count.current = 0;
    seconds.current = 0;
  });
  return null;
}

function Scene({
  roomId,
  onReady,
  tier,
}: {
  roomId: string;
  onReady?: () => void;
  tier: "high" | "medium" | "low";
}) {
  const { camera, gl, scene } = useThree();
  const plan = resolveRoomPlan(roomId);
  const baseRoom = roomId.split("-page-")[0];
  useEffect(() => {
    gl.transmissionResolutionScale =
      tier === "high" ? 0.8 : tier === "medium" ? 0.6 : 0.35;
  }, [gl, tier]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = window as Window & { __PALACE_DEBUG__?: unknown };
    debug.__PALACE_DEBUG__ = {
      camera,
      renderer: gl,
      scene,
      roomId,
      residentCorridorChunks: roomId === "corridor" ? 5 : 0,
      textureStatus,
      audioSignal,
    };
    return () => {
      delete debug.__PALACE_DEBUG__;
    };
  }, [camera, gl, roomId, scene]);
  return (
    <>
      {/* 交互扩展开始 world-environment-open */}
      <WorldsEnvironment roomId={roomId} onReady={onReady}>
      {/* 交互扩展结束 */}
      <Environment roomId={roomId} onReady={onReady} />
      {/* 交互扩展开始 world-environment-close */}
      </WorldsEnvironment>
      {/* 交互扩展结束 */}
      <Player roomId={roomId} />
      <PerformanceMonitor />
      <IdentityContrast />
      {/* 交互扩展开始 world-interaction */}
      <InteractionFrame />
      <ListeningAttention key={"listening-attention:" + roomId} roomId={roomId} />
      <MuseumWorldsEntry key={"worlds-entry:" + roomId} roomId={roomId} />
      {/* 交互扩展结束 */}
      <group
        key={roomId}
        onClick={(event) => {
          if (
            event.delta < 5 &&
            event.point.y < 0.3 &&
            usePalaceStore.getState().mode === "tour"
          ) {
            event.stopPropagation();
            setWalkTarget(event.point);
          }
        }}
      >
        {/* 交互扩展开始 world-boundary-open */}
        <WorldsBoundary roomId={roomId}>
        {/* 交互扩展结束 */}
        {roomId === "atrium" ? (
          <Atrium />
        ) : roomId === "corridor" ? (
          <Corridor />
        ) : ["liquid-web", "editorial", "experiments"].includes(baseRoom) ? (
          <VisualLab roomId={roomId} />
        ) : baseRoom === "projects" ? (
          <PersonalProjects />
        ) : baseRoom === "research" ? (
          <PersonalResearch />
        ) : ["imagined-worlds", "cosmic", "glass-life", "portraits"].includes(
            baseRoom,
          ) ? (
          <ImageRoom roomId={roomId} />
        ) : roomId === "archive" || roomId === "unfinished" ? (
          <ArchiveRoom unfinished={roomId === "unfinished"} />
        ) : roomId === "my-collection" ? (
          <CollectionRoom />
        ) : plan.type === "listening" ? (
          <ListeningRoom />
        ) : roomId === "cinema" ? (
          <WallpaperCinema />
        ) : plan.type === "image-gallery" || roomId.startsWith("wallpapers") ? (
          <WallpaperVault />
        ) : (
          <GalleryRoom roomId={roomId} />
        )}
        {/* 交互扩展开始 world-boundary-close */}
        </WorldsBoundary>
        {/* 交互扩展结束 */}
      </group>
    </>
  );
}

export default function World({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);
  const roomId = usePalaceStore((s) => s.roomId);
  const quality = usePalaceStore((s) => s.quality);
  const effective = usePalaceStore((s) => s.effectiveQuality);
  const tier = quality === "auto" ? effective : quality;
  const coarse = matchMedia("(pointer: coarse)").matches;
  useEffect(() => {
    const chosen = coarse ? "low" : quality === "auto" ? effective : quality;
    if (effective !== chosen)
      usePalaceStore.getState().update({ effectiveQuality: chosen });
  }, [quality, effective, coarse]);
  const renderTier = coarse ? "low" : tier;
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    coarse ? 0.8 : tier === "high" ? 1.6 : tier === "medium" ? 1.25 : 0.85,
  );
  return (
    <Canvas
      className="world-canvas"
      dpr={dpr}
      shadows={renderTier !== "low"}
      camera={{ fov: 60, near: 0.12, far: 200, position: [0, 1.65, 23] }}
      events={(state) => {
        const normal = pointerEvents(state);
        return {
          ...normal,
          compute: (event, current, previous) => {
            if (document.pointerLockElement === current.gl.domElement) {
              current.pointer.set(0, 0);
              current.raycaster.setFromCamera(current.pointer, current.camera);
            } else normal.compute?.(event, current, previous);
          },
        };
      }}
      gl={{
        antialias: renderTier !== "low",
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFSoftShadowMap;
        gl.toneMappingExposure = 1;
        gl.setClearColor(new Color("#dce6e4"));
      }}
    >
      <Suspense fallback={null}>
        <Scene roomId={roomId} onReady={onReady} tier={renderTier} />
      </Suspense>
    </Canvas>
  );
}
