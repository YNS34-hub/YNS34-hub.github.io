import type { ContentItem, WallpaperItem } from "./types";
/** Kept websites retain reference identity; an archive filename does not establish authorship. */
export function websiteStudy(work: WallpaperItem): ContentItem {
  return {
    id: work.id,
    title: work.title,
    subtitle: work.source,
    description: work.description,
    category: "experiment",
    year: work.date,
    status: "COLLECTED WEBSITE / REFERENCE",
    featured: false,
    roomType: "black-box",
    tags: ["Website study", "Reference"],
    cover: work.displaySrc || work.src,
    demo: work.projectUrl,
    github: work.github,
  };
}
