import { SRGBColorSpace, Texture, TextureLoader } from "three";
type Entry = {
  refs: number;
  texture: Texture | null;
  ready: boolean;
  failed: boolean;
  used: number;
  listeners: Set<() => void>;
};
const cache = new Map<string, Entry>();
let changed = 0;
export const textureStatus = () => ({
  pending: [...cache.values()].filter((e) => e.refs > 0 && !e.ready).length,
  failed: [...cache.values()].filter((e) => e.refs > 0 && e.failed).length,
  count: cache.size,
  changed,
});
export function acquireImage(src: string, budget: number, notify: () => void) {
  const key = `${budget}:${src}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      refs: 0,
      texture: null,
      ready: false,
      failed: false,
      used: performance.now(),
      listeners: new Set(),
    };
    cache.set(key, entry);
    changed++;
    const target = entry;
    const url = src.startsWith("/")
      ? `${import.meta.env.BASE_URL}${src.slice(1)}`
      : src;
    new TextureLoader().load(
      url,
      (image) => {
        const source = image.image as HTMLImageElement;
        if (Math.max(source.width, source.height) > budget) {
          const scale = budget / Math.max(source.width, source.height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(source.width * scale);
          canvas.height = Math.round(source.height * scale);
          canvas
            .getContext("2d")
            ?.drawImage(source, 0, 0, canvas.width, canvas.height);
          image.image = canvas;
        }
        image.colorSpace = SRGBColorSpace;
        image.anisotropy = 4;
        image.needsUpdate = true;
        target.texture = image;
        target.ready = true;
        changed++;
        target.listeners.forEach((fn) => fn());
        trim();
      },
      undefined,
      () => {
        target.ready = true;
        target.failed = true;
        changed++;
        target.listeners.forEach((fn) => fn());
        trim();
      },
    );
  }
  entry.refs++;
  entry.used = performance.now();
  entry.listeners.add(notify);
  let released = false;
  return {
    get: () => entry!.texture,
    ready: () => entry!.ready,
    release: () => {
      if (released) return;
      released = true;
      entry!.refs = Math.max(0, entry!.refs - 1);
      entry!.listeners.delete(notify);
      entry!.used = performance.now();
      trim();
    },
  };
}
function trim() {
  const idle = [...cache.entries()]
    .filter(([, e]) => !e.refs && e.ready)
    .sort((a, b) => a[1].used - b[1].used);
  // Keep a small return-journey cache. Shared, live textures never get disposed by a departing room.
  while (cache.size > 32 && idle.length) {
    const [key, e] = idle.shift()!;
    e.texture?.dispose();
    cache.delete(key);
  }
}
export function prewarmImages(sources: string[], budget = 1600) {
  sources.slice(0, 3).forEach((src) => {
    const held = acquireImage(src, budget, () => held.release());
    if (held.ready()) held.release();
  });
}
