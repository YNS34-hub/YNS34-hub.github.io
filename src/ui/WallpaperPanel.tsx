import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowUpRight, Download, Expand, Upload, X } from "lucide-react";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import type { WallpaperItem } from "../content/types";
import "./collections.css";

export default function WallpaperPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const wallpapers = useLibraryStore((state) => state.wallpapers);
  const visuals = useLibraryStore((state) => state.personal.visuals);
  const roomId = usePalaceStore((state) => state.roomId);
  const baseRoom = roomId.split("-page-")[0];
  const visualRoom = [
    "imagined-worlds",
    "cosmic",
    "glass-life",
    "portraits",
  ].includes(baseRoom);
  const images = visualRoom
    ? visuals.filter((item) =>
        baseRoom === "glass-life"
          ? item.category === "glass"
          : baseRoom === "portraits"
            ? item.category === "portrait"
            : baseRoom === "cosmic"
              ? item.category === "cosmic"
              : true,
      )
    : wallpapers;
  const error = useLibraryStore((state) => state.error);
  const importRef = useRef<HTMLInputElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<WallpaperItem | null>(null);
  const [importing, setImporting] = useState(false);
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
  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImporting(true);
    await useLibraryStore.getState().importWallpapers(files);
    setImporting(false);
    event.target.value = "";
  };
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
    const state = usePalaceStore.getState();
    const mode =
      state.mode === "index"
        ? window.matchMedia("(pointer: coarse)").matches
          ? "tour"
          : "explore"
        : state.mode;
    state.update({ cinemaImage: item, mode, started: true });
    usePalaceStore.getState().enterRoom("cinema");
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
      <div className="collection-actions">
        <button
          className="text-button"
          type="button"
          disabled={importing}
          onClick={() => importRef.current?.click()}
        >
          <Upload size={14} />
          {importing
            ? "READING ARCHIVE…"
            : visualRoom
              ? "IMPORT INTO WALLPAPER VAULT"
              : "IMPORT IMAGES"}
        </button>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif"
          aria-label="Import local wallpaper images"
          onChange={(event) => void importFiles(event)}
        />
      </div>
      {error && (
        <p role="status" className="collection-message">
          {error}
        </p>
      )}
      <div className="visual-archive">
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
          </article>
        ))}
      </div>
      {!images.length && (
        <p className="collection-empty">
          Begin with an image you would like to live inside.
        </p>
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
