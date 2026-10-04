import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ContentItem, WallpaperItem } from "../content/types";
import { allContent, rooms } from "../content/catalog";
export type Quality = "auto" | "high" | "medium" | "low";
export type Mode = "explore" | "tour" | "index";
export type Overlay =
  | "guide"
  | "settings"
  | "about"
  | "collection"
  | "player"
  | null;
interface PalaceState {
  roomId: string;
  lastRoom: string;
  started: boolean;
  mode: Mode;
  overlay: Overlay;
  focus: ContentItem | null;
  near: string | null;
  quality: Quality;
  effectiveQuality: Exclude<Quality, "auto">;
  reducedMotion: boolean;
  sensitivity: number;
  mute: boolean;
  musicVolume: number;
  ambientVolume: number;
  uiVolume: number;
  visits: Record<string, number>;
  viewed: string[];
  recent: string[];
  bookmarks: string[];
  tutorialDone: boolean;
  travelSequence: number;
  cinemaImage: WallpaperItem | null;
  fps: number;
  coreNear: boolean;
  pointerLocked: boolean;
  enterRoom: (id: string) => void;
  setOverlay: (value: Overlay) => void;
  focusItem: (item: ContentItem | null) => void;
  update: (state: Partial<PalaceState>) => void;
  toggleBookmark: (id: string) => void;
  syncRoute: (pathname: string, search?: string) => void;
}
export function contentRoom(item: ContentItem): string {
  return {
    project: "projects",
    research: "research",
    experiment: "experiments",
    archive: "archive",
  }[item.category];
}
export function roomPath(id: string): string {
  return id === "atrium" ? "/" : `/${encodeURIComponent(id)}`;
}
export function resolvePalaceRoute(pathname: string, search = "") {
  let path: string[];
  try {
    path = decodeURIComponent(pathname).split("/").filter(Boolean);
  } catch {
    path = [];
  }
  const index = new URLSearchParams(search).get("view") === "index";
  const procedural =
    /^(?:(?:projects|research|experiments|archive|wallpapers|imagined-worlds|cosmic|glass-life|portraits)-page-\d{1,6}|anomaly-(?:mirror|gravity|floating|compressing|impossible|loop))$/.test(
      path[0] || "",
    );
  const exhibit = allContent.some((item) => `exhibit-${item.id}` === path[0]);
  const roomId =
    rooms.find((room) => room.id === path[0])?.id ||
    (procedural || exhibit ? path[0] : "atrium");
  const about = path[0] === "about";
  const focus =
    path.length === 2
      ? allContent.find(
          (item) => item.id === path[1] && contentRoom(item) === roomId,
        ) || null
      : null;
  return { roomId, focus, index, about, entered: !!path.length };
}
function routeURL(path: string, mode: Mode) {
  return `${path}${mode === "index" ? "?view=index" : ""}`;
}
function unlockPointer() {
  if (typeof document !== "undefined") document.exitPointerLock?.();
}
const coarse =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
export const usePalaceStore = create<PalaceState>()(
  persist(
    (set) => ({
      roomId: "atrium",
      lastRoom: "atrium",
      started: false,
      mode: coarse ? "tour" : "explore",
      overlay: null,
      focus: null,
      near: null,
      quality: "auto",
      effectiveQuality: coarse ? "low" : "medium",
      reducedMotion:
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      sensitivity: 0.65,
      mute: false,
      musicVolume: 0.65,
      ambientVolume: 0.12,
      uiVolume: 0.18,
      visits: {},
      viewed: [],
      recent: [],
      bookmarks: [],
      tutorialDone: false,
      travelSequence: 0,
      cinemaImage: null,
      fps: 60,
      coreNear: false,
      pointerLocked: false,
      enterRoom: (id) => {
        unlockPointer();
        set((s) => ({
          roomId: id,
          lastRoom: id,
          overlay: null,
          focus: null,
          near: null,
          visits: { ...s.visits, [id]: (s.visits[id] || 0) + 1 },
          recent: [id, ...s.recent.filter((x) => x !== id)].slice(0, 8),
          travelSequence: s.travelSequence + 1,
          coreNear: false,
        }));
        if (typeof window !== "undefined")
          window.history.pushState(
            {},
            "",
            routeURL(roomPath(id), usePalaceStore.getState().mode),
          );
      },
      setOverlay: (overlay) => {
        unlockPointer();
        set({ overlay });
      },
      focusItem: (focus) => {
        unlockPointer();
        set((s) => ({
          focus,
          viewed: focus ? [...new Set([...s.viewed, focus.id])] : s.viewed,
        }));
        if (typeof window !== "undefined") {
          const state = usePalaceStore.getState();
          const path = focus
            ? `/${contentRoom(focus)}/${encodeURIComponent(focus.id)}`
            : roomPath(state.roomId);
          window.history.replaceState({}, "", routeURL(path, state.mode));
        }
      },
      update: (state) => {
        set(state);
        if (state.mode && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (state.mode === "index") url.searchParams.set("view", "index");
          else url.searchParams.delete("view");
          window.history.replaceState(
            {},
            "",
            `${url.pathname}${url.search}${url.hash}`,
          );
        }
      },
      toggleBookmark: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(id)
            ? s.bookmarks.filter((x) => x !== id)
            : [...s.bookmarks, id],
        })),
      syncRoute: (pathname, search = "") => {
        const route = resolvePalaceRoute(pathname, search);
        unlockPointer();
        set((s) => ({
          roomId: route.roomId,
          focus: route.focus,
          near: null,
          overlay: route.about ? "about" : null,
          mode: route.index
            ? "index"
            : s.mode === "index"
              ? coarse
                ? "tour"
                : "explore"
              : s.mode,
          ...(route.entered || route.index ? { started: true } : {}),
          ...(route.entered
            ? {
                lastRoom: route.roomId,
                visits: {
                  ...s.visits,
                  [route.roomId]: (s.visits[route.roomId] || 0) + 1,
                },
                recent: [
                  route.roomId,
                  ...s.recent.filter((id) => id !== route.roomId),
                ].slice(0, 8),
              }
            : {}),
          viewed: route.focus
            ? [...new Set([...s.viewed, route.focus.id])]
            : s.viewed,
          travelSequence: s.travelSequence + 1,
        }));
      },
    }),
    {
      name: "memory-palace:v3",
      partialize: (s) => ({
        lastRoom: s.lastRoom,
        quality: s.quality,
        reducedMotion: s.reducedMotion,
        sensitivity: s.sensitivity,
        mute: s.mute,
        musicVolume: s.musicVolume,
        ambientVolume: s.ambientVolume,
        uiVolume: s.uiVolume,
        visits: s.visits,
        viewed: s.viewed,
        recent: s.recent,
        bookmarks: s.bookmarks,
        tutorialDone: s.tutorialDone,
      }),
    },
  ),
);
