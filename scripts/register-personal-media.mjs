import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  cp,
  rm,
  lstat,
  realpath,
} from "node:fs/promises";
import { parseFile } from "music-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = process.env.PALACE_MEDIA_ROOT
  ? path.resolve(process.env.PALACE_MEDIA_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folders = [
  "projects",
  "wallpapers",
  "chatgpt-images",
  "music",
  "research",
];
const publicBuild = process.argv.includes("--public");
const image = /\.(png|jpe?g|webp|avif)$/i;
const audio = /\.(mp3|flac|wav|m4a)$/i;
const readJSON = async (p) => {
  try {
    return JSON.parse((await readFile(p, "utf8")).replace(/^\uFEFF/, ""));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
};
const global = await readJSON(
  path.join(root, "personal-media/collection.json"),
);
const result = {
  wallpapers: [],
  visuals: [],
  music: [],
  projects: [],
  research: [],
};
const output = path.join(root, "public/personal-media");
// This directory contains only generated copies. Resolve and validate before cleanup.
if (path.resolve(output) !== path.resolve(root, "public", "personal-media"))
  throw new Error("Invalid generated output path");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
async function walk(dir, prefix = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(...(await walk(path.join(dir, entry.name), rel)));
    else if (entry.isFile()) files.push(rel);
  }
  return files.sort();
}
for (const folder of folders) {
  const dir = path.join(root, "personal-media", folder);
  await mkdir(dir, { recursive: true });
  if (publicBuild) continue;
  const metadata = await readJSON(path.join(dir, "collection.json"));
  for (const file of await walk(dir)) {
    if (!(folder === "music" ? audio : image).test(file)) continue;
    const key = `${folder}/${file}`;
    const entries = Array.isArray(metadata)
      ? metadata
      : metadata.items || metadata;
    const info = {
      ...(global[key] || {}),
      ...(Array.isArray(entries)
        ? entries.find((x) => x.file === file) || {}
        : entries[file] || (metadata.title ? metadata : {})),
    };
    const stem = path
      .basename(file)
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ");
    const id = `personal-${folder}-${Buffer.from(file).toString("hex")}`;
    const src = `/personal-media/${folder}/${file.split("/").map(encodeURIComponent).join("/")}`;
    // Only data fields are accepted. Metadata never supplies executable code or external URLs.
    const base = {
      id,
      title: String(info.title || stem),
      favorite: !!info.favorite,
      order: Number(info.order) || 0,
      color: /^#[0-9a-f]{6}$/i.test(info.color || "") ? info.color : undefined,
    };
    if (folder === "music") {
      let tags;
      try {
        tags = await parseFile(path.join(dir, file));
      } catch {
        console.warn(`Could not read audio tags: ${file}`);
      }
      const cover = tags?.common.picture?.[0];
      let coverUrl;
      if (cover && /^image\/(jpeg|png|webp)$/.test(cover.format)) {
        const ext = cover.format.split("/")[1];
        const name = `${id}.${ext}`;
        await mkdir(path.join(output, "music", "artwork"), { recursive: true });
        await writeFile(
          path.join(output, "music", "artwork", name),
          cover.data,
        );
        coverUrl = `/personal-media/music/artwork/${name}`;
      }
      result.music.push({
        ...base,
        title: String(info.title || tags?.common.title || stem),
        artist: String(info.artist || tags?.common.artist || "Unknown artist"),
        album: String(
          info.album || tags?.common.album || "Personal collection",
        ),
        cover: coverUrl,
        duration: tags?.format.duration,
        roomIds: Array.isArray(info.rooms)
          ? info.rooms.filter(
              (x) => typeof x === "string" && /^[a-z-]+$/.test(x),
            )
          : [],
        source: "static",
        src,
        year: String(info.year || tags?.common.year || "2026"),
      });
    } else {
      let projectUrl;
      if (folder === "projects" && typeof info.projectFile === "string") {
        const project = path.resolve(dir, info.projectFile);
        const relative = path.relative(dir, project);
        if (
          !relative.startsWith("..") &&
          !path.isAbsolute(relative) &&
          /\.html$/i.test(relative)
        ) {
          const stat = await lstat(project);
          const actualRelative = path.relative(
            await realpath(dir),
            await realpath(project),
          );
          if (
            stat.isFile() &&
            !stat.isSymbolicLink() &&
            !actualRelative.startsWith("..") &&
            !path.isAbsolute(actualRelative)
          ) {
            await mkdir(path.dirname(path.join(output, folder, relative)), {
              recursive: true,
            });
            await cp(project, path.join(output, folder, relative));
            projectUrl = `/personal-media/projects/${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
          }
        }
      }
      const item = {
        ...base,
        primary: !!info.primary,
        roomIds: Array.isArray(info.roomIds || info.rooms)
          ? (info.roomIds || info.rooms).filter((x) =>
              [
                "wallpapers",
                "imagined-worlds",
                "cosmic",
                "glass-life",
                "portraits",
                "editorial",
                "projects",
                "research",
              ].includes(x),
            )
          : undefined,
        projectUrl,
        github:
          typeof info.github === "string" &&
          /^https:\/\/github\.com\/YNS34-hub\/[\w.-]+\/(?:blob|tree)\/[^\s]+$/.test(
            info.github,
          )
            ? info.github
            : undefined,
        src,
        description: String(info.description || ""),
        tags: Array.isArray(info.tags) ? info.tags.map(String) : [],
        category: String(
          info.category || (folder === "chatgpt-images" ? "cosmic" : folder),
        ),
        source: String(
          info.origin ||
            (folder === "chatgpt-images"
              ? "AI-assisted visual study"
              : "Personal collection"),
        ),
        date: String(info.year || "2026"),
        fileName: file,
        width: Number(info.width) || undefined,
        height: Number(info.height) || undefined,
      };
      result[folder === "chatgpt-images" ? "visuals" : folder].push(item);
    }
    await mkdir(path.dirname(path.join(output, folder, file)), {
      recursive: true,
    });
    await cp(path.join(dir, file), path.join(output, folder, file));
  }
}
// Source images and metadata remain untouched.
for (const items of Object.values(result))
  items.sort((a, b) => a.order - b.order);
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(result, null, 2),
);
console.log(
  "Registered personal media:",
  Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length])),
);
