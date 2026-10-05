import { create } from "zustand";
import {
  music as staticMusic,
  wallpapers as staticWallpapers,
} from "../content/catalog";
import type { MusicTrack, WallpaperItem } from "../content/types";
import {
  deleteLibraryRecord,
  readLibraryRecords,
  writeLibraryRecord,
  type LibraryRecord,
} from "./idb";
import { imagePreview } from "./image-preview";
import { usePalaceStore } from "./store";
import {
  readPersonal,
  emptyPersonal,
  type PersonalManifest,
} from "../content/personal";

export function parseNetEaseLink(value: string): {
  url: string;
  id: string;
  kind: "song" | "playlist" | "album" | "share";
} {
  const candidate = value.match(/https?:\/\/[^\s<>"']+/i)?.[0] || value.trim();
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Paste a NetEase Music song, album or playlist share URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !["music.163.com", "y.music.163.com", "163cn.tv"].includes(
      url.hostname.toLowerCase(),
    )
  ) {
    throw new Error(
      "Use an official music.163.com, y.music.163.com or 163cn.tv share link.",
    );
  }
  if (url.username || url.password)
    throw new Error("This share URL is not valid.");
  const location = `${url.pathname}${url.hash}`;
  const match = location.match(
    /(?:^|[/#])(?:m\/)?(song|playlist|album)(?:[/?]|$)/,
  );
  const id = new URLSearchParams(
    url.hash.includes("?") ? url.hash.split("?")[1] : url.search,
  ).get("id");
  if (match && id && /^\d+$/.test(id)) {
    const kind = match[1] as "song" | "playlist" | "album";
    return {
      url: `https://music.163.com/#/${kind}?id=${id}`,
      id: `netease-${kind}-${id}`,
      kind,
    };
  }
  if (url.hostname === "163cn.tv" && url.pathname.length > 1) {
    url.protocol = "https:";
    return {
      url: url.href,
      id: `netease-share-${encodeURIComponent(url.pathname.slice(1))}`,
      kind: "share",
    };
  }
  throw new Error(
    "This link has no song, album or playlist ID. Paste the original official share link.",
  );
}

interface LibraryState {
  music: MusicTrack[];
  wallpapers: WallpaperItem[];
  personal: PersonalManifest;
  ready: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  importMusic: (files: File[]) => Promise<void>;
  importWallpapers: (files: File[]) => Promise<void>;
  addNetEase: (url: string, title?: string, artist?: string) => Promise<string>;
  updateTrack: (id: string, patch: Partial<MusicTrack>) => Promise<void>;
  setArtwork: (id: string, file: File) => Promise<void>;
  pairAudio: (id: string, file: File) => Promise<string | undefined>;
  removeMusic: (id: string) => Promise<void>;
  removeWallpaper: (id: string) => Promise<void>;
  favoriteWallpaper: (id: string) => Promise<void>;
}

const records = new Map<string, LibraryRecord>();
const urls = new Map<string, string[]>();
let initializing: Promise<void> | undefined;
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Local browser storage is unavailable.";
const fileTitle = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[_]/g, " ");
const newId = (prefix: string) =>
  `${prefix}-${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
function objectURL(id: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  urls.set(id, [...(urls.get(id) || []), url]);
  return url;
}
function revoke(id: string) {
  for (const url of urls.get(id) || []) URL.revokeObjectURL(url);
  urls.delete(id);
}
function trackFromRecord(record: LibraryRecord): MusicTrack {
  const data = record.data as unknown as MusicTrack;
  return {
    ...data,
    src: record.blob ? objectURL(record.id, record.blob) : data.src,
    cover: record.coverBlob
      ? objectURL(record.id, record.coverBlob)
      : data.cover,
    displayCover: record.coverPreviewBlob
      ? objectURL(record.id, record.coverPreviewBlob)
      : data.displayCover,
  };
}
function wallpaperFromRecord(record: LibraryRecord): WallpaperItem {
  const data = record.data as unknown as WallpaperItem;
  return {
    ...data,
    fileName:
      data.fileName ||
      (record.blob instanceof File ? record.blob.name : undefined),
    src: record.blob ? objectURL(record.id, record.blob) : data.src,
    displaySrc: record.previewBlob
      ? objectURL(record.id, record.previewBlob)
      : data.displaySrc,
  };
}
function persistentTrackData(track: MusicTrack): Record<string, unknown> {
  const data = { ...track } as Record<string, unknown>;
  for (const field of ["src", "cover", "displayCover"]) {
    if (
      typeof data[field] === "string" &&
      (data[field] as string).startsWith("blob:")
    )
      delete data[field];
  }
  return data;
}
async function persistRecord(record: LibraryRecord) {
  const stored = { ...record, addedAt: record.addedAt ?? Date.now() };
  records.set(stored.id, stored);
  try {
    await writeLibraryRecord(stored);
    useLibraryStore.setState({ error: null });
    navigator.storage?.persist?.().catch(() => undefined);
  } catch (error) {
    useLibraryStore.setState({
      error: `${errorMessage(error)} Your import remains available until this tab closes.`,
    });
  }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  music: [...staticMusic],
  wallpapers: [...staticWallpapers],
  personal: emptyPersonal,
  ready: false,
  error: null,
  initialize: async () => {
    if (get().ready) return;
    if (initializing) return initializing;
    initializing = (async () => {
      try {
        const personal = await readPersonal().catch((error: unknown) => {
          set({ error: errorMessage(error) });
          return emptyPersonal;
        });
        const saved = (
          await readLibraryRecords().catch((error: unknown) => {
            set({ error: errorMessage(error) });
            return [];
          })
        ).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
        saved.forEach((record) => records.set(record.id, record));
        const localMusic = saved
          .filter((record) => record.collection === "music")
          .map(trackFromRecord);
        const localWallpapers = saved
          .filter((record) => record.collection === "wallpapers")
          .map(wallpaperFromRecord);
        const initialMusic = [...personal.music, ...staticMusic];
        const snapshotIds = new Set(initialMusic.map((track) => track.id));
        set({
          personal: {
            ...personal,
            visuals: personal.visuals.map((item) => ({
              ...item,
              favorite:
                localWallpapers.find((work) => work.id === item.id)?.favorite ??
                item.favorite,
            })),
            projects: personal.projects.map((item) => ({
              ...item,
              favorite:
                localWallpapers.find((work) => work.id === item.id)?.favorite ??
                item.favorite,
            })),
            research: personal.research.map((item) => ({
              ...item,
              favorite:
                localWallpapers.find((work) => work.id === item.id)?.favorite ??
                item.favorite,
            })),
          },
          music: [
            ...initialMusic.map(
              (track) =>
                localMusic.find((savedTrack) => savedTrack.id === track.id) ||
                track,
            ),
            ...localMusic.filter((track) => !snapshotIds.has(track.id)),
          ],
          wallpapers: [...personal.wallpapers, ...staticWallpapers]
            .map((item) => {
              const stored = localWallpapers.find(
                (saved) => saved.id === item.id,
              );
              return stored ? { ...item, favorite: stored.favorite } : item;
            })
            .concat(
              localWallpapers.filter(
                (item) =>
                  ![
                    ...personal.wallpapers,
                    ...personal.visuals,
                    ...personal.projects,
                    ...personal.research,
                    ...staticWallpapers,
                  ].some((base) => base.id === item.id),
              ),
            ),
          ready: true,
        });
      } catch (error) {
        set({ ready: true, error: errorMessage(error) });
      }
    })();
    return initializing;
  },
  importMusic: async (files) => {
    await get().initialize();
    for (const file of files) {
      if (
        !/\.(mp3|m4a|ogg|wav|flac|aac|opus)$/i.test(file.name) &&
        !file.type.startsWith("audio/")
      )
        continue;
      const id = newId("local-track");
      let track: MusicTrack = {
        id,
        title: fileTitle(file.name),
        artist: "Unknown artist",
        album: "Local collection",
        favorite: false,
        source: "local",
      };
      let coverBlob: Blob | undefined;
      try {
        const { parseBlob } = await import("music-metadata");
        const metadata = await parseBlob(file, {
          skipCovers: false,
          duration: true,
        });
        const common = metadata.common;
        track = {
          ...track,
          title: common.title || track.title,
          artist: common.artist || track.artist,
          album: common.album || track.album,
          year: common.year ? String(common.year) : undefined,
          duration: metadata.format.duration,
        };
        const picture = common.picture?.[0];
        if (picture)
          coverBlob = new Blob([new Uint8Array(picture.data)], {
            type: picture.format,
          });
      } catch {
        /* Untagged or unsupported metadata: the audio remains usable and editable. */
      }
      const coverPreview = coverBlob ? await imagePreview(coverBlob, 768) : {};
      track.color = coverPreview.color;
      const record: LibraryRecord = {
        id,
        collection: "music",
        data: { ...track },
        blob: file,
        coverBlob,
        coverPreviewBlob: coverPreview.preview,
      };
      const loadedTrack = trackFromRecord(record);
      set((state) => ({ music: [...state.music, loadedTrack] }));
      await persistRecord(record);
    }
  },
  importWallpapers: async (files) => {
    await get().initialize();
    for (const file of files) {
      if (!/\.(jpe?g|png|webp|avif)$/i.test(file.name)) continue;
      const id = newId("local-image");
      const data: WallpaperItem = {
        id,
        title: fileTitle(file.name),
        fileName: file.name,
        src: "",
        description:
          "From your private collection. Stored only in this browser.",
        tags: ["local"],
        category: "Private collection",
        source: "Local file",
        date: new Date().toISOString().slice(0, 10),
        imported: true,
      };
      const preview = await imagePreview(file);
      data.color = preview.color;
      const record: LibraryRecord = {
        id,
        collection: "wallpapers",
        data: { ...data },
        blob: file,
        previewBlob: preview.preview,
      };
      set((state) => ({
        wallpapers: [...state.wallpapers, wallpaperFromRecord(record)],
      }));
      await persistRecord(record);
    }
  },
  addNetEase: async (value, title, artist) => {
    await get().initialize();
    const link = parseNetEaseLink(value);
    const existing = get().music.find((track) => track.id === link.id);
    if (existing) return existing.id;
    const track: MusicTrack = {
      id: link.id,
      title: title?.trim() || `NetEase ${link.kind}`,
      artist: artist?.trim() || "NetEase Music",
      album: "Linked collection",
      favorite: false,
      url: link.url,
      source: "netease",
    };
    set((state) => ({ music: [...state.music, track] }));
    await persistRecord({
      id: track.id,
      collection: "music",
      data: { ...track },
    });
    return track.id;
  },
  updateTrack: async (id, patch) => {
    await get().initialize();
    const track = get().music.find((item) => item.id === id);
    if (!track) return;
    const safePatch = { ...patch };
    if (safePatch.url) safePatch.url = parseNetEaseLink(safePatch.url).url;
    delete safePatch.id;
    delete safePatch.src;
    const updated = { ...track, ...safePatch };
    set((state) => ({
      music: state.music.map((item) => (item.id === id ? updated : item)),
    }));
    const original = records.get(id);
    const data = persistentTrackData(updated);
    await persistRecord({ ...original, id, collection: "music", data });
  },
  setArtwork: async (id, file) => {
    await get().initialize();
    if (!/\.(jpe?g|png|webp|avif)$/i.test(file.name))
      throw new Error("Choose a JPG, PNG, WEBP or AVIF album image.");
    const track = get().music.find((item) => item.id === id);
    if (!track) return;
    const artwork = await imagePreview(file, 768);
    const updated: MusicTrack = {
      ...track,
      cover: objectURL(id, file),
      displayCover: artwork.preview
        ? objectURL(id, artwork.preview)
        : undefined,
      color: artwork.color,
    };
    set((state) => ({
      music: state.music.map((item) => (item.id === id ? updated : item)),
    }));
    await persistRecord({
      ...records.get(id),
      id,
      collection: "music",
      data: persistentTrackData(updated),
      coverBlob: file,
      coverPreviewBlob: artwork.preview,
    });
  },
  pairAudio: async (id, file) => {
    await get().initialize();
    const linkedTrack = get().music.find((track) => track.id === id);
    if (!linkedTrack?.url)
      throw new Error(
        "Choose an official linked record before pairing local audio.",
      );
    const previous = new Set(get().music.map((track) => track.id));
    await get().importMusic([file]);
    const localTrack = get().music.find((track) => !previous.has(track.id));
    if (!localTrack) return;
    await get().updateTrack(localTrack.id, {
      title: /^NetEase (song|playlist|album|share)$/.test(linkedTrack.title)
        ? localTrack.title
        : linkedTrack.title,
      artist:
        linkedTrack.artist === "NetEase Music"
          ? localTrack.artist
          : linkedTrack.artist,
      album:
        linkedTrack.album === "Linked collection"
          ? localTrack.album
          : linkedTrack.album,
      year: linkedTrack.year || localTrack.year,
      url: linkedTrack.url,
      favorite: linkedTrack.favorite,
    });
    const linkedRecord = records.get(id);
    const paired = get().music.find((track) => track.id === localTrack.id)!;
    if (linkedRecord?.coverBlob) {
      const cover = objectURL(paired.id, linkedRecord.coverBlob);
      const displayCover = linkedRecord.coverPreviewBlob
        ? objectURL(paired.id, linkedRecord.coverPreviewBlob)
        : undefined;
      const updated = {
        ...paired,
        cover,
        displayCover,
        color: linkedTrack.color,
      };
      set((state) => ({
        music: state.music.map((track) =>
          track.id === paired.id ? updated : track,
        ),
      }));
      await persistRecord({
        ...records.get(paired.id),
        id: paired.id,
        collection: "music",
        data: persistentTrackData(updated),
        coverBlob: linkedRecord.coverBlob,
        coverPreviewBlob: linkedRecord.coverPreviewBlob,
      });
    } else if (linkedTrack.cover && !linkedTrack.cover.startsWith("blob:")) {
      await get().updateTrack(paired.id, {
        cover: linkedTrack.cover,
        color: linkedTrack.color,
      });
    }
    return localTrack.id;
  },
  removeMusic: async (id) => {
    const original = records.get(id);
    if (!original) return;
    set((state) => ({ music: state.music.filter((item) => item.id !== id) }));
    try {
      await deleteLibraryRecord(id);
      records.delete(id);
      revoke(id);
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  removeWallpaper: async (id) => {
    if (!records.has(id)) return;
    if (usePalaceStore.getState().cinemaImage?.id === id)
      usePalaceStore.getState().update({ cinemaImage: null });
    set((state) => ({
      wallpapers: state.wallpapers.filter((item) => item.id !== id),
    }));
    try {
      await deleteLibraryRecord(id);
      records.delete(id);
      revoke(id);
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  favoriteWallpaper: async (id) => {
    const item = [
      ...get().wallpapers,
      ...get().personal.visuals,
      ...get().personal.projects,
      ...get().personal.research,
    ].find((work) => work.id === id);
    if (!item) return;
    const updated = { ...item, favorite: !item.favorite };
    set((state) => ({
      wallpapers: state.wallpapers.map((work) =>
        work.id === id ? updated : work,
      ),
      personal: {
        ...state.personal,
        visuals: state.personal.visuals.map((work) =>
          work.id === id ? updated : work,
        ),
        projects: state.personal.projects.map((work) =>
          work.id === id ? updated : work,
        ),
        research: state.personal.research.map((work) =>
          work.id === id ? updated : work,
        ),
      },
    }));
    if (usePalaceStore.getState().cinemaImage?.id === id)
      usePalaceStore.getState().update({ cinemaImage: updated });
    await persistRecord({
      ...records.get(id),
      id,
      collection: "wallpapers",
      data: { ...updated },
    });
  },
}));
