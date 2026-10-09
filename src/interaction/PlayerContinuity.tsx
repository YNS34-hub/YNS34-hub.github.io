import { useEffect } from "react";
import { usePalaceStore } from "../systems/store";
import { useAudioStore } from "../audio/player";
import { useLibraryStore } from "../systems/library";
import { useQuietMotion } from "../motion/useMotionCue";
import { motionEase, motionTime } from "../motion/tokens";
import { acknowledge } from "./registry";

// 同一封面在迷你播放器与原面板间移动；原面板、焦点、播放时间与双槽音频完全不归此层所有。
export default function PlayerContinuity() {
  const quiet = useQuietMotion();
  useEffect(() => {
    let frame = 0, ghost: HTMLDivElement | undefined, animation: Animation | undefined;
    let source: DOMRect | undefined, cover = "", initiated = false;
    const anchors = [
      [".now-playing-open strong", ".record-information h3"],
      [".now-playing-action", ".playback-controls .play-button"],
      [".mini-progress", ".playback-progress input"],
    ];
    let captured: ({ box: DOMRect; node: HTMLElement } | undefined)[] = [];
    const flights = new Set<Animation>(), copies = new Set<HTMLElement>();
    const cancel = () => { cancelAnimationFrame(frame); animation?.cancel(); ghost?.remove(); ghost = undefined; flights.forEach(a => a.cancel()); flights.clear(); copies.forEach(n => n.remove()); copies.clear(); };
    const capture = (full: boolean) => anchors.map(pair => {
      const node = document.querySelector<HTMLElement>(pair[full ? 1 : 0]);
      if (!node) return undefined;
      const copy = node.cloneNode(true) as HTMLElement, css = getComputedStyle(node);
      copy.removeAttribute("id"); copy.removeAttribute("aria-label"); copy.setAttribute("aria-hidden", "true"); copy.tabIndex = -1;
      Object.assign(copy.style, { font: css.font, color: css.color, background: css.background, border: css.border, display: "flex", alignItems: "center", whiteSpace: "nowrap", margin: "0", padding: "0" });
      return { box: node.getBoundingClientRect(), node: copy };
    });
    const moveAnchors = (full: boolean, origins = captured) => {
      if (quiet || document.hidden) return;
      anchors.forEach((pair, i) => {
        const origin = origins[i], target = document.querySelector<HTMLElement>(pair[full ? 1 : 0]);
        if (!origin || !target) return;
        const to = target.getBoundingClientRect(), from = origin.box, node = origin.node;
        if (!to.width || !from.width) return;
        node.className = "player-anchor-transfer";
        Object.assign(node.style, { left: to.x + "px", top: to.y + "px", width: to.width + "px", height: to.height + "px" });
        document.body.appendChild(node); copies.add(node);
        const a = node.animate([
          { transform: `translate(${from.x-to.x}px,${from.y-to.y}px) scale(${from.width/to.width},${from.height/to.height})`, opacity: .85 },
          { transform: "none", opacity: .85, offset: .84 }, { transform: "none", opacity: 0 },
        ], { duration: motionTime.layout, easing: motionEase.enter });
        a.id = "palace:player-anchor"; flights.add(a);
        a.onfinish = () => { flights.delete(a); copies.delete(node); node.remove(); };
      });
    };
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
      ], { duration: motionTime.layout, easing: motionEase.enter });
      animation.id = "palace:player-continuity";
      animation.onfinish = () => { node.remove(); if (ghost === node) ghost = undefined; };
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!target) return;
      if (target.classList.contains("now-playing-open")) {
        source = target.querySelector("img")?.getBoundingClientRect() || target.getBoundingClientRect();
        captured = capture(false);
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
          if (!initiated || usePalaceStore.getState().overlay !== "player") return;
          const to = document.querySelector(".record-sleeve")?.getBoundingClientRect();
          if (to) { morph(source!, to); moveAnchors(true); }
          else if (++retries < 12) frame = requestAnimationFrame(find);
        };
        frame = requestAnimationFrame(find);
      } else if (previous.overlay === "player" && state.overlay !== "player") {
        const from = document.querySelector(".record-sleeve")?.getBoundingClientRect();
        const to = document.querySelector(".now-playing-open img")?.getBoundingClientRect();
        const origins = capture(true);
        cancel();
        if (initiated && from && to) morph(from, to);
        if (initiated) moveAnchors(false, origins);
        initiated = false;
      }
      if (state.roomId !== previous.roomId) { initiated = false; cancel(); }
    });
    const audioChanges = useAudioStore.subscribe((state, previous) => { if (state.currentId !== previous.currentId) { initiated = false; cancel(); } });
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { cancel(); unsubscribe(); audioChanges(); document.removeEventListener("click", click, true); document.removeEventListener("visibilitychange", hidden); };
  }, [quiet]);
  return null;
}
