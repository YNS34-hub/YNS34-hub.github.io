import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/** Small, deterministic, local material maps. No asset service or per-frame texture work. */
export function useSurfaceTexture(surface: "walnut" | "stone") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = surface === "walnut" ? 256 : 128;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 73;
    const noise = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296 - 0.5;
    };
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const grain =
          surface === "walnut"
            ? Math.sin(x * 0.31 + Math.sin(y * 0.018) * 0.45) * 3.5 +
              Math.sin(x * 1.83 + y * 0.006) * 1.5 +
              noise() * 2.5
            : noise() * 12;
        const i = (y * canvas.width + x) * 4;
        pixels.data[i] = (surface === "walnut" ? 128 : 180) + grain;
        pixels.data[i + 1] = (surface === "walnut" ? 105 : 180) + grain;
        pixels.data[i + 2] = (surface === "walnut" ? 85 : 180) + grain;
        pixels.data[i + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const result = new CanvasTexture(canvas);
    result.wrapS = result.wrapT = RepeatWrapping;
    result.colorSpace = SRGBColorSpace;
    result.repeat.set(
      surface === "walnut" ? 2 : 8,
      surface === "walnut" ? 1 : 8,
    );
    result.anisotropy = 2;
    return result;
  }, [surface]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
