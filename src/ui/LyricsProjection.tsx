import { memo, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAudioStore } from "../audio/player";
import { lyricIndex } from "../audio/lyrics.mjs";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { lyricProjection } from "../systems/spatialLyrics";
import type { TrackLyrics } from "../audio/lyrics.mjs";

const LyricDocument = memo(function LyricDocument({ lyrics, index }: { lyrics: TrackLyrics; index: number }) {
  const previous = useRef({ lyrics, index });
  const snap = previous.current.lyrics !== lyrics || index < previous.current.index || index - previous.current.index > 1;
  useEffect(() => { previous.current = { lyrics, index }; }, [lyrics, index]);
  if (!lyrics.synced) return <div className="lyric-untimed" tabIndex={0} data-reading="true" onKeyDown={event => {
    const reader = event.currentTarget;
    if (event.key === "Escape") { reader.blur(); event.stopPropagation(); return; }
    const delta = { ArrowDown: 45, ArrowUp: -45, PageDown: reader.clientHeight * 0.8, PageUp: -reader.clientHeight * 0.8 }[event.key];
    if (delta !== undefined || event.key === "Home" || event.key === "End") {
      event.preventDefault(); event.stopPropagation();
      reader.scrollTop = event.key === "Home" ? 0 : event.key === "End" ? reader.scrollHeight : reader.scrollTop + delta!;
    } else if (/^(?:[wasd]|Arrow(?:Left|Right)|Shift)$/i.test(event.key)) event.stopPropagation();
  }}>{lyrics.lines.map((line, i) => <p key={i}>{line.text}</p>)}</div>;
  const first = Math.max(0, index - 3);
  return (
    <div className="lyric-viewport" aria-live="off">
      <div className="lyric-roll" style={{ transform: `translateY(${82.5 - Math.max(0, index) * 70}px)`, transition: snap ? "none" : undefined }}>
        {lyrics.lines.slice(first, Math.max(4, index + 4)).map((line, i) => <p key={first + i} style={{ top: (first + i) * 70 }} className={`lyric-line ${first + i === index ? "is-current" : ""}`}>{line.text}</p>)}
      </div>
    </div>
  );
});

/** A camera-matched lyric surface in the same DOM tree as the rest of the interface. */
export default function LyricsProjection() {
  const root = useRef<HTMLDivElement>(null), camera = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null);
  const tracks = useLibraryStore((s) => s.music);
  const { currentId, progress, playing } = useAudioStore(useShallow((s) => ({ currentId: s.currentId, progress: s.progress, playing: s.playing })));
  const reduced = usePalaceStore((s) => s.reducedMotion);
  const track = tracks.find(t => t.id === currentId), lyrics = track?.lyrics;
  const index = lyricIndex(lyrics, progress, track?.lyricsOffset || 0);
  useEffect(() => {
    const element = root.current;
    lyricProjection.root = element; lyricProjection.camera = camera.current; lyricProjection.surface = surface.current;
    return () => { if (lyricProjection.root === element) { lyricProjection.root = null; lyricProjection.camera = null; lyricProjection.surface = null; } };
  }, []);
  return (
    <div className="lyrics-projection" ref={root}>
      <div className="lyrics-projection-camera" ref={camera}>
        <div className="lyrics-projection-surface" ref={surface}>
          <div className="lyric-wall" data-track={track?.id || ""} data-line={index} data-playing={playing} data-reduced={reduced} aria-label="Listening room lyric wall">
            <div className="lyric-heading"><span>WORDS / {lyrics?.synced ? "SYNCHRONIZED" : lyrics ? "UNTIMED" : "LOCAL COLLECTION"}</span><span>{playing ? "PLAYING" : "STILL"}</span></div>
            {track && <div className="lyric-current-track"><p>{track.title}</p><span>{track.artist}{track.album ? ` · ${track.album}` : ""}</span></div>}
            {lyrics ? (
              <LyricDocument lyrics={lyrics} index={index} />
            ) : (
              <div className="lyric-empty"><p>{track ? "A room for this song." : "A place for words and silence."}</p><small>{track ? "No lyrics in this local recording." : "Choose a song from your listening collection."}</small><button onClick={() => usePalaceStore.getState().setOverlay("player")}>{track ? "IMPORT LOCAL LRC →" : "OPEN LISTENING COLLECTION →"}</button></div>
            )}
            <div className="lyric-footnote">{lyrics?.source || "Files and lyrics stay on this device."}{lyrics && !lyrics.synced ? " · Scroll to read" : lyrics ? " · Following the recording" : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
