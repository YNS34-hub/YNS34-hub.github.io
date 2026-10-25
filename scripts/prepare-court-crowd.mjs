import { readFile, writeFile, mkdir } from "node:fs/promises";
import { AnimationMixer, Box3, BufferGeometry, Float32BufferAttribute, LoadingManager, Texture, Vector3 } from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const source = "E:/Temp/palace-court-source/people/", root = "public/media/court/people/";
const meta = JSON.parse(await readFile("E:/Temp/palace-court-source/rocketbox-source.json", "utf8"));
const manager = new LoadingManager();
// 离线只解析 FBX 的几何和骨骼；原纹理由 Python 转为 WebP，不在 Node 中模拟浏览器图像解码。
manager.addHandler(/.*/, { path: "", setPath(p) { this.path = p; return this; }, load(file) { const t = new Texture(); t.userData.file = file; return t; } });
async function readFBX(file) { const b = await readFile(source + file); return new FBXLoader(manager).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ""); }
const male = (await readFBX("m_idle_neutral_01.max.fbx")).animations[0], female = (await readFBX("f_idle_neutral_01.max.fbx")).animations[0];
for (const [number, name] of meta.names.entries()) {
  const original = await readFBX(name + "/" + name + ".fbx"), mixer = new AnimationMixer(original);
  // 使用原库中的真实站立动作选取不同停留姿态，不让场边出现整齐的 T 型人偶。
  const clip = name.startsWith("Female") ? female : male;
  const boneNames = new Set(); original.traverse(o => { if (o.isBone) boneNames.add(o.name); });
  const compatible = clip.clone(); compatible.tracks = compatible.tracks.filter(t => boneNames.has(t.name.split(".")[0]));
  mixer.clipAction(compatible).play(); mixer.setTime(1.3 + number * 1.17); original.updateMatrixWorld(true);
  original.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const parts = [], bounds = new Box3(), point = new Vector3();
  original.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry, positions = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      point.fromBufferAttribute(g.attributes.position, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, point); point.applyMatrix4(o.matrixWorld); point.toArray(positions, i * 3); bounds.expandByPoint(point);
    }
    parts.push({ g, materials: Array.isArray(o.material) ? o.material : [o.material], positions });
  });
  const height = bounds.max.y - bounds.min.y, scale = (name.startsWith("Female") ? 1.68 : 1.8) / height, centerX = (bounds.min.x + bounds.max.x) / 2, centerZ = (bounds.min.z + bounds.max.z) / 2;
  const views = [], accessors = [], chunks = [], meshes = [], materials = [], images = [], textures = []; let offset = 0;
  const pack = (array, size, type) => {
    const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength), padding = (4 - data.length % 4) % 4;
    const view = views.length; views.push({ buffer: 0, byteOffset: offset, byteLength: data.length }); chunks.push(data, Buffer.alloc(padding)); offset += data.length + padding;
    const values = { bufferView: view, componentType: type, count: array.length / size, type: ({ 1: "SCALAR", 2: "VEC2", 3: "VEC3" })[size] };
    if (size === 3) { const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < array.length; i++) { low[i % 3] = Math.min(low[i % 3], array[i]); high[i % 3] = Math.max(high[i % 3], array[i]); } values.min = low; values.max = high; }
    accessors.push(values); return accessors.length - 1;
  };
  for (const part of parts) {
    for (let i = 0; i < part.positions.length; i += 3) { part.positions[i] = (part.positions[i] - centerX) * scale; part.positions[i + 1] = (part.positions[i + 1] - bounds.min.y) * scale; part.positions[i + 2] = (part.positions[i + 2] - centerZ) * scale; }
    const baked = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(part.positions, 3));
    if (part.g.index) baked.setIndex(part.g.index.clone()); baked.computeVertexNormals();
    // FBX 的颜色贴图按 Texture.flipY=true 使用；glTF 按 false 使用，必须转换 V 轴。
    const uv = new Float32Array(part.g.attributes.uv.array); for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i];
    const attributes = { POSITION: pack(part.positions, 3, 5126), NORMAL: pack(baked.attributes.normal.array, 3, 5126), TEXCOORD_0: pack(uv, 2, 5126) };
    const fullIndex = baked.index ? Array.from(baked.index.array) : Array.from({ length: baked.attributes.position.count }, (_, i) => i), primitives = [];
    for (const group of part.g.groups.length ? part.g.groups : [{ start: 0, count: fullIndex.length, materialIndex: 0 }]) {
      const m = part.materials[group.materialIndex], file = m.map?.userData.file?.split(/[\\/]/).at(-1)?.replace(/\.tga$/i, ".webp");
      if (!file) throw new Error("Missing real texture: " + name + " / " + m.name);
      images.push({ uri: file }); textures.push({ source: images.length - 1 });
      materials.push({ name: m.name, doubleSided: !!m.alphaMap, ...(m.alphaMap ? { alphaMode: "MASK", alphaCutoff: .4 } : {}), pbrMetallicRoughness: { baseColorTexture: { index: textures.length - 1 }, metallicFactor: 0, roughnessFactor: .87 } });
      primitives.push({ attributes, indices: pack(new Uint32Array(fullIndex.slice(group.start, group.start + group.count)), 1, 5125), material: materials.length - 1 });
    }
    meshes.push({ primitives }); baked.dispose();
  }
  await mkdir(root + name, { recursive: true });
  const gltf = { asset: { version: "2.0", generator: "Memory Palace / static MIT Rocketbox pose bake" }, scene: 0, scenes: [{ nodes: meshes.map((_, i) => i) }], nodes: meshes.map((_, i) => ({ mesh: i })), meshes, materials, images, textures, accessors, bufferViews: views, buffers: [{ uri: "pose.bin", byteLength: offset }] };
  await writeFile(root + name + "/pose.gltf", JSON.stringify(gltf)); await writeFile(root + name + "/pose.bin", Buffer.concat(chunks));
  mixer.stopAllAction(); mixer.uncacheRoot(original); console.log(name, "baked height", (height * scale).toFixed(2), "triangles", parts.reduce((sum, p) => sum + (p.g.index?.count || p.g.attributes.position.count) / 3, 0));
}
