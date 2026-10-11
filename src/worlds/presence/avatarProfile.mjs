const bounded = (v, min, max, fallback = 1) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(v ?? "") ? v.toLowerCase() : fallback;

// 只接受有限的形态参数。没有照片 URL、外部模型、路径、脚本或可执行材质字段。
export function validateAvatarProfile(value) {
  if (!value || typeof value !== "object" || value.version !== 1) return null;
  return { version: 1, skin: color(value.skin, "#d7b392"), hair: color(value.hair, "#171b1d"),
    shoulders: bounded(value.shoulders, .94, 1.12), chest: bounded(value.chest, .94, 1.15), waist: bounded(value.waist, .90, 1.10),
    arms: bounded(value.arms, .94, 1.18), jaw: bounded(value.jaw, .94, 1.10), nose: bounded(value.nose, .75, 1.10),
    eyeHeight: bounded(value.eyeHeight, .85, 1.10), hairCrop: bounded(value.hairCrop, .35, 1) };
}
