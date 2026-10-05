import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  ExternalLink,
  Upload,
  Disc3,
  Heart,
  Pencil,
  X,
} from "lucide-react";
import { useAudioStore } from "../audio/player";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import type { MusicTrack } from "../content/types";
import { rooms } from "../content/catalog";
import "./collections.css";
import { useShallow } from "zustand/react/shallow";

const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
interface MusicPanelProps {
  compact?: boolean;
}

export default function MusicPanel({ compact = false }: MusicPanelProps) {
  const tracks = useLibraryStore((state) => state.music);
  const libraryError = useLibraryStore((state) => state.error);
  const player = useAudioStore(
    useShallow((s) => ({
      currentId: s.currentId,
      playing: s.playing,
      progress: s.progress,
      duration: s.duration,
      shuffle: s.shuffle,
      repeat: s.repeat,
      crossfade: s.crossfade,
      error: s.error,
      play: s.play,
      pause: s.pause,
      toggle: s.toggle,
      previous: s.previous,
      next: s.next,
      seek: s.seek,
      setShuffle: s.setShuffle,
      setRepeat: s.setRepeat,
      setCrossfade: s.setCrossfade,
    })),
  );
  const volume = usePalaceStore((state) => state.musicVolume);
  const muted = usePalaceStore((state) => state.mute);
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MusicTrack | null>(null);
  const current = tracks.find((track) => track.id === player.currentId);
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);

  const importFiles = async (
    event: ChangeEvent<HTMLInputElement>,
    pair?: MusicTrack,
  ) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setImporting(true);
    try {
      if (pair) {
        const pairedId = await useLibraryStore
          .getState()
          .pairAudio(pair.id, files[0]);
        if (pairedId)
          setEditing(
            useLibraryStore
              .getState()
              .music.find((track) => track.id === pairedId) || null,
          );
      } else await useLibraryStore.getState().importMusic(files);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to import this file.",
      );
    }
    setImporting(false);
    event.target.value = "";
  };
  const addLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await useLibraryStore
        .getState()
        .addNetEase(
          String(data.get("url")),
          String(data.get("title")),
          String(data.get("artist")),
        );
      setShowLink(false);
      setFormError(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save this share link.",
      );
    }
  };
  const saveMetadata = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    try {
      await useLibraryStore.getState().updateTrack(editing.id, {
        title: String(data.get("title")),
        artist: String(data.get("artist")),
        album: String(data.get("album")),
        roomIds: data.getAll("rooms").map(String),
        year: String(data.get("year")),
        url: String(data.get("url")) || undefined,
      });
      setEditing(null);
      setFormError(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to update this track.",
      );
    }
  };
  const importArtwork = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editing) return;
    try {
      await useLibraryStore.getState().setArtwork(editing.id, file);
      setEditing(
        useLibraryStore
          .getState()
          .music.find((track) => track.id === editing.id) || null,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to read this album image.",
      );
    }
    event.target.value = "";
  };

  return (
    <section
      className={`music-collection ${compact ? "collection-compact" : ""}`}
      aria-label="Listening room collection"
    >
      <div className="collection-heading">
        <div>
          <p className="eyebrow">04 / THE LISTENING ROOM</p>
          <h2>A room for listening.</h2>
        </div>
        <Disc3 size={26} strokeWidth={1} aria-hidden="true" />
      </div>
      <div className="listening-console">
        <div className="record-sleeve">
          {current?.cover ? (
            <img
              src={current.displayCover || current.cover}
              alt={`${current.album} album artwork`}
            />
          ) : (
            <div
              className={`record-disc ${player.playing ? "is-playing" : ""}`}
            >
              <span />
            </div>
          )}
        </div>
        <div className="record-information">
          <p className="eyebrow">
            {player.playing ? "NOW PLAYING" : "READY WHEN YOU ARE"}
          </p>
          <h3>{current?.title || "Your private soundtrack"}</h3>
          <p>
            {current
              ? `${current.artist}${current.album ? ` · ${current.album}` : ""}`
              : "Import a song. Give the room a memory."}
          </p>
          <div className="playback-controls">
            <button
              type="button"
              className={player.shuffle ? "is-active" : ""}
              aria-label="Shuffle"
              aria-pressed={player.shuffle}
              onClick={() => player.setShuffle(!player.shuffle)}
            >
              <Shuffle size={17} />
            </button>
            <button
              type="button"
              aria-label="Previous track"
              onClick={player.previous}
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              className="play-button"
              aria-label={player.playing ? "Pause music" : "Play music"}
              onClick={player.toggle}
            >
              {player.playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <button type="button" aria-label="Next track" onClick={player.next}>
              <SkipForward size={18} />
            </button>
            <button
              type="button"
              className={player.repeat !== "off" ? "is-active" : ""}
              aria-label={`Repeat: ${player.repeat}`}
              aria-pressed={player.repeat !== "off"}
              onClick={() =>
                player.setRepeat(
                  player.repeat === "off"
                    ? "all"
                    : player.repeat === "all"
                      ? "one"
                      : "off",
                )
              }
            >
              <Repeat size={17} />
              {player.repeat === "one" && <sup>1</sup>}
            </button>
          </div>
          <div className="playback-progress">
            <span>{timeLabel(player.progress)}</span>
            <input
              type="range"
              min="0"
              max={Math.max(1, player.duration)}
              step="0.1"
              value={Math.min(player.progress, player.duration || 1)}
              aria-label="Track progress"
              onChange={(event) => player.seek(Number(event.target.value))}
            />
            <span>{timeLabel(player.duration)}</span>
          </div>
        </div>
      </div>
      <div className="listening-options">
        <label>
          <Volume2 size={15} /> <span>VOLUME</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            aria-label="Music volume"
            onChange={(event) =>
              usePalaceStore.getState().update({
                musicVolume: Number(event.target.value),
                mute: false,
              })
            }
          />
        </label>
        <label>
          <span>CROSSFADE</span>
          <select
            aria-label="Crossfade duration"
            value={player.crossfade}
            onChange={(event) =>
              player.setCrossfade(Number(event.target.value))
            }
          >
            <option value="0">Off</option>
            <option value="2.5">2.5s</option>
            <option value="5">5s</option>
            <option value="8">8s</option>
          </select>
        </label>
      </div>
      <div className="collection-actions">
        <button
          type="button"
          className="text-button"
          onClick={() => importRef.current?.click()}
          disabled={importing}
        >
          <Upload size={14} />
          {importing
            ? "READING COLLECTION…"
            : "IMPORT MUSIC / RECONNECT LIBRARY"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setShowLink(!showLink);
            setFormError(null);
          }}
        >
          + NETEASE LINK
        </button>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          multiple
          accept=".mp3,.m4a,.ogg,.wav,.flac,.aac,.opus,audio/*"
          aria-label="Import local audio files"
          onChange={(event) => void importFiles(event)}
        />
      </div>
      {showLink && (
        <form
          className="collection-form"
          onSubmit={(event) => void addLink(event)}
        >
          <label>
            Official share URL
            <input
              name="url"
              type="url"
              required
              placeholder="https://music.163.com/#/song?id=…"
            />
          </label>
          <div className="form-columns">
            <label>
              Title
              <input name="title" placeholder="Song, playlist or album" />
            </label>
            <label>
              Artist
              <input name="artist" placeholder="Artist" />
            </label>
          </div>
          <p className="collection-note">
            Links open on NetEase. Audio is played through a local file you own.
          </p>
          <button className="text-button" type="submit">
            SAVE TO COLLECTION →
          </button>
        </form>
      )}
      {(formError || player.error || libraryError) && (
        <p className="collection-message" role="status">
          {formError || player.error || libraryError}
        </p>
      )}
      <div className="record-list" role="list" aria-label="Music collection">
        {tracks.map((track, index) => (
          <article
            key={track.id}
            className={`record-row ${track.id === player.currentId ? "is-current" : ""}`}
            role="listitem"
          >
            <span className="record-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <button
              className="record-title"
              type="button"
              onClick={() => {
                if (track.src) void player.play(track.id);
                else setEditing(track);
              }}
            >
              <span>{track.title}</span>
              <small>
                {track.artist} ·{" "}
                {track.source === "netease" ? "OFFICIAL LINK" : track.album}
              </small>
            </button>
            <button
              type="button"
              className={`record-icon ${track.favorite ? "is-active" : ""}`}
              aria-label={`${track.favorite ? "Unfavorite" : "Favorite"} ${track.title}`}
              aria-pressed={track.favorite}
              onClick={() =>
                void useLibraryStore
                  .getState()
                  .updateTrack(track.id, { favorite: !track.favorite })
              }
            >
              <Heart size={15} />
            </button>
            {track.url && (
              <a
                className="record-icon"
                href={track.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${track.title} on NetEase`}
              >
                <ExternalLink size={15} />
              </a>
            )}
            <button
              className="record-icon"
              type="button"
              aria-label={`Edit ${track.title}`}
              onClick={() => {
                setEditing(track);
                setFormError(null);
              }}
            >
              <Pencil size={14} />
            </button>
          </article>
        ))}
      </div>
      {!tracks.length && (
        <p className="collection-empty">
          The shelves are waiting for your first record.
        </p>
      )}
      {editing && (
        <form
          className="collection-form metadata-form"
          onSubmit={(event) => void saveMetadata(event)}
          key={editing.id}
        >
          <div className="form-caption">
            <p className="eyebrow">RECORD NOTES</p>
            <button
              type="button"
              className="record-icon"
              aria-label="Close record editor"
              onClick={() => setEditing(null)}
            >
              <X size={17} />
            </button>
          </div>
          <label>
            Title
            <input name="title" defaultValue={editing.title} required />
          </label>
          <div className="form-columns">
            <label>
              Artist
              <input name="artist" defaultValue={editing.artist} />
            </label>
            <label>
              Album
              <input name="album" defaultValue={editing.album} />
            </label>
          </div>
          <div className="form-columns">
            <label>
              Year
              <input name="year" defaultValue={editing.year} />
            </label>
            <label>
              NetEase share URL
              <input
                name="url"
                defaultValue={editing.url}
                placeholder="Optional official link"
              />
            </label>
          </div>
          <label className="artwork-import">
            ROOM SOUNDTRACK
            <select
              name="rooms"
              multiple
              defaultValue={editing.roomIds || []}
              aria-label="Play in rooms"
            >
              {rooms
                .filter((room) => !room.hidden && room.id !== "cinema")
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.title}
                  </option>
                ))}
            </select>
            <small>
              Select the spaces that belong to this song. Ctrl-click to select
              several.
            </small>
          </label>
          <label className="artwork-import">
            LOCAL ALBUM ART
            {editing.cover && (
              <img
                src={editing.displayCover || editing.cover}
                alt="Current album artwork"
              />
            )}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.avif"
              aria-label="Import local album art"
              onChange={(event) => void importArtwork(event)}
            />
            <small>Stored with this record, only in your browser.</small>
          </label>
          <div className="collection-actions">
            <button className="text-button" type="submit">
              SAVE NOTES →
            </button>
            {editing.source !== "static" && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  void useLibraryStore.getState().removeMusic(editing.id);
                  setEditing(null);
                }}
              >
                REMOVE
              </button>
            )}
          </div>
          {editing.source === "netease" && (
            <label className="pair-audio">
              PAIR WITH LOCAL AUDIO
              <input
                type="file"
                accept=".mp3,.m4a,.ogg,.wav,.flac,audio/*"
                onChange={(event) => void importFiles(event, editing)}
              />
              <small>The paired local record stays on this device.</small>
            </label>
          )}
        </form>
      )}
      <p className="collection-note privacy-note">
        Your imports stay in this browser. No account. No uploads.
      </p>
    </section>
  );
}
