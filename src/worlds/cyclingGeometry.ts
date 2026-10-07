import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { route } from "./cyclingRoute";

const samples = Array.from({ length: 350 }, (_, i) => route.getPointAt(i / 350));
export const lakeRadius = (x: number, z: number) => Math.hypot((x - 53) / 39, (z + 13) / 53);
export function groundHeight(x: number, z: number) {
  const lake = lakeRadius(x, z);
  const hill = 1 + Math.max(0, x - 60) * .1 + Math.max(0, z - 20) * .17;
  const slope = hill + Math.sin(x * .09) * Math.cos(z * .07) * .65;
  const shore = Math.max(0, Math.min(1, (lake - .92) / .2));
  const base = -1.6 * (1 - shore) + slope * shore;
  let nearest = Infinity, height = base;
  for (const p of samples) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < nearest) { nearest = d; height = p.y - .16; }
  }
  // 路肩完整削平后再回到山坡，避免粗地形的插值面穿过连续路面。
  const blend = Math.max(0, Math.min(1, (11 - Math.sqrt(nearest)) / 5));
  return base * (1 - blend) + height * blend;
}
export function roadRibbon(width: number, offset = 0, lifted = 0) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const normal = new Vector3();
  for (let i = 0; i <= 350; i++) {
    const t = i / 350, p = route.getPointAt(t), tangent = route.getTangentAt(t);
    normal.set(-tangent.z, 0, tangent.x).normalize();
    for (const side of [-1, 1]) {
      positions.push(p.x + normal.x * (offset + side * width / 2), p.y + lifted, p.z + normal.z * (offset + side * width / 2));
      uv.push((side + 1) / 2, i * .06);
    }
    if (i < 350) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new BufferGeometry(); geo.setAttribute("position", new Float32BufferAttribute(positions, 3)); geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
