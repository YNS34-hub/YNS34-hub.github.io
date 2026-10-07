import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

// 原创纹理在场景内生成与释放，没有外部品牌、下载素材或私人文件。
export function useWorldTexture(kind: "court" | "ball" | "mural" | "grain") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = kind === "court" ? 1536 : 512;
    canvas.height = kind === "court" ? 2048 : 512;
    const ctx = canvas.getContext("2d")!;
    let seed = 31;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    ctx.fillStyle = kind === "ball" ? "#b96a31" : kind === "court" ? "#323b42" : kind === "mural" ? "#21433e" : "#a99b83";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    const tex = new CanvasTexture(canvas); tex.colorSpace = SRGBColorSpace; tex.anisotropy = kind === "court" ? 4 : 2;
    if (kind === "grain") { tex.wrapS = tex.wrapT = RepeatWrapping; tex.repeat.set(12, 12); }
    return tex;
  }, [kind]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
