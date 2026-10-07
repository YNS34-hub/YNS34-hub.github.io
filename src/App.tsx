import {
  Suspense,
  lazy,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import { usePalaceStore } from "./systems/store";
import { useLibraryStore } from "./systems/library";
import { useAudioStore } from "./audio/player";
import { resolveRoomPlan } from "./world/roomPlan";
import Hud from "./ui/Hud";
import Guide from "./ui/Guide";
import Settings from "./ui/Settings";
import About from "./ui/About";
import Focus from "./ui/Focus";
import IndexView from "./ui/IndexView";
import MusicPanel from "./ui/MusicPanel";
import WallpaperPanel from "./ui/WallpaperPanel";
import CinemaControls from "./ui/CinemaControls";
import LyricsProjection from "./ui/LyricsProjection";
import { Dialog } from "./ui/primitives";
import { AudioSystem } from "./audio/AudioSystem";
// 交互扩展开始 app-import
import InteractionHud from "./interaction/InteractionHud";
const ActivityHud = lazy(() => import("./worlds/ActivityHud"));
// 交互扩展结束
const World = lazy(() => import("./world/World"));
class WorldBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function RouteSync() {
  useEffect(() => {
    const route = () => {
      usePalaceStore
        .getState()
        .syncRoute(window.location.pathname, window.location.search);
    };
    route();
    window.addEventListener("popstate", route);
    return () => window.removeEventListener("popstate", route);
  }, []);
  return null;
}
export default function App() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const host = window as Window & { __PALACE_DEV__?: unknown };
    host.__PALACE_DEV__ = {
      state: usePalaceStore,
      library: useLibraryStore,
      audio: useAudioStore,
    };
    return () => {
      delete host.__PALACE_DEV__;
    };
  }, []);
  const s = usePalaceStore();
  const [ready, setReady] = useState(false);
  const [contextError, setContextError] = useState(false);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        s.setOverlay(s.overlay === "guide" ? null : "guide");
      }
      if (e.key === "Escape") {
        if (e.defaultPrevented || s.roomId === "cinema") return;
        if (s.focus) s.focusItem(null);
        else if (s.overlay) s.setOverlay(null);
        else if (s.memoryReveal) s.update({ memoryReveal: false });
        else if (s.pendingDoor) s.update({ pendingDoor: null });
        else if (document.pointerLockElement) document.exitPointerLock();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [s]);
  useEffect(() => {
    document.documentElement.dataset.motion = s.reducedMotion
      ? "reduced"
      : "full";
  }, [s.reducedMotion]);
  useEffect(() => {
    setReady(false);
  }, [s.roomId]);
  const plan = resolveRoomPlan(s.roomId);
  const dark = plan.dark;
  const visualCollection = plan.type !== "listening";
  useEffect(() => {
    const title =
      s.focus?.title ||
      (s.started && s.roomId !== "atrium" ? plan.title : "Jie Tian");
    document.title = `${title} — The Memory Palace`;
    const description =
      s.focus?.subtitle ||
      (s.roomId !== "atrium"
        ? plan.subtitle
        : "Enter Jie Tian's growing digital museum of nonlinear mathematics, projects, research, music, images and unfinished futures.");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", description);
  }, [s.focus, s.roomId, s.started, plan.title, plan.subtitle]);
  return (
    <div
      className={`palace-app ${dark ? "dark-room" : ""} ${ready ? "world-ready" : ""} ${s.roomId === "cinema" ? "is-cinema" : ""} ${s.roomId === "unfinished" ? "is-unfinished" : ""}`}
      style={
        {
          "--room-accent":
            s.roomId === "music"
              ? "#d3a677"
              : s.roomId === "archive"
                ? "#b9c2a6"
                : "#91bdd6",
        } as import("react").CSSProperties
      }
    >
      <RouteSync />
      <AudioSystem />
      {/* 交互扩展开始 app-hud */}
      <InteractionHud />
      {["basketball", "cycling"].includes(s.roomId) && <Suspense fallback={null}><ActivityHud /></Suspense>}
      {/* 交互扩展结束 */}
      {s.mode === "index" ? (
        <IndexView />
      ) : (
        <>
          <div
            className="world-stage"
            aria-label="Interactive three-dimensional memory palace"
          >
            <WorldBoundary
              onError={() => {
                setContextError(true);
                s.update({ mode: "index" });
              }}
            >
              <Suspense
                fallback={
                  <div className="real-loading">
                    <span className="loading-orbit" />
                    <p>LOADING ROOM GEOMETRY</p>
                  </div>
                }
              >
                <World onReady={() => setReady(true)} />
              </Suspense>
            </WorldBoundary>
            {s.roomId === "music" && <LyricsProjection />}
          </div>
          <div className="world-reveal" aria-hidden="true" />
          {!ready && (
            <div className="room-loading" role="status">
              Preparing visible works…
            </div>
          )}
          <Hud ready={ready} />
          {s.roomId === "cinema" && <CinemaControls />}
        </>
      )}
      {s.overlay === "guide" && <Guide />}
      {s.overlay === "settings" && <Settings />}
      {s.overlay === "about" && <About />}
      {(s.overlay === "collection" || s.overlay === "player") && (
        <Dialog
          label={
            s.overlay !== "player" && visualCollection
              ? "Visual collection"
              : "Listening collection"
          }
          className="collection-panel"
          onClose={() => s.setOverlay(null)}
        >
          {s.overlay !== "player" && visualCollection ? (
            <WallpaperPanel />
          ) : (
            <MusicPanel />
          )}
        </Dialog>
      )}
      {s.focus && <Focus key={s.focus.id} />}
      {contextError && (
        <div className="context-note" role="status">
          This browser cannot render the palace. The complete collection is
          available here.
          <button onClick={() => setContextError(false)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
