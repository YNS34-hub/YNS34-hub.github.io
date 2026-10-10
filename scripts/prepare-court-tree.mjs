import { readFile, writeFile } from "node:fs/promises";
import { MeshoptSimplifier } from "meshoptimizer";
import { BufferGeometry, Float32BufferAttribute } from "three";
// 精简真实枝干，树冠位置仍来自原模型；浏览器不下载两百多 MB 的原树。
await MeshoptSimplifier.ready; MeshoptSimplifier.useExperimentalFeatures = true;
const root = "E:/Temp/palace-court-source/jacaranda_tree/", gltf = JSON.parse(await readFile(root + "scene.gltf", "utf8")), buffer = await readFile(root + "jacaranda_tree.bin");
const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const read = n => { const a = gltf.accessors[n], v = gltf.bufferViews[a.bufferView], offset = (v.byteOffset || 0) + (a.byteOffset || 0), size = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[a.type], C = a.componentType === 5125 ? Uint32Array : a.componentType === 5123 ? Uint16Array : Float32Array; return new C(bytes, offset, a.count * size); };
const parts = [];
for (const [part, count] of [[0, 3300], [1, 2200]]) {
  const p = gltf.meshes[0].primitives[part], positions = read(p.attributes.POSITION), uv = read(p.attributes.TEXCOORD_0), normals = read(p.attributes.NORMAL), attributes = new Float32Array(positions.length / 3 * 5);
  for (let i = 0; i < positions.length / 3; i++) { attributes.set(normals.subarray(i * 3, i * 3 + 3), i * 5); attributes.set(uv.subarray(i * 2, i * 2 + 2), i * 5 + 3); }
  const sourceIndex = new Uint32Array(read(p.indices));
  let [indices, error] = MeshoptSimplifier.simplifyWithAttributes(sourceIndex, positions, 3, attributes, 5, [.02, .02, .02, .1, .1], null, count * 3, .05, ["Prune"]);
  if (indices.length > 24000) {
    // 原扫描的 UV 接缝阻止边折叠时，用小网格聚合保留枝干轮廓；只在离线执行。
    const cells = new Map(), representative = new Uint32Array(positions.length / 3), grid = part === 0 ? .15 : .075;
    for (let i = 0; i < representative.length; i++) { const key = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]].map(n => Math.round(n / grid)).join(":"); if (!cells.has(key)) cells.set(key, i); representative[i] = cells.get(key); }
    const compact = [], seen = new Set();
    for (let i = 0; i < sourceIndex.length; i += 3) { const a = representative[sourceIndex[i]], b = representative[sourceIndex[i + 1]], c = representative[sourceIndex[i + 2]], key = [a, b, c].sort((x, y) => x - y).join(":"); if (a !== b && b !== c && a !== c && !seen.has(key)) { compact.push(a, b, c); seen.add(key); } }
    indices = new Uint32Array(compact); error = null;
  }
  const remap = new Map(), pos = [], tex = [], index = [];
  for (const i of indices) { if (!remap.has(i)) { remap.set(i, remap.size); pos.push(...positions.subarray(i * 3, i * 3 + 3)); tex.push(...uv.subarray(i * 2, i * 2 + 2)); } index.push(remap.get(i)); }
  const g = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals();
  parts.push({ position: pos, normal: Array.from(g.attributes.normal.array), uv: tex, index }); g.dispose(); console.log(part, "wood", index.length / 3, "error", error);
}
const leaves = gltf.meshes[0].primitives[2], positions = read(leaves.attributes.POSITION), cells = new Map();
for (let i = 0; i < positions.length / 3; i += 31) {
  const p = Array.from(positions.subarray(i * 3, i * 3 + 3)), key = p.map(n => Math.round(n / .42)).join(":");
  if (!cells.has(key)) cells.set(key, p.map(n => +n.toFixed(3)));
}
await writeFile("public/media/court/tree/shape.json", JSON.stringify({ source: "Poly Haven / Jacaranda Tree / CC0", height: 19.32, parts, crown: [...cells.values()] }));
console.log("crown locations", cells.size);
