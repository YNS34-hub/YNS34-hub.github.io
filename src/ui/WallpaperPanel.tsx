import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, Expand, X } from "lucide-react";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import type { WallpaperItem } from "../content/types";
import "./collections.css";
import MediaImport from "./MediaImport";
import { worksForRoom, imageDestinations } from "../systems/mediaPlacement";

export default function WallpaperPanel({
  compact = false,
  galleryId,
}: {
  compact?: boolean;
  galleryId?: string;
}) {
  const wallpapers = useLibraryStore((state) => state.wallpapers);
  const visuals = useLibraryStore((state) => state.personal.visuals);
  const roomId = usePalaceStore((state) => state.roomId);
  const baseRoom = (galleryId || roomId).split("-page-")[0];
  const projects = useLibraryStore((s) => s.personal.projects),
    research = useLibraryStore((s) => s.personal.research);
  const images = worksForRoom(
    [...wallpapers, ...visuals, ...projects, ...research],
    baseRoom,
  );
  const removed = useLibraryStore((s) => s.removedImages);
  const [editing, setEditing] = useState<string | null>(null);
  const error = useLibraryStore((state) => state.error);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<WallpaperItem | null>(null);
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = fullscreenRef.current;
    node?.querySelector<HTMLButtonElement>("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (document.fullscreenElement) void document.exitFullscreen?.();
        setSelected(null);
      }
      if (event.key === "Tab") {
        const buttons = [
          ...(node?.querySelectorAll<HTMLButtonElement>("button") || []),
        ];
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    node?.addEventListener("keydown", closeOnEscape);
    const closeNative = () => {
      if (!document.fullscreenElement) setSelected(null);
    };
    document.addEventListener("fullscreenchange", closeNative);
    return () => {
      node?.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("fullscreenchange", closeNative);
      previous?.focus();
    };
  }, [selected]);
  const showFullscreen = (item: WallpaperItem) => {
    setSelected(item);
    setTimeout(() => {
      void fullscreenRef.current?.requestFullscreen?.().catch(() => undefined);
    }, 0);
  };
  const closeFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    setSelected(null);
  };
  const cinema = (item: WallpaperItem) => {
    usePalaceStore.getState().openCinema(item);
  };
  return (
    <section
      className={`wallpaper-collection ${compact ? "collection-compact" : ""}`}
      aria-label="Wallpaper archive"
    >
      <div className="collection-heading">
        <div>
          <p className="eyebrow">05 / THE VISUAL ARCHIVE</p>
          <h2>Images to inhabit.</h2>
        </div>
        <span className="collection-count">
          {String(images.length).padStart(2, "0")} WORKS
        </span>
      </div>
      <MediaImport roomHint={baseRoom} />
      {error && (
        <p role="status" className="collection-message">
          {error}
        </p>
      )}
      <div className={`visual-archive ${baseRoom === "editorial" && !editing ? "editorial-strip" : ""}`}>
        {images.map((item, index) => (
          <article className="visual-work" key={item.id}>
            <button
              className="visual-work-image"
              type="button"
              onClick={() => showFullscreen(item)}
              aria-label={`View ${item.title} fullscreen`}
            >
              <img
                src={item.displaySrc || item.src}
                alt={item.title}
                loading="lazy"
                decoding="async"
              />
              <span>
                <Expand size={15} /> VIEW ORIGINAL
              </span>
            </button>
            <div className="visual-caption">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>
                  {item.category} / {item.date}
                </small>
                {item.tags.length > 0 && (
                  <p className="work-tags">{item.tags.join(" · ")}</p>
                )}
              </div>
            </div>
            <div className="visual-actions">
              <button
                className="text-button"
                onClick={() => setEditing(editing === item.id ? null : item.id)}
              >
                ARRANGE WORK
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => cinema(item)}
              >
                ENTER WALLPAPER CINEMA <ArrowUpRight size={13} />
              </button>
              <a
                className="record-icon"
                href={item.src}
                download={
                  item.fileName ||
                  `${item.title.replace(/[<>:"/\\|?*]/g, "_")}.${item.src.split("?")[0].match(/\.(jpe?g|png|webp|avif)$/i)?.[1] || "png"}`
                }
                aria-label={`Download ${item.title}`}
              >
                <Download size={15} />
              </a>
              {/^https?:\/\//i.test(item.source) && (
                <a
                  className="record-icon"
                  href={item.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Image source for ${item.title}`}
                >
                  <ArrowUpRight size={15} />
                </a>
              )}
              {item.imported && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    void useLibraryStore.getState().removeWallpaper(item.id)
                  }
                >
                  REMOVE
                </button>
              )}
            </div>
            {editing === item.id && (
              <form
                className="work-placement"
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  const target = String(values.get("room"));
                  const dest = imageDestinations.find((x) => x[0] === target)!;
                  void useLibraryStore
                    .getState()
                    .updateImage(item.id, {
                      title: String(values.get("title")),
                      mediaKind: dest[2],
                      category: String(values.get("category")),
                      roomIds: [target],
                      order: Number(values.get("order")),
                      primary: values.get("primary") === "on",
                    })
                    .then(() => setEditing(null));
                }}
              >
                <label>
                  Title
                  <input name="title" defaultValue={item.title} />
                </label>
                <label>
                  Target gallery
                  <select
                    name="room"
                    defaultValue={item.roomIds?.[0] || baseRoom}
                  >
                    {imageDestinations.map((x) => (
                      <option key={x[0]} value={x[0]}>
                        {x[1]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <select name="category" defaultValue={item.category}>
                    {[
                      "horizon",
                      "visual",
                      "cosmic",
                      "glass",
                      "portrait",
                      "editorial",
                      "project",
                      "research",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    name="order"
                    defaultValue={item.order || 0}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="primary"
                    defaultChecked={item.primary}
                  />
                  Main work
                </label>
                <button className="text-button" type="submit">
                  SAVE ARRANGEMENT
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    void useLibraryStore
                      .getState()
                      .updateImage(item.id, { removed: true })
                  }
                >
                  REMOVE FROM DISPLAY
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
      {!images.length && (
        <p className="collection-empty">
          Begin with an image you would like to live inside.
        </p>
      )}
      {!!removed.length && (
        <details className="removed-works">
          <summary>Removed works / restore</summary>
          {removed.map((x) => (
            <button
              className="text-button"
              key={x.id}
              onClick={() =>
                void useLibraryStore
                  .getState()
                  .updateImage(x.id, { removed: false })
              }
            >
              RESTORE {x.title}
            </button>
          ))}
        </details>
      )}
      <p className="collection-note privacy-note">
        Original aspect ratios. Private imports. A place for images to breathe.
      </p>
      {selected && (
        <div
          className="image-fullscreen"
          ref={fullscreenRef}
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <button
            className="image-close"
            type="button"
            aria-label="Close fullscreen image"
            onClick={closeFullscreen}
          >
            <X size={23} />
          </button>
          <img src={selected.src} alt={selected.title} />
          <div className="image-fullscreen-caption">
            <div>
              <p className="eyebrow">THE VISUAL ARCHIVE</p>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <small>
                {selected.source} · {selected.date}
              </small>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                closeFullscreen();
                cinema(selected);
              }}
            >
              ENTER CINEMA →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
