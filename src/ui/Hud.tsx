import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowRight,
  Map,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Bookmark,
  Home,
  MousePointer2,
  Play,
  Pause,
} from "lucide-react";
import { roomInfo } from "../content/roomInfo";
import { resolveRoomPlan } from "../world/roomPlan";
import { usePalaceStore } from "../systems/store";
import { useAudioStore } from "../audio/player";
import { useLibraryStore } from "../systems/library";
import { PalaceMark } from "./primitives";
import { useIdentityTone } from "../systems/identityTone";
import { useMotionCue } from "../motion/useMotionCue";
export default function Hud({ ready }: { ready: boolean }) {
  const s = usePalaceStore();
  const audio = useAudioStore(
    useShallow((a) => ({
      currentId: a.currentId,
      playing: a.playing,
      toggle: a.toggle,
    })),
  );
  const tracks = useLibraryStore((l) => l.music);
  const lightIdentity = useIdentityTone((tone) => tone.light);
  const room = roomInfo(s.roomId);
  const plan = resolveRoomPlan(s.roomId);
  const track = tracks.find((t) => t.id === audio.currentId);
  const identityCue = useMotionCue<HTMLButtonElement>("museum-identity", "identity");
  const welcomeEnabled = ready && !s.started;
  const eyebrowCue = useMotionCue<HTMLParagraphElement>("welcome", "copy", welcomeEnabled);
  const heroCue = useMotionCue<HTMLHeadingElement>("welcome", "hero", welcomeEnabled, 60);
  const subtitleCue = useMotionCue<HTMLParagraphElement>("welcome", "copy", welcomeEnabled, 160);
  const entryCue = useMotionCue<HTMLDivElement>("welcome", "copy", welcomeEnabled, 240);
  const memoryCue = useMotionCue<HTMLElement>(String(s.memoryReveal), "copy", s.coreNear && !s.overlay && !s.focus);
  const trackCue = useMotionCue<HTMLSpanElement>(`${audio.currentId}:${track?.title}`, "copy", !!track && s.started);
  const playbackCue = useMotionCue<HTMLButtonElement>(String(audio.playing), "identity", !!track && s.started);
  const [tutorial, setTutorial] = useState(false);
  useEffect(() => {
    if (!s.started || s.tutorialDone) return;
    setTutorial(true);
    const timer = setTimeout(() => {
      setTutorial(false);
      s.update({ tutorialDone: true });
    }, 6500);
    return () => clearTimeout(timer);
  }, [s.started, s.tutorialDone, s.update]);
  const start = (continueLast = false) => {
    s.update({ started: true });
    s.enterRoom(continueLast ? s.lastRoom : s.roomId);
  };
  return (
    <div className={`hud ${s.started ? "is-exploring" : "is-welcome"}`}>
      <header className="hud-header">
        <button
          ref={identityCue}
          className={`wordmark ${lightIdentity ? "identity-is-light" : ""}`}
          onClick={() => s.setOverlay("about")}
          aria-label="About The Memory Palace"
        >
          <PalaceMark />
          <span>
            THE MEMORY PALACE<small>JIE TIAN · LIVING ARCHIVE</small>
          </span>
        </button>
        <div className="hud-header-actions">
          <button
            className="sound-button"
            aria-label={s.mute ? "Unmute all sound" : "Mute all sound"}
            onClick={() => s.update({ mute: !s.mute })}
          >
            {s.mute ? <VolumeX size={17} /> : <Volume2 size={17} />}
            <span>{s.mute ? "SOUND OFF" : "SOUND ON"}</span>
          </button>
          <button
            className="guide-button"
            onClick={() => s.setOverlay("guide")}
          >
            <Map size={17} />
            <span>GUIDE</span>
            <small>M</small>
          </button>
        </div>
      </header>
      {!s.started && (
        <div className="welcome-caption">
          <p className="eyebrow" ref={eyebrowCue}>
            <span className="status-dot" /> A DIGITAL MUSEUM BY JIE TIAN
          </p>
          <h1 ref={heroCue}>
            THE MEMORY
            <br />
            <span>PALACE</span>
            <sup>∞</sup>
          </h1>
          <p className="welcome-subtitle" ref={subtitleCue}>
            An infinite gallery of projects, research,
            <br className="desktop-break" /> music, images and experiments.
          </p>
          <div className="welcome-actions" ref={entryCue}>
            <button
              className="enter-button"
              disabled={!ready}
              onClick={() => start()}
            >
              {ready ? "ENTER THE PALACE" : "ARCHIVE INITIALIZING"}
              <ArrowRight size={22} />
            </button>
            {s.lastRoom !== "atrium" && (
              <button className="continue-button" onClick={() => start(true)}>
                CONTINUE EXPLORING ↗
              </button>
            )}
            <button
              className="text-button index-entry"
              onClick={() => s.update({ mode: "index", started: true })}
            >
              2D INDEX ↗
            </button>
          </div>
        </div>
      )}
      {s.started && (
        <>
          <div className="room-caption">
            <p className="eyebrow">
              <span className="room-caption-number">{room?.number || "∞"}</span>{" "}
              {room?.title || "A SECRET MEMORY"}
            </p>
            <p>
              {room?.subtitle || "Some places appear only after you remember."}
            </p>
            {(plan.type === "listening" ||
              plan.type === "image-gallery" ||
              s.roomId === "cinema") && (
              <button
                className="room-collection-button text-button"
                onClick={() => s.setOverlay("collection")}
              >
                OPEN COLLECTION <ArrowRight size={13} />
              </button>
            )}
          </div>
          <nav className="spatial-controls" aria-label="Spatial navigation">
            <button onClick={() => s.setOverlay("guide")}>
              <Map size={17} />
              <span>Guide</span>
              <kbd>M</kbd>
            </button>
            <span className="control-divider" />
            <button onClick={() => s.enterRoom("atrium")}>
              <Home size={17} />
              <span>Atrium</span>
            </button>
            <button
              aria-label={
                s.bookmarks.includes(s.roomId)
                  ? "Unbookmark room"
                  : "Bookmark room"
              }
              className={s.bookmarks.includes(s.roomId) ? "bookmarked" : ""}
              onClick={() => s.toggleBookmark(s.roomId)}
            >
              <Bookmark size={17} />
            </button>
            <button
              onClick={() => s.setOverlay("settings")}
              aria-label="Experience settings"
            >
              <SlidersHorizontal size={17} />
            </button>
          </nav>
          <div className="explore-controls">
            {s.pointerLocked ? (
              <span className="eyebrow">ESC — RELEASE VIEW</span>
            ) : (
              <button
                className="text-button"
                onClick={() => {
                  if (s.mode === "tour") {
                    s.setOverlay("guide");
                    return;
                  }
                  const canvas = document.querySelector("canvas");
                  try {
                    const p = canvas?.requestPointerLock();
                    p?.catch(() => {});
                  } catch {
                    /* Drag look remains available. */
                  }
                }}
              >
                <MousePointer2 size={15} />{" "}
                {s.mode === "tour" ? "QUICK TRAVEL" : "LOOK FREELY"}
              </button>
            )}
          </div>
        </>
      )}
      {!s.started && (
        <div className="welcome-location">
          <span>01 / THE ATRIUM</span>
          <span>THIS PLACE CONTINUES TO GROW WITH ME.</span>
        </div>
      )}
      {s.pointerLocked && !s.overlay && !s.focus && (
        <span className="view-point" aria-hidden="true" />
      )}
      {s.started && s.near && !s.overlay && !s.focus && (
        <div className="near-caption">
          <span className="near-marker" />
          <span>{s.near}</span>
          <small>CLICK TO EXPLORE</small>
        </div>
      )}
      {s.started && s.coreNear && !s.overlay && !s.focus && (
        <button
          className="core-information"
          onClick={() => s.update({ memoryReveal: !s.memoryReveal })}
        >
          <span className="eyebrow">MEMORY REVEAL / 记忆显影</span>
          <strong ref={memoryCue}>
            {s.memoryReveal ? "Return to stillness" : "Reveal the collection"}
          </strong>
          <span>Saved works or selected collection · ESC to skip</span>
          <ArrowRight size={18} />
        </button>
      )}
      {tutorial && (
        <div className="tutorial" role="status">
          {window.matchMedia("(pointer: coarse)").matches ? (
            "DRAG — LOOK · TAP FLOOR — MOVE · GUIDE — TRAVEL"
          ) : (
            <>
              <span>
                <kbd>W A S D</kbd> MOVE
              </span>
              <span>MOUSE — LOOK</span>
              <span>CLICK — INTERACT</span>
              <span>
                <kbd>M</kbd> GUIDE
              </span>
            </>
          )}
        </div>
      )}
      {track && s.started && (
        <div className="now-playing-tag" data-playing={audio.playing}>
          <button
            className="now-playing-open"
            onClick={() => s.setOverlay("player")}
          >
            {track.cover && (
              <img src={track.displayCover || track.cover} alt="" />
            )}
            <span ref={trackCue}>
              <small>
                {audio.playing ? "NOW PLAYING" : "ON THE TURNTABLE"}
              </small>
              <strong>{track.title}</strong>
            </span>
          </button>
          <button
            ref={playbackCue}
            className="now-playing-action"
            onClick={() => audio.toggle()}
            aria-label={audio.playing ? "Pause music" : "Play music"}
          >
            {audio.playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
