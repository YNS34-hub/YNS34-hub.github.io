import type { MusicTrack, WallpaperItem } from "./types";
import selected from "../../content/selected-collection.json";
export interface VisualWork extends WallpaperItem {
  favorite?: boolean;
  width?: number;
  height?: number;
}
export interface PersonalManifest {
  wallpapers: VisualWork[];
  visuals: VisualWork[];
  music: MusicTrack[];
  projects: VisualWork[];
  research: VisualWork[];
}
export const emptyPersonal: PersonalManifest = {
  wallpapers: [],
  visuals: [],
  music: [],
  projects: [],
  research: [],
};
function mergeById<T extends { id: string }>(shared: T[], local: T[]): T[] {
  return [
    ...new Map([...shared, ...local].map((item) => [item.id, item])).values(),
  ];
}
export async function readPersonal(): Promise<PersonalManifest> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}personal-media/manifest.json`,
  );
  if (!response.ok)
    throw new Error(
      "Personal collection could not be loaded. Rebuild after adding your files.",
    );
  const local = (await response.json()) as PersonalManifest;
  // Public selections are intentional exhibits. Local additions can override the same IDs.
  const shared = selected as PersonalManifest;
  return {
    wallpapers: mergeById(shared.wallpapers, local.wallpapers),
    visuals: mergeById(shared.visuals, local.visuals),
    music: mergeById(shared.music, local.music),
    projects: mergeById(shared.projects, local.projects),
    research: mergeById(shared.research, local.research),
  };
}
