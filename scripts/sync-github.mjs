/** Optional public-data enhancement. The checked-in collection is always sufficient. */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const account = "YNS34-hub";
const dryRun = process.argv.includes("--dry-run");
const readContent = async (name) =>
  JSON.parse(await readFile(path.join(root, "content", name), "utf8"));
const execFileAsync = promisify(execFile);
async function fetchRepositories(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "The-Memory-Palace-Public-Snapshot",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
    return await response.json();
  } catch (error) {
    // curl can honor a configured HTTPS proxy/CA in environments where native fetch cannot.
    // It is an optional transport fallback; absence never changes the existing collection.
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "--fail",
          "--silent",
          "--show-error",
          "--max-time",
          "12",
          "-H",
          "Accept: application/vnd.github+json",
          url,
        ],
        { maxBuffer: 4 * 1024 * 1024 },
      );
      return JSON.parse(stdout);
    } catch {
      throw error;
    }
  }
}
try {
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await fetchRepositories(
      `https://api.github.com/users/${account}/repos?per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch)) throw new Error("Invalid repository response");
    repos.push(...batch.filter((repo) => !repo.private));
    if (batch.length < 100) break;
  }
  const snapshot = {
    account,
    syncedAt: new Date().toISOString(),
    repositories: repos.map((repo) => ({
      name: repo.name,
      github: repo.html_url,
      description: repo.description || "",
      fork: repo.fork,
      archived: repo.archived,
      language: repo.language || "",
      createdAt: repo.created_at,
      homepage: repo.homepage || "",
      topics: repo.topics || [],
    })),
  };
  const projects = await readContent("projects.json");
  const archive = await readContent("archive.json");
  const known = new Set(
    [...projects, ...archive].map((item) => item.github).filter(Boolean),
  );
  const exclude = new Set([account, "Jie-Tian"]); // Profile-only repositories are not exhibits.
  let added = 0;
  for (const repo of repos) {
    if (known.has(repo.html_url) || repo.fork || exclude.has(repo.name))
      continue;
    const id = repo.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (projects.some((item) => item.id === id)) continue;
    const demo = /^https?:\/\//.test(repo.homepage || "")
      ? repo.homepage
      : undefined;
    projects.push({
      id,
      title: repo.name,
      subtitle:
        repo.description || "A public repository in the growing collection.",
      description:
        repo.description ||
        "Public repository. Add a curated description and an original gallery visual in content/projects.json.",
      category: "project",
      github: repo.html_url,
      ...(demo ? { demo } : {}),
      year: repo.created_at.slice(0, 4),
      date: repo.created_at.slice(0, 10),
      featured: false,
      roomType: repo.archived ? "archive" : "white-cube",
      tags: [...new Set([repo.language, ...repo.topics].filter(Boolean))].slice(
        0,
        6,
      ),
      status: repo.archived
        ? "Archived · public repository"
        : "Public repository · awaiting curation",
    });
    added++;
  }
  if (!dryRun) {
    await writeFile(
      path.join(root, "content/github-snapshot.json"),
      JSON.stringify(snapshot, null, 2) + "\n",
    );
    await writeFile(
      path.join(root, "content/projects.json"),
      JSON.stringify(projects, null, 2) + "\n",
    );
  }
  console.log(
    `${dryRun ? "Preview" : "Snapshot saved"}: ${repos.length} public repositories, ${added} new exhibits. Existing curation and fork attribution preserved.`,
  );
} catch (error) {
  console.warn(
    `GitHub sync unavailable: ${error instanceof Error ? error.message : String(error)}. The local collection remains unchanged and usable.`,
  );
}
