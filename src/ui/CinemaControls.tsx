import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Info, X } from "lucide-react";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
export default function CinemaControls() {
  const library = useLibraryStore();
  const image = usePalaceStore((s) => s.cinemaImage);
  const [metadata, setMetadata] = useState(false);
  const images = [
    ...library.wallpapers,
    ...library.personal.visuals,
    ...library.personal.projects,
    ...library.personal.research,
  ];
  const selected = image || images[0];
  const exit = () =>
    usePalaceStore
      .getState()
      .enterRoom(
        library.personal.projects.some((x) => x.id === selected?.id)
          ? selected?.category === "liquid-web"
            ? "liquid-web"
            : "projects"
          : library.personal.research.some((x) => x.id === selected?.id)
            ? "research"
            : library.personal.visuals.some((x) => x.id === selected?.id)
              ? "imagined-worlds"
              : "wallpapers",
      );
  const move = (direction: number) => {
    const index = images.findIndex((x) => x.id === selected?.id);
    if (images.length)
      usePalaceStore.getState().update({
        cinemaImage:
          images[
            (Math.max(0, index) + direction + images.length) % images.length
          ],
      });
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input,textarea,select"))
        return;
      if (["ArrowLeft", "ArrowRight", "Escape", "i", "I"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "Escape") exit();
      if (event.key.toLowerCase() === "i") setMetadata((v) => !v);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });
  return (
    <aside className="cinema-controls" aria-label="Wallpaper cinema controls">
      <button aria-label="Previous image" onClick={() => move(-1)}>
        <ChevronLeft size={20} />
      </button>
      <span>{selected?.title || "Wallpaper Cinema"}</span>
      <button aria-label="Next image" onClick={() => move(1)}>
        <ChevronRight size={20} />
      </button>
      <button
        aria-label="Favorite image"
        aria-pressed={!!selected?.favorite}
        onClick={() => selected && void library.favoriteWallpaper(selected.id)}
      >
        <Heart size={18} fill={selected?.favorite ? "currentColor" : "none"} />
      </button>
      <button
        aria-label="Image metadata"
        onClick={() => setMetadata((v) => !v)}
      >
        <Info size={18} />
      </button>
      <button aria-label="Exit cinema" onClick={exit}>
        <X size={20} />
      </button>
      {metadata && (
        <div className="cinema-metadata">
          <strong>{selected?.title}</strong>
          <p>
            {selected?.date} / {selected?.category}
          </p>
          <p>{selected?.source}</p>
          <p>{selected?.description}</p>
        </div>
      )}
    </aside>
  );
}
