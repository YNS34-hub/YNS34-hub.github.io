import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Object3D } from "three";
import { usePalaceStore } from "../systems/store";
import { audioSignal } from "../audio/signal";
import { settleMotion } from "../motion/tokens";
import { lyricProjection } from "../systems/spatialLyrics";
import { useInteractable } from "./useInteractable";

export default function ListeningAttention({ roomId }: { roomId: string }) {
  const { scene } = useThree();
  const object = useRef<Object3D | null>(null), energy = useRef(0);
  useEffect(() => { object.current = scene.getObjectByName("listening-lyrics-wall") || null; }, [scene, roomId]);
  const attention = useInteractable(object, {
    title: "WORDS / THE LISTENING ROOM", hint: "Open player", radius: 11,
    activate: () => usePalaceStore.getState().setOverlay("player"),
  });
  useFrame((_, dt) => {
    if (roomId !== "music") return;
    const surface = lyricProjection.surface?.querySelector<HTMLElement>(".lyric-wall");
    if (!surface) return;
    const attended = attention.current.focused;
    if (surface.dataset.attended !== String(attended)) surface.dataset.attended = String(attended);
    // 只读现有真实分析器；停播/不可分析时自然归零，不产生第二条歌词或音频状态链。
    energy.current = settleMotion(energy.current, attended && audioSignal.available ? Math.min(1, audioSignal.rms * 2) : 0, dt, 0.2, 0.6);
    surface.style.setProperty("--listener-energy", energy.current.toFixed(3));
  });
  return null;
}
