import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNonlinearGeometry, initNonlinearSphere } from "../sphere.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Raycaster, Vector3, DoubleSide } from "three";
import { parseAst } from "rollup/parseAst";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visited = new Set();
// This specifically checks the native import graph that Pages serves; a
// successful Vite bundle alone cannot catch missing vendor dependencies.
async function checkModule(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  const code = await readFile(path.join(root, relative), "utf8");
  for (const declaration of parseAst(code).body.filter(node => node.source)) {
    const specifier = declaration.source.value;
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

const bytes = await readFile(path.join(root, "assets/nonlinear-glass.glb"));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
const meshes = [];
gltf.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
assert.equal(meshes.length, 1, "GLB must have a single sculpture mesh");
const desktop = meshes[0];
assert(desktop.geometry.index.count / 3 >= 50000 && desktop.geometry.index.count / 3 <= 100000);
const metadata = JSON.parse(await readFile(path.join(root, "assets/nonlinear-glass.mesh.json"), "utf8"));
assert.equal(desktop.geometry.index.count / 3, metadata.triangles);
desktop.material.side = DoubleSide;
desktop.updateMatrixWorld(true);
const ray = new Raycaster(new Vector3(), new Vector3(...metadata.undercutProof.direction));
const hits = ray.intersectObject(desktop).map(hit => hit.distance);
const crossings = hits.filter((distance, i) => i === 0 || distance - hits[i - 1] > 1e-5);
assert(crossings.length >= 3, "GLB must retain real undercut lips, not a radial height field");

for (const [label, geometry] of [["Mobile detail 24", buildNonlinearGeometry(24)], ["Desktop GLB", desktop.geometry]]) {
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
  console.log(`${label}: ${p.count} vertices, ${indices.length / 3} triangles, closed manifold, finite normals.`);
  geometry.dispose();
}
desktop.material.dispose();

globalThis.window = { matchMedia: () => ({ matches: false }) };
const stage = { dataset: {}, classList: { add() {}, remove() {} } };
const inaccessibleCanvas = { getContext() { throw new Error("Reduced motion must not request a context"); } };
assert.equal(initNonlinearSphere(inaccessibleCanvas, stage, { matches: true }).getState().renderMode, "reduced-motion-poster");
assert.equal(initNonlinearSphere({ getContext: () => null }, stage, { matches: false }).getState().renderMode, "webgl-unavailable-poster");
console.log("Reduced-motion and missing-WebGL fallbacks: passed. GPU rendering requires browser QA.");
