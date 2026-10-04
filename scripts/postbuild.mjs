import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.PALACE_OUTPUT_DIR
  ? path.resolve(process.env.PALACE_OUTPUT_DIR)
  : path.join(root, "dist");
const origin = "https://yns34-hub.github.io";
const escape = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const load = async (name) =>
  JSON.parse(
    await readFile(path.join(root, "content", `${name}.json`), "utf8"),
  );
const [projects, research, experiments, archive, rooms, profile] =
  await Promise.all(
    ["projects", "research", "experiments", "archive", "rooms", "profile"].map(
      load,
    ),
  );
const original = await readFile(path.join(dist, "index.html"), "utf8");

// Visible text is a useful no-JavaScript collection; React hides the duplicate after mounting.
const collection = `<section id="static-collection" aria-label="Searchable museum collection" style="max-width:68rem;margin:4rem auto;padding:2rem;font:16px/1.6 sans-serif"><h1>The Memory Palace</h1><p>${escape(profile.bio)}</p>${[
  [projects, "projects"],
  [research, "research"],
  [experiments, "experiments"],
  [archive, "archive"],
]
  .map(
    ([items, section]) =>
      `<h2>${escape(section)}</h2><ul>${items.map((item) => `<li><a href="/${section}/${escape(item.id)}/">${escape(item.title)}</a> — ${escape(item.subtitle)}<p>${escape(item.description)}</p></li>`).join("")}</ul>`,
  )
  .join(
    "",
  )}<p><a href="/legacy/">Original academic portfolio</a> · <a href="${escape(profile.github)}">GitHub</a></p></section>`;
const hideStatic =
  "<style>body:has(#root > *) #static-collection{display:none}</style>";
const home = original
  .replace("</head>", `${hideStatic}</head>`)
  .replace("</body>", `${collection}</body>`);
await writeFile(path.join(dist, "index.html"), home);
await writeFile(path.join(dist, "404.html"), home);
await writeFile(path.join(dist, ".nojekyll"), "");
const routeList = ["/"];
let generatedRoutes = 1;
const renderRoute = async (route, title, description, item, indexable = true) => {
  const url = `${origin}/${route}/`;
  let html = home
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escape(title)} — The Memory Palace</title>`,
    )
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escape(description)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:title" content="${escape(title)} — The Memory Palace" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${escape(description)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:url" content="${url}" />`,
    );
  if (!indexable) {
    html = html.replace(
      "</head>",
      '<meta name="robots" content="noindex, follow" /></head>',
    );
  }
  if (item) {
    const semantic = `<article id="static-collection" style="max-width:52rem;margin:4rem auto;padding:2rem;font:16px/1.7 sans-serif"><nav><a href="/">The Memory Palace</a></nav><h1>${escape(item.title)}</h1><p>${escape(item.subtitle)}</p><p>${escape(item.description)}</p>${item.abstract ? `<h2>Research note</h2><p>${escape(item.abstract)}</p>` : ""}${item.equation ? `<p>${escape(item.equation)}</p>` : ""}<p>${escape(item.status)} · ${escape(item.year)}</p><p>${item.tags.map(escape).join(" · ")}</p>${item.github ? `<p><a href="${escape(item.github)}">GitHub repository</a></p>` : ""}${item.demo ? `<p><a href="${escape(item.demo)}">Open exhibit</a></p>` : ""}${(item.links || []).map((link) => `<p><a href="${escape(link.url)}">${escape(link.label)}</a></p>`).join("")}</article>`;
    html = html.replace(collection, semantic);
    const structured = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: item.title,
      description: item.description,
      url,
      ...(item.tags.includes("Fork")
        ? {}
        : { creator: { "@type": "Person", name: profile.name } }),
      keywords: item.tags.join(", "),
    };
    html = html.replace(
      "</head>",
      `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script></head>`,
    );
  }
  const folder = path.join(dist, route);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "index.html"), html);
  generatedRoutes += 1;
  if (indexable) routeList.push(`/${route}/`);
};
for (const room of rooms.filter((room) => room.id !== "atrium")) {
  // Hidden rooms remain directly shareable without appearing in the public index.
  await renderRoute(room.id, room.title, room.subtitle, undefined, !room.hidden);
}
for (const [items, section] of [
  [projects, "projects"],
  [research, "research"],
  [experiments, "experiments"],
  [archive, "archive"],
]) {
  for (const item of items) {
    await renderRoute(`${section}/${item.id}`, item.title, item.subtitle, item);
    await renderRoute(`exhibit-${item.id}`, item.title, item.subtitle, item);
  }
}
await renderRoute("about", profile.name, profile.bio);
await writeFile(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routeList.map((route) => `<url><loc>${origin}${route}</loc></url>`).join("")}</urlset>\n`,
);
await writeFile(
  path.join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
console.log(
  `Static collection, ${generatedRoutes} shareable routes (${routeList.length} indexed), sitemap and GitHub Pages fallback generated. Legacy routes preserved.`,
);
