import { useEffect, useState } from "react";
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";

export const BALL_SURFACE_COLOR = "#b9652c";
const CHANNEL_HALF_WIDTH = .012;
const GRAIN_SCALE = 76;
export interface BasketballSurfaceSample { color: [number, number, number]; height: number; roughness: number; channel: number }
export interface BasketballTexels { width: number; heightPixels: number; color: Uint8Array; height: Uint8Array; roughness: Uint8Array }
export interface BasketballSurface { color: DataTexture; height: DataTexture; roughness: DataTexture; maps: readonly DataTexture[]; dispose: () => void }

function cellHash(x: number, y: number, z: number) {
  let value = Math.imul(x, 1597334677) ^ Math.imul(y, 3812015801) ^ Math.imul(z, 958689311);
  value = Math.imul(value ^ value >>> 16, 2246822519);
  return (value ^ value >>> 13) >>> 0;
}
function leatherGrain(x: number, y: number, z: number) {
  const px = x * GRAIN_SCALE, py = y * GRAIN_SCALE, pz = z * GRAIN_SCALE;
  const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
  let nearest = 4;
  // 球面上的三维细胞使颗粒保持物理尺度，避免经纬图在两极拉出条纹。
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const hash = cellHash(cx + dx, cy + dy, cz + dz);
    const ox = cx + dx + .2 + (hash & 1023) / 1023 * .6 - px;
    const oy = cy + dy + .2 + (hash >>> 10 & 1023) / 1023 * .6 - py;
    const oz = cz + dz + .2 + (hash >>> 20 & 1023) / 1023 * .6 - pz;
    nearest = Math.min(nearest, ox * ox + oy * oy + oz * oz);
  }
  return Math.exp(-nearest * nearest * 3.4);
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function basketballSurfaceSample(u: number, v: number, out: BasketballSurfaceSample = { color: [0, 0, 0], height: 0, roughness: 0, channel: 0 }) {
  const longitude = (u - Math.floor(u)) * Math.PI * 2, latitude = clamp(v) * Math.PI;
  // Canonical pole values also keep the equirectangular wrap bit-for-bit continuous.
  const radial = v <= 0 || v >= 1 ? 0 : Math.sin(latitude);
  const x = -Math.cos(longitude) * radial, y = -Math.cos(latitude), z = Math.sin(longitude) * radial;
  // Three closed channels form eight original panels; the third meridian bends around the leather panels.
  const curved = Math.abs(z + .30 * x * y) / Math.sqrt(1 + .09 * (x * x + y * y));
  const distance = Math.min(Math.abs(x), Math.abs(y), curved);
  const channel = 1 - smooth((distance - CHANNEL_HALF_WIDTH * .52) / (CHANNEL_HALF_WIDTH * .48));
  const grain = leatherGrain(x, y, z), tone = .94 + .10 * grain + .025 * Math.sin(x * 9 + z * 6) * Math.cos(y * 11);
  out.color[0] = Math.round(185 * tone * (1 - channel) + 36 * channel);
  out.color[1] = Math.round(101 * tone * (1 - channel) + 28 * channel);
  out.color[2] = Math.round(44 * tone * (1 - channel) + 22 * channel);
  // Color is not the bump source: rubber channels are physically recessed, pebble tops rise gently.
  out.height = (.61 + .24 * grain) * (1 - channel) + (.10 + .025 * grain) * channel;
  out.roughness = (.91 - .15 * grain) * (1 - channel) + .95 * channel;
  out.channel = channel;
  return out;
}

export function makeBasketballTexels(width = 1024, heightPixels = 512): BasketballTexels {
  if (!Number.isInteger(width) || !Number.isInteger(heightPixels) || width < 8 || heightPixels < 8 || width > 2048 || heightPixels > 1024) throw new RangeError("Basketball texture dimensions must be bounded integers");
  const color = new Uint8Array(width * heightPixels * 4), height = new Uint8Array(color.length), roughness = new Uint8Array(color.length);
  const sample: BasketballSurfaceSample = { color: [0, 0, 0], height: 0, roughness: 0, channel: 0 };
  for (let row = 0; row < heightPixels; row++) for (let column = 0; column < width; column++) {
    basketballSurfaceSample(column / (width - 1), row / (heightPixels - 1), sample);
    const index = (row * width + column) * 4, h = Math.round(sample.height * 255), r = Math.round(sample.roughness * 255);
    color[index] = sample.color[0]; color[index + 1] = sample.color[1]; color[index + 2] = sample.color[2];
    height[index] = height[index + 1] = height[index + 2] = h;
    roughness[index] = roughness[index + 1] = roughness[index + 2] = r;
    color[index + 3] = height[index + 3] = roughness[index + 3] = 255;
  }
  return { width, heightPixels, color, height, roughness };
}

export function createBasketballSurface(width = 1024, heightPixels = 512): BasketballSurface {
  const data = makeBasketballTexels(width, heightPixels);
  const create = (pixels: Uint8Array, color: boolean) => {
    const texture = new DataTexture(pixels, width, heightPixels);
    texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = RepeatWrapping; texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
    texture.name = color ? "original-basketball-leather-color" : pixels === data.height ? "original-basketball-channel-height" : "original-basketball-leather-roughness";
    return texture;
  };
  const color = create(data.color, true), height = create(data.height, false), roughness = create(data.roughness, false);
  const maps = [color, height, roughness] as const;
  let disposed = false;
  return { color, height, roughness, maps, dispose: () => { if (!disposed) { disposed = true; maps.forEach(map => map.dispose()); } } };
}

export function useBasketballSurface() {
  const [surface, setSurface] = useState<BasketballSurface | null>(null);
  useEffect(() => {
    // Create in the committed effect: StrictMode's abandoned render cannot retain GPU resources.
    const owned = createBasketballSurface(); setSurface(owned);
    return () => owned.dispose();
  }, []);
  return surface;
}
