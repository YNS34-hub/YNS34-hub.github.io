import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
const execute = promisify(execFile);
const api = async (endpoint) =>
  JSON.parse(
    (await execute("gh", ["api", endpoint], { maxBuffer: 12 * 1024 * 1024 }))
      .stdout,
  );
const repos = await api("users/YNS34-hub/repos?per_page=100");
const snapshot = [];
for (const repo of repos.filter((r) => !r.private)) {
  const record = {
    name: repo.name,
    github: repo.html_url,
    fork: repo.fork,
    archived: repo.archived,
    classification: repo.fork
      ? "REFERENCE"
      : repo.archived
        ? "ARCHIVE"
        : ["YNS34-hub", "Jie-Tian"].includes(repo.name)
          ? "PROFILE"
          : "ORIGINAL",
    homepage: repo.homepage || "",
    defaultBranch: repo.default_branch,
    images: [],
    readmeLinks: [],
  };
  if (record.classification === "ORIGINAL") {
    try {
      const [tree, readme] = await Promise.all([
        api(
          `repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
        ),
        api(`repos/${repo.full_name}/readme`),
      ]);
      record.images = tree.tree
        .filter(
          (x) =>
            x.type === "blob" &&
            /\.(png|jpe?g|webp|avif)$/i.test(x.path) &&
            /^(README|docs\/|public\/|assets\/|screenshots\/|preview\/|images\/)/i.test(
              x.path,
            ),
        )
        .map((x) => x.path);
      const text = Buffer.from(readme.content, "base64").toString("utf8");
      record.readmeLinks = [
        ...new Set(
          (text.match(/https?:\/\/[^\s)"<>]+/g) || []).filter((url) =>
            /github\.io|vercel\.app|netlify\.app|githubusercontent/.test(url),
          ),
        ),
      ];
      record.treeTruncated = !!tree.truncated;
    } catch (error) {
      record.scanError = error.message;
    }
  }
  snapshot.push(record);
}
await writeFile(
  "content/public-project-audit.json",
  JSON.stringify(
    { checkedAt: new Date().toISOString(), repositories: snapshot },
    null,
    2,
  ) + "\n",
);
// Only promote deliberately curated original projects. New repositories await review in Archive.
const projects = JSON.parse(await readFile("content/projects.json", "utf8"));
const archive = JSON.parse(await readFile("content/archive.json", "utf8"));
const existing = new Set([...projects, ...archive].map((x) => x.github));
for (const repo of snapshot.filter(
  (r) => r.classification === "ORIGINAL" && !existing.has(r.github),
)) {
  archive.push({
    id: repo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: repo.name,
    subtitle: "Awaiting curation.",
    description:
      "A public original repository awaiting a closer curatorial review. Kept in the archive until its visual quality and state have been verified.",
    category: "archive",
    github: repo.github,
    year: "2026",
    featured: false,
    roomType: "archive",
    tags: ["Prototype"],
    status: "PROTOTYPE / awaiting curation",
  });
}
await writeFile(
  "content/archive.json",
  JSON.stringify(archive, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    snapshot.map((r) => ({
      name: r.name,
      class: r.classification,
      images: r.images.length,
      error: r.scanError,
    })),
    null,
    2,
  ),
);
