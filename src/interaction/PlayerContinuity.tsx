import { useEffect } from "react";
import { usePalaceStore } from "../systems/store";
import { useAudioStore } from "../audio/player";
import { useLibraryStore } from "../systems/library";
import { useQuietMotion } from "../motion/useMotionCue";
import { motionEase } from "../motion/tokens";
import { acknowledge } from "./registry";

// 同一封面在迷你播放器与原面板间移动；原面板、焦点、播放时间与双槽音频完全不归此层所有。
export default function PlayerContinuity() {
  const quiet = useQuietMotion();
  useEffect(() => {
    let frame = 0, ghost: HTMLDivElement | undefined, animation: Animation | undefined;
    let source: DOMRect | undefined, cover = "", initiated = false;
    const cancel = () => { cancelAnimationFrame(frame); animation?.cancel(); ghost?.remove(); ghost = undefined; };
    const morph = (from: DOMRect, to: DOMRect) => {
      if (quiet || document.hidden || !cover || !from.width || !to.width) return;
      cancel();
      const node = document.createElement("div");
      node.className = "player-art-transfer"; node.setAttribute("aria-hidden", "true");
      const image = document.createElement("img"); image.src = cover; image.alt = ""; node.appendChild(image);
      Object.assign(node.style, { left: to.x + "px", top: to.y + "px", width: to.width + "px", height: to.height + "px" });
      document.body.appendChild(node); ghost = node;
      animation = node.animate([
        { transform: "translate(" + (from.x - to.x) + "px," + (from.y - to.y) + "px) scale(" + from.width / to.width + "," + from.height / to.height + ")", opacity: 0.92 },
        { transform: "none", opacity: 0 },
      ], { duration: 380, easing: motionEase.enter });
      animation.id = "palace:player-continuity";
      animation.onfinish = () => { node.remove(); if (ghost === node) ghost = undefined; };
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!target) return;
      if (target.classList.contains("now-playing-open")) {
        source = target.querySelector("img")?.getBoundingClientRect();
        const track = useLibraryStore.getState().music.find(t => t.id === useAudioStore.getState().currentId);
        cover = track?.displayCover || track?.cover || ""; initiated = true;
      }
      if (target.matches(".now-playing-action,.playback-controls .play-button")) {
        const before = useAudioStore.getState().playing;
        queueMicrotask(() => { if (before !== useAudioStore.getState().playing) acknowledge(before ? "Playback paused" : "Playback resumed"); });
      }
      if (target.getAttribute("aria-label")?.includes("bookmark room")) {
        const id = usePalaceStore.getState().roomId, before = usePalaceStore.getState().bookmarks.includes(id);
        queueMicrotask(() => { if (before !== usePalaceStore.getState().bookmarks.includes(id)) acknowledge(before ? "Room released" : "Room kept in your trail"); });
      }
    };
    document.addEventListener("click", click, true);
    const unsubscribe = usePalaceStore.subscribe((state, previous) => {
      if (state.overlay === "player" && previous.overlay !== "player" && initiated && source) {
        let retries = 0;
        const find = () => {
          const to = document.querySelector(".record-sleeve")?.getBoundingClientRect();
          if (to) morph(source!, to);
          else if (++retries < 12) frame = requestAnimationFrame(find);
        };
        frame = requestAnimationFrame(find);
      } else if (previous.overlay === "player" && state.overlay !== "player") {
        const from = document.querySelector(".record-sleeve")?.getBoundingClientRect();
        const to = document.querySelector(".now-playing-open img")?.getBoundingClientRect();
        cancel();
        if (initiated && from && to) morph(from, to);
        initiated = false;
      }
      if (state.roomId !== previous.roomId) { initiated = false; cancel(); }
    });
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { cancel(); unsubscribe(); document.removeEventListener("click", click, true); document.removeEventListener("visibilitychange", hidden); };
  }, [quiet]);
  return null;
}
