import { describe, expect, it, vi } from "vitest";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import { createWorldTexture } from "../src/worlds/materials";

describe("bounded authored texture sources", () => {
  it("reuses CPU sources while keeping GPU ownership, UV transforms and color spaces independent", () => {
    let canvases = 0;
    const noop = () => {};
    const ctx = { fillRect: noop, createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop };
    vi.stubGlobal("document", { createElement: () => { canvases++; return { width: 0, height: 0, getContext: () => ctx }; } });
    try {
      const first = createWorldTexture("grain"), second = createWorldTexture("grain"), waves = createWorldTexture("waves");
      expect(canvases).toBe(2); expect(first.image).toBe(second.image); expect(first.uuid).not.toBe(second.uuid);
      expect(first.wrapS).toBe(RepeatWrapping); expect(first.colorSpace).toBe(SRGBColorSpace); expect(waves.colorSpace).toBe(NoColorSpace);
      const untouched = vi.fn(); second.addEventListener("dispose", untouched); first.repeat.x = 1; first.dispose();
      expect(second.repeat.x).toBe(12); expect(untouched).not.toHaveBeenCalled(); second.dispose(); waves.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});
