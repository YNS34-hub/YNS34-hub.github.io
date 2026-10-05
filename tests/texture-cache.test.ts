import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { Texture, TextureLoader } from "three";
const jobs: {
  loaded?: (texture: Texture) => void;
  failed?: (error: unknown) => void;
}[] = [];
beforeEach(() => {
  vi.resetModules();
  jobs.length = 0;
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation(
    (_url, loaded, _progress, failed) => {
      jobs.push({ loaded, failed });
      return new Texture();
    },
  );
});
afterEach(() => vi.restoreAllMocks());
const complete = () => {
  const texture = new Texture({ width: 100, height: 100 } as HTMLImageElement);
  jobs.at(-1)?.loaded?.(texture);
  return texture;
};
describe("shared image ownership and bounded return cache", () => {
  it("loads one texture for two walls and protects the surviving owner during eviction", async () => {
    const { acquireImage, textureStatus } = await import(
      "../src/world/textureCache"
    );
    const a = acquireImage("shared.webp", 1600, () => {}),
      b = acquireImage("shared.webp", 1600, () => {});
    expect(jobs).toHaveLength(1);
    expect(textureStatus().pending).toBe(1);
    const texture = complete(),
      dispose = vi.spyOn(texture, "dispose");
    a.release();
    a.release();
    for (let i = 0; i < 45; i++) {
      const entry = acquireImage("idle-" + i + ".webp", 1600, () => {});
      complete();
      entry.release();
    }
    expect(textureStatus().count).toBeLessThanOrEqual(32);
    expect(b.get()).toBe(texture);
    expect(dispose).not.toHaveBeenCalled();
    b.release();
  });
  it("releases failed preloads even when requested again, without an endless loading state", async () => {
    const { prewarmImages, textureStatus } = await import(
      "../src/world/textureCache"
    );
    prewarmImages(["missing.webp"]);
    jobs.at(-1)?.failed?.(new Error("missing"));
    prewarmImages(["missing.webp"]);
    expect(textureStatus()).toMatchObject({ pending: 0, failed: 0 });
  });
  it("keeps quality tiers separate while sharing the same tier", async () => {
    const { acquireImage } = await import("../src/world/textureCache");
    const low = acquireImage("work.webp", 1024, () => {});
    complete();
    const medium = acquireImage("work.webp", 1600, () => {});
    complete();
    expect(jobs).toHaveLength(2);
    expect(low.get()).not.toBe(medium.get());
    low.release();
    medium.release();
  });
});
