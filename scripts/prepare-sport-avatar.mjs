import { readFile, writeFile } from "node:fs/promises";
import { AnimationClip, Box3, LoadingManager, Texture, Vector3, MeshStandardMaterial } from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const source = "E:/Temp/palace-sport-source/", output = "public/media/presence/";
// 导出只处理几何和动画；浏览器纹理沿用独立 WebP，不在 Node 里模拟图像解码。
const manager = new LoadingManager();
manager.addHandler(/.*/, { path: "", setPath(path) { this.path = path; return this; }, load(file) { const texture = new Texture(); texture.userData.file = file; return texture; } });
const loader = new FBXLoader(manager);
async function load(name) { const data = await readFile(source + name); return loader.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), ""); }
// GLTFExporter 的纯二进制封装需要 FileReader；没有 DOM、Canvas、网络或私人素材读取。
globalThis.FileReader = class { readAsDataURL(blob) { blob.arrayBuffer().then(data => { this.result = "data:application/octet-stream;base64," + Buffer.from(data).toString("base64"); this.onloadend?.(); }); } };
const model = await load("athlete.fbx"), bounds = new Box3().setFromObject(model), size = bounds.getSize(new Vector3());
const bones = new Map(), maps = new Map();
const lights = [];
model.traverse(object => {
  if (object.isLight) lights.push(object);
  if (object.isBone) bones.set(object.name, object);
  if (!object.isMesh) return;
  // 与 FBX 原 Texture.flipY 对应，转换 V 轴后外部 glTF 纹理按规范 flipY=false。
  const uv = object.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
    const color = material.map?.userData.file?.split(/[\\/]/).at(-1), normal = material.normalMap?.userData.file?.split(/[\\/]/).at(-1);
    maps.set(material.name, { color, normal });
    return new MeshStandardMaterial({ name: material.name, roughness: .8, metalness: 0 });
  });
  object.material = Array.isArray(object.material) ? materials : materials[0];
});
lights.forEach(light => light.removeFromParent());
// 保留授权动作的骨骼时序，仅移除根节点水平位移；实际位移始终由现有控制器产生。
const clips = [];
for (const [name, file] of [["idle", "m_idle_neutral_01.max.fbx"], ["walk", "m_walk_neutral_01.max.fbx"], ["run", "m_run_neutral_01.max.fbx"]]) {
  const raw = (await load(file)).animations[0], tracks = raw.tracks.filter(track => {
    const bone = track.name.split(".")[0];
    return bones.has(bone) && (bone === "Bip01" && track.name.endsWith(".position") || track.name.endsWith(".quaternion") && /^(Bip01|Bip01_(Pelvis|Spine\d*|Neck|Head|[LR]_.*))$/.test(bone));
  }).map(track => {
    const result = track.clone(), bone = bones.get(track.name.split(".")[0]);
    if (result.name.endsWith(".position")) { const initialY = result.values[1]; for (let i = 0; i < result.values.length; i += 3) { result.values[i] = bone.position.x; result.values[i + 1] = bone.position.y + result.values[i + 1] - initialY; result.values[i + 2] = bone.position.z; } }
    if (name === "idle") result.trim(0, 3.2);
    return result;
  });
  clips.push(new AnimationClip(name, name === "idle" ? 3.2 : raw.duration, tracks));
}
// 绑定姿态不做烘焙，保留完整骨骼供上篮/扣篮和踏板约束使用。公用模型高 1.90 m。
const factor = 1.90 / size.y; model.scale.multiplyScalar(factor); model.position.y -= bounds.min.y * factor;
model.updateMatrixWorld(true);
const data = await new GLTFExporter().parseAsync(model, { binary: false, animations: clips, onlyVisible: false });
const binary = Buffer.from(data.buffers[0].uri.split(",")[1], "base64"); data.buffers[0].uri = "athlete.bin";
data.images = []; data.textures = []; const textureIndices = new Map();
const texture = file => { const name = file.replace("m026_", "").replaceAll("_", "-").replace(/\.tga$/i, ".webp"); if (!textureIndices.has(name)) { data.images.push({ uri: name }); data.textures.push({ source: data.images.length - 1 }); textureIndices.set(name, data.textures.length - 1); } return textureIndices.get(name); };
for (const material of data.materials) {
  const map = maps.get(material.name); if (!map?.color) throw Error("Missing avatar color " + material.name);
  material.pbrMetallicRoughness = { baseColorFactor: [1, 1, 1, 1], baseColorTexture: { index: texture(map.color) }, metallicFactor: 0, roughnessFactor: .8 };
  if (map.normal) material.normalTexture = { index: texture(map.normal), scale: .45 };
  delete material.extensions; delete material.emissiveFactor;
}
data.extensionsUsed = (data.extensionsUsed ?? []).filter(name => name !== "KHR_materials_specular");
await writeFile(output + "athlete.gltf", JSON.stringify(data)); await writeFile(output + "athlete.bin", binary);
const joints = []; model.traverse(object => { if (object.isBone) { const p = object.getWorldPosition(new Vector3()); joints.push({ name: object.name, parent: object.parent?.name, position: p.toArray() }); } });
await writeFile(source + "athlete-joints.json", JSON.stringify(joints, null, 2));
console.log(JSON.stringify({ height: size.y * factor, clips: clips.map(c => [c.name, c.duration, c.tracks.length]), textures: data.images, materials: data.materials.map(m => m.name), binary: binary.length }, null, 2));
