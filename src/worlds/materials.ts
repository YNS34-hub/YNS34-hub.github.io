import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, NoColorSpace } from "three";

export type WorldTextureKind = "court" | "ball" | "mural" | "grain" | "waves" | "land" | "leaves" | "brick";
// 仅缓存这八种固定原创 CPU 画布，最多约 19 MiB；GPU 纹理仍由各挂载实例独立释放。
const sources = new Map<WorldTextureKind, HTMLCanvasElement>();
function textureFromCanvas(kind: WorldTextureKind, canvas: HTMLCanvasElement) {
  const tex = new CanvasTexture(canvas); tex.colorSpace = kind === "waves" ? NoColorSpace : SRGBColorSpace; tex.anisotropy = kind === "court" ? 4 : 2;
  if (kind === "grain" || kind === "waves" || kind === "land") { tex.wrapS = tex.wrapT = RepeatWrapping; tex.repeat.set(kind === "waves" ? 30 : kind === "land" ? 10 : 12, kind === "waves" ? 30 : kind === "land" ? 10 : 12); }
  if (kind === "brick") { tex.wrapS = tex.wrapT = RepeatWrapping; tex.repeat.set(2, 3); }
  return tex;
}
export function createWorldTexture(kind: WorldTextureKind) {
    const cached = sources.get(kind);
    if (cached) return textureFromCanvas(kind, cached);
    const canvas = document.createElement("canvas");
    canvas.width = kind === "court" ? 1536 : 512;
    canvas.height = kind === "court" ? 2048 : 512;
    const ctx = canvas.getContext("2d")!;
    let seed = 31;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    ctx.fillStyle = kind === "ball" ? "#b96a31" : kind === "court" ? "#323b42" : kind === "mural" ? "#21433e" : "#a99b83";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (kind === "brick") {
      ctx.fillStyle = "#898b87"; ctx.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 32; row++) for (let column = -1; column < 12; column++) {
        const tone = 202 + Math.floor(random() * 32);
        ctx.fillStyle = `rgb(${tone},${tone},${tone - 3})`;
        ctx.fillRect(column * 48 + row % 2 * 24 + 1, row * 16 + 1, 46, 14);
      }
    }
    if (kind === "court") {
      ctx.save(); ctx.translate(768, 1024); ctx.scale(64, 2048 / 36);
      ctx.fillStyle = "#365e6f"; ctx.fillRect(-7.5, -14, 15, 28);
      ctx.fillStyle = "#af6746";
      for (const side of [-1, 1]) ctx.fillRect(-2.45, side === -1 ? -14 : 8.2, 4.9, 5.8);
      ctx.fillStyle = "#6b8f8a"; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#e8e2d0"; ctx.lineWidth = 0.055;
      ctx.strokeRect(-7.5, -14, 15, 28);
      ctx.beginPath(); ctx.moveTo(-7.5, 0); ctx.lineTo(7.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(-7.5, -14, 15, 28); ctx.clip();
      for (const side of [-1, 1]) {
        ctx.strokeRect(-2.45, side === -1 ? -14 : 8.2, 4.9, 5.8);
        ctx.beginPath(); ctx.arc(0, side * 8.2, 1.8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, side * 12.1, 6.7, side === -1 ? 0 : Math.PI, side === -1 ? Math.PI : Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.font = '500 .38px "Space Grotesk",sans-serif'; ctx.textAlign = "center"; ctx.fillStyle = "#d7c0a4";
      ctx.fillText("THE MEMORY PALACE", 0, 3.2); ctx.restore();
    }
    if (kind === "mural") {
      ctx.strokeStyle = "#ddb186"; ctx.lineWidth = 8;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(170 + i * 25, 280, 70 + i * 23, -.8, 2.7); ctx.stroke();
      }
      ctx.fillStyle = "#ddbd92"; ctx.font = '600 56px "Space Grotesk",sans-serif';
      ctx.fillText("AFTER", 34, 91); ctx.fillText("HOURS", 34, 152);
      ctx.font = '500 13px "Space Grotesk",sans-serif'; ctx.fillText("A PLACE TO PLAY / JIE TIAN", 35, 463);
    }
    const speckles = kind === "court" ? 95000 : 16000;
    for (let i = 0; i < speckles; i++) {
      ctx.fillStyle = random() > .5 ? "#ffffff0c" : "#00000014";
      ctx.fillRect(random() * canvas.width, random() * canvas.height, kind === "ball" ? 2 : 1.5, kind === "ball" ? 2 : 1.5);
    }
    if (kind === "ball") {
      ctx.strokeStyle = "#302720"; ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
      for (const x of [128, 384]) { ctx.beginPath(); ctx.ellipse(x, 256, 76, 252, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (kind === "waves") {
      const pixels = ctx.createImageData(512, 512);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4;
        pixels.data[i] = 128 + Math.sin(x * .11 + Math.cos(y * .12)) * 16;
        pixels.data[i + 1] = 128 + Math.cos(y * .14 + Math.sin(x * .08)) * 14;
        pixels.data[i + 2] = 250; pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    }
    if (kind === "land") {
      ctx.fillStyle = "#b9bba9"; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 30000; i++) {
        ctx.strokeStyle = random() > .5 ? "#757f5d66" : "#e6ddbd88";
        const x = random() * 512, y = random() * 512;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 2 - 1, y - 1 - random() * 3); ctx.stroke();
      }
    }
    if (kind === "leaves") {
      // 带空隙的原创枝叶纹理：硬 alpha 裁切形成细叶轮廓，无透明叠层排序。
      ctx.clearRect(0, 0, 512, 512);
      for (let i = 0; i < 150; i++) {
        const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 200;
        const x = 256 + Math.cos(a) * r, y = 256 + Math.sin(a) * r;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + .7);
        const tone = 125 + Math.floor(random() * 120);
        ctx.fillStyle = `rgb(${tone},${tone},${tone - 9})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 7 + random() * 8, 16 + random() * 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#817d6780"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke(); ctx.restore();
      }
    }
    sources.set(kind, canvas);
    return textureFromCanvas(kind, canvas);
}
export function useWorldTexture(kind: WorldTextureKind) {
  const texture = useMemo(() => createWorldTexture(kind), [kind]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
