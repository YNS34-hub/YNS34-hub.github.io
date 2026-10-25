import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { imageDestinations } from "../systems/mediaPlacement";
type Draft = {
  file: File;
  audio: boolean;
  reading?: boolean;
  url?: string;
  title: string;
  info?: string;
  error?: string;
  done?: string;
};
const categories = [
  "horizon",
  "visual",
  "cosmic",
  "glass",
  "portrait",
  "editorial",
  "project",
  "research",
];
/** Files stay local. A placement refers to the stable resource ID instead of duplicating its blob. */
export default function MediaImport({ roomHint }: { roomHint?: string }) {
  const currentRoom = usePalaceStore((s) => s.roomId);
  const room = (roomHint || currentRoom).split("-page-")[0];
  const initial =
    room === "music"
      ? "music"
      : imageDestinations.some((x) => x[0] === room)
        ? room
        : "wallpapers";
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [target, setTarget] = useState(initial),
    [category, setCategory] = useState<string>(
      imageDestinations.find((x) => x[0] === initial)?.[3] || "visual",
    ),
    [primary, setPrimary] = useState(true),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    urls = useRef<string[]>([]),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      urls.current.forEach((x) => URL.revokeObjectURL(x));
    },
    [],
  );
  const stage = async (files: File[]) => {
    const version = ++generation.current;
    urls.current.forEach((x) => URL.revokeObjectURL(x));
    urls.current = [];
    const next = files.map((file) => {
      const audio = /\.(mp3|flac|wav|m4a|ogg|aac|opus)$/i.test(file.name),
        image = /\.(jpe?g|png|webp|avif)$/i.test(file.name);
      const url = image ? URL.createObjectURL(file) : undefined;
      if (url) urls.current.push(url);
      return {
        file,
        audio,
        reading: audio,
        url,
        title: file.name.replace(/\.[^.]+$/, ""),
        error: !audio && !image ? "Unsupported file type." : undefined,
      } as Draft;
    });
    setDrafts(next);
    if (next.some((x) => !x.audio) && target === "music") {
      setTarget("imagined-worlds");
      setCategory("visual");
    }
    for (const draft of next.filter((x) => x.audio)) {
      try {
        const { parseBlob } = await import("music-metadata");
        const meta = await parseBlob(draft.file, { duration: true });
        if (version !== generation.current) return;
        draft.title = meta.common.title || draft.title;
        draft.info = [
          meta.common.artist || "Unknown artist",
          meta.common.album,
          meta.format.duration
            ? Math.round(meta.format.duration) + " seconds"
            : undefined,
        ]
          .filter(Boolean)
          .join(" · ");
        const cover = meta.common.picture?.[0];
        if (cover) {
          draft.url = URL.createObjectURL(
            new Blob([new Uint8Array(cover.data)], { type: cover.format }),
          );
          urls.current.push(draft.url);
        }
      } catch {
        draft.info = "Untagged audio / title can be edited";
      }
      if (version === generation.current)
        setDrafts((current) =>
          current.map((x) =>
            x.file === draft.file
              ? {
                  ...x,
                  title: draft.title,
                  info: draft.info,
                  url: draft.url,
                  reading: false,
                }
              : x,
          ),
        );
    }
  };
  const confirm = async (only?: number) => {
    if (drafts.some((d) => d.reading)) return;
    setBusy(true);
    const destination =
      imageDestinations.find((x) => x[0] === target) || imageDestinations[1];
    const next = [...drafts];
    for (let i = 0; i < next.length; i++) {
      if ((only !== undefined && i !== only) || next[i].done) continue;
      const d = next[i];
      try {
        if (d.audio) {
          const library = useLibraryStore.getState(),
            old = new Set(library.music.map((x) => x.id));
          await library.importMusic([d.file]);
          const imported = useLibraryStore
            .getState()
            .music.find((x) => !old.has(x.id));
          if (!imported) throw new Error("This audio file was not supported.");
          await library.updateTrack(imported.id, {
            title: d.title,
            roomIds: [target === "wallpapers" ? "music" : target],
          });
          d.done = imported.id;
        } else {
          const result = await useLibraryStore
            .getState()
            .importImages([d.file], {
              kind: destination[2],
              category,
              roomIds: [target === "music" ? "imagined-worlds" : target],
              primary: primary && i === 0,
              order: i,
            });
          if (result[0]?.error) throw new Error(result[0].error);
          d.done = result[0].id;
          if (d.done)
            await useLibraryStore
              .getState()
              .updateImage(d.done, { title: d.title });
        }
        d.error = undefined;
      } catch (error) {
        d.error =
          error instanceof Error
            ? error.message
            : "This file could not be imported.";
      }
      setDrafts([...next]);
    }
    setBusy(false);
  };
  return (
    <div
      className="media-import"
      data-stage={!drafts.length ? "select" : drafts.some(d => d.reading) ? "recognize" : busy ? "placing" : drafts.every(d => d.done) ? "complete" : "arrange"}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy) void stage([...e.dataTransfer.files]);
      }}
    >
      <button
        className="text-button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Upload size={14} />
        IMPORT / PLACE IN A ROOM
      </button>
      <input
        ref={input}
        type="file"
        multiple
        className="visually-hidden"
        aria-label="Import files into a room"
        accept=".jpg,.jpeg,.png,.webp,.avif,.mp3,.flac,.wav,.m4a"
        onChange={(e) => {
          void stage([...(e.target.files || [])]);
          e.target.value = "";
        }}
      />
      {!drafts.length && (
        <small>
          Drop images or local audio here. Files stay in this browser.
        </small>
      )}
      {drafts.length > 0 && (
        <>
          <p className="import-process" role="status">{drafts.some(d => d.reading) ? "01 / Reading your files" : busy ? "03 / Placing in the room" : drafts.every(d => d.done) ? "04 / Ready to visit" : "02 / Choose a place"}<span>{drafts.filter(d => d.done).length} / {drafts.length}</span></p>
          <label>
            Target gallery
            <select
              aria-label="Target gallery"
              disabled={busy}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setCategory(
                  imageDestinations.find((x) => x[0] === e.target.value)?.[3] ||
                    "visual",
                );
              }}
            >
              {imageDestinations.map((x) => (
                <option key={x[0]} value={x[0]}>
                  {x[1]}
                </option>
              ))}
              <option value="music" disabled={drafts.some((x) => !x.audio)}>
                Listening Room (audio)
              </option>
            </select>
          </label>
          {drafts.some((x) => !x.audio) && (
            <>
              <label>
                Category
                <select
                  aria-label="Image category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="import-primary">
                <input
                  type="checkbox"
                  checked={primary}
                  onChange={(e) => setPrimary(e.target.checked)}
                />
                First image is the main work
              </label>
            </>
          )}
          <div className="import-drafts">
            {drafts.map((d, i) => (
              <article key={d.file.name + "-" + i} data-placed={!!d.done} data-failed={!!d.error}>
                {d.url ? (
                  <img src={d.url} alt="Import preview" />
                ) : (
                  <span>{d.audio ? "AUDIO" : "IMAGE"}</span>
                )}
                <label>
                  Title
                  <input
                    disabled={busy || d.reading}
                    value={d.title}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds.map((x, n) =>
                          n === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <small>
                  {d.info} · {(d.file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                  {d.reading
                    ? "Reading audio tags…"
                    : d.done
                      ? "Placed in your collection"
                      : d.error || "Ready"}
                </small>
                {d.error && (
                  <button
                    onClick={() => void confirm(i)}
                    disabled={busy || drafts.some((x) => x.reading)}
                  >
                    Retry this file
                  </button>
                )}
              </article>
            ))}
          </div>
          <button
            className="primary-action"
            disabled={busy || drafts.some((x) => x.reading)}
            onClick={() => void confirm()}
          >
            {busy ? "IMPORTING…" : "CONFIRM PLACEMENT"}
          </button>
          {drafts.some((d) => d.done) && (
            <button
              className="text-button"
              onClick={() => {
                const allAudio = drafts
                  .filter((x) => x.done)
                  .every((x) => x.audio);
                usePalaceStore
                  .getState()
                  .enterRoom(
                    allAudio && target === "wallpapers"
                      ? "music"
                      : !allAudio && target === "music"
                        ? "imagined-worlds"
                        : target,
                  );
              }}
            >
              SEE IN THE ROOM →
            </button>
          )}
        </>
      )}
    </div>
  );
}
