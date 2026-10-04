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
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { usePalaceStore } from "../systems/store";
import Atrium from "../rooms/Atrium";
import GalleryRoom from "../rooms/Galleries";
import Corridor from "../rooms/Corridor";
import ListeningRoom from "../rooms/ListeningRoom";
import { WallpaperCinema, WallpaperGallery } from "../rooms/Wallpapers";
import Player from "./Player";
import { setWalkTarget } from "./walkTarget";
import { resolveRoomPlan } from "./roomPlan";
import { roomLighting } from "./artDirection";

function Environment({
  roomId,
  onReady,
}: {
  roomId: string;
  onReady?: () => void;
}) {
  const { gl, scene } = useThree();
  const tier = usePalaceStore((s) => s.effectiveQuality);
  const plan = resolveRoomPlan(roomId);
  const lighting = roomLighting(plan, roomId);
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
    ready.current?.();
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
  useEffect(() => {
    scene.environmentIntensity = lighting.environment;
  }, [scene, lighting.environment]);
  const color = lighting.background;
  return (
    <>
      <color attach="background" args={[color]} />
      <fog
        attach="fog"
        args={[
          color,
          roomId === "corridor" ? 32 : 38,
          roomId === "corridor" ? 135 : lighting.dark ? 95 : 160,
        ]}
      />
      <hemisphereLight
        args={[lighting.sky, lighting.ground, lighting.hemisphere]}
      />
      <directionalLight
        position={[12, 24, 4]}
        color={lighting.key}
        intensity={lighting.keyIntensity}
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
    };
    return () => {
      delete debug.__PALACE_DEBUG__;
    };
  }, [camera, gl, roomId, scene]);
  return (
    <>
      <Environment roomId={roomId} onReady={onReady} />
      <Player roomId={roomId} />
      <PerformanceMonitor />
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
        {roomId === "atrium" ? (
          <Atrium />
        ) : roomId === "corridor" ? (
          <Corridor />
        ) : plan.type === "listening" ? (
          <ListeningRoom />
        ) : roomId === "cinema" ? (
          <WallpaperCinema />
        ) : plan.type === "image-gallery" || roomId.startsWith("wallpapers") ? (
          <WallpaperGallery roomId={roomId} />
        ) : (
          <GalleryRoom roomId={roomId} />
        )}
      </group>
    </>
  );
}

export default function World({ onReady }: { onReady?: () => void }) {
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
      camera={{ fov: 60, near: 0.12, far: 200, position: [8.2, 1.65, 19.7] }}
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
