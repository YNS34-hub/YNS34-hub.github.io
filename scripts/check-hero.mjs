import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNonlinearGeometry, initNonlinearSphere } from "../sphere.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visited = new Set();
// This specifically checks the native import graph that Pages serves; a
// successful Vite bundle alone cannot catch missing vendor dependencies.
async function checkModule(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  const code = await readFile(path.join(root, relative), "utf8");
  for (const [, specifier] of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
    let dependency;
    if (specifier === "three") dependency = "vendor/three.module.min.js";
    else if (specifier.startsWith("three/addons/")) dependency = specifier.replace("three/addons/", "vendor/addons/");
    else if (specifier.startsWith(".")) dependency = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier));
    else throw new Error(`Unmapped import ${specifier}`);
    await checkModule(dependency);
  }
}
await checkModule("sphere.js");
console.log(`Pages import graph: ${visited.size} modules present.`);

for (const detail of [24, 48]) {
  const geometry = buildNonlinearGeometry(detail);
  const p = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const indices = geometry.index.array;
  const edges = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3);
    for (let j = 0; j < 3; j += 1) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert([...edges.values()].every(count => count === 2), "Glass must be a closed manifold without holes");
  assert.equal(p.count - edges.size + indices.length / 3, 2, "Unexpected sphere topology");
  assert(normals.array.every(Number.isFinite), "Invalid surface normals");
  const radii = Array.from({ length: p.count }, (_, i) => Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  assert(Math.max(...radii) - Math.min(...radii) > 0.4, "Geometry lost its nonlinear deformation");
  assert.equal(geometry.getAttribute("uv"), undefined, "This geometry must not rely on a poster UV map");
  console.log(`Detail ${detail}: ${p.count} vertices, ${indices.length / 3} triangles, closed manifold, finite normals.`);
  geometry.dispose();
}

globalThis.window = { matchMedia: () => ({ matches: false }) };
const stage = { dataset: {}, classList: { add() {}, remove() {} } };
const inaccessibleCanvas = { getContext() { throw new Error("Reduced motion must not request a context"); } };
assert.equal(initNonlinearSphere(inaccessibleCanvas, stage, { matches: true }).getState().renderMode, "reduced-motion-poster");
assert.equal(initNonlinearSphere({ getContext: () => null }, stage, { matches: false }).getState().renderMode, "webgl-unavailable-poster");
console.log("Reduced-motion and missing-WebGL fallbacks: passed. GPU rendering requires browser QA.");
