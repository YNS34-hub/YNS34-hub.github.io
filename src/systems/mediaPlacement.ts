import type { WallpaperItem } from "../content/types";
import { orderedWorks } from "../world/spatialLayout";
export type ImageKind = NonNullable<WallpaperItem["mediaKind"]>;
export interface ImageImportOptions {
  kind: ImageKind;
  category: string;
  roomIds: string[];
  primary?: boolean;
  order?: number;
}
export const imageDestinations = [
  ["wallpapers", "Wallpaper Vault", "wallpaper", "horizon"],
  ["imagined-worlds", "Visual Collection", "visual", "visual"],
  ["cosmic", "Cosmic Room", "visual", "cosmic"],
  ["glass-life", "Glass Life", "visual", "glass"],
  ["portraits", "Portraits", "visual", "portrait"],
  ["editorial", "Editorial Studio", "visual", "editorial"],
  ["projects", "Project covers", "project", "project"],
  ["research", "Research notes", "research", "research"],
] as const;
/** v1 records are retained in the same object store. Missing placement defaults to their original shelf. */
export function normalizeVisual(
  item: WallpaperItem,
  fallback: ImageKind = "wallpaper",
): WallpaperItem {
  const kind = item.mediaKind || fallback;
  return {
    ...item,
    mediaKind: kind,
    order: Number.isFinite(item.order) ? item.order : 0,
    roomIds: item.roomIds?.filter((x) =>
      imageDestinations.some((d) => d[0] === x),
    ),
  };
}
export function worksForRoom(items: WallpaperItem[], roomId: string) {
  const base = roomId.split("-page-")[0];
  return orderedWorks(
    items.filter((x) => {
      if (x.roomIds?.length) return x.roomIds.includes(base);
      if (base === "wallpapers")
        return x.mediaKind === "wallpaper" || !x.mediaKind;
      if (base === "imagined-worlds") return x.mediaKind === "visual";
      return (
        {
          cosmic: "cosmic",
          "glass-life": "glass",
          portraits: "portrait",
          editorial: "editorial",
          projects: "project",
          research: "research",
        }[base] === x.category
      );
    }),
  );
}
/** Rooms share a resource ID; selecting a hero changes placement, never copies a blob. */
export function selectPrimary(items: WallpaperItem[], selected: WallpaperItem) {
  const targets = selected.roomIds?.length
    ? selected.roomIds
    : [
        imageDestinations.find(
          (x) => x[2] === selected.mediaKind && x[3] === selected.category,
        )?.[0] || "wallpapers",
      ];
  const displaced = new Set(
    targets.flatMap((room) =>
      worksForRoom(items, room)
        .filter((x) => x.primary && x.id !== selected.id)
        .map((x) => x.id),
    ),
  );
  return items.map((x) =>
    x.id === selected.id
      ? selected
      : displaced.has(x.id)
        ? { ...x, primary: false }
        : x,
  );
}
