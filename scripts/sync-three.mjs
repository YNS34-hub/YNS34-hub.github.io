import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pages serves native modules from the repository root. Vite resolves npm
// dependencies differently, so keep the ENTIRE browser import graph in sync.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/three");
const target = path.join(root, "vendor");
const visited = new Set();
const addons = [
  "environments/RoomEnvironment.js",
  "lights/RectAreaLightUniformsLib.js",
  "math/SimplexNoise.js",
  "utils/BufferGeometryUtils.js"
];

async function copyModule(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  const input = path.join(source, relative);
  const output = path.join(target, relative.replace(/^build\//, "").replace(/^examples\/jsm\//, "addons/"));
  await mkdir(path.dirname(output), { recursive: true });
  await copyFile(input, output);
  const code = await readFile(input, "utf8");
  for (const [, specifier] of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
    if (specifier.startsWith(".")) {
      await copyModule(path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier)));
    } else if (specifier.startsWith("three/addons/")) {
      await copyModule(specifier.replace("three/addons/", "examples/jsm/"));
    } else if (specifier !== "three") {
      throw new Error(`Unmapped browser dependency: ${specifier} in ${relative}`);
    }
  }
}

await copyModule("build/three.module.min.js");
for (const addon of addons) await copyModule(`examples/jsm/${addon}`);
await copyFile(path.join(source, "LICENSE"), path.join(target, "THREE-LICENSE.txt"));
console.log(`Synced ${visited.size} Three.js modules, including all relative imports.`);
