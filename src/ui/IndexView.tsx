import { useState } from "react";
import { ArrowUpRight, Search, ArrowLeft, Box } from "lucide-react";
import { allContent, profile } from "../content/catalog";
import { usePalaceStore } from "../systems/store";
import MusicPanel from "./MusicPanel";
import WallpaperPanel from "./WallpaperPanel";
import { PalaceMark } from "./primitives";
const tabs = [
  "Projects",
  "Research",
  "Music",
  "Wallpapers",
  "Experiments",
  "Unfinished",
  "About",
] as const;
type Tab = (typeof tabs)[number];
export default function IndexView() {
  const s = usePalaceStore();
  const tab = s.indexTab;
  const setTab = (next: Tab) => s.update({ indexTab: next });
  const [query, setQuery] = useState("");
  const categories = {
    Projects: "project",
    Research: "research",
    Experiments: "experiment",
    Unfinished: "archive",
  };
  const items = allContent
    .filter(
      (item) => item.category === categories[tab as keyof typeof categories],
    )
    .filter((item) =>
      `${item.title} ${item.description} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <div className="index-view">
      <header className="index-header">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            s.update({ mode: "explore", started: true });
            s.enterRoom("atrium");
          }}
          className="wordmark"
        >
          <PalaceMark /> THE MEMORY PALACE
        </a>
        <span className="eyebrow">JIE TIAN / COLLECTION INDEX</span>
        <button
          className="text-button"
          onClick={() =>
            s.update({
              mode: window.matchMedia("(pointer:coarse)").matches
                ? "tour"
                : "explore",
              started: true,
            })
          }
        >
          <Box size={16} /> ENTER THE SPACE
        </button>
      </header>
      <div className="index-layout">
        <aside className="index-sidebar">
          <p className="eyebrow">A WORLD IN PROGRESS</p>
          <nav aria-label="Collection categories">
            {tabs.map((t, i) => (
              <button
                aria-current={t === tab ? "page" : undefined}
                className={t === tab ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                <small>0{i + 1}</small>
                {t}
                <ArrowUpRight size={16} />
              </button>
            ))}
          </nav>
          <div className="index-sidebar-footer">
            <p>
              Projects, research, music,
              <br />
              images and experiments.
            </p>
            <a href={`mailto:${profile.email}`}>Get in touch ↗</a>
            <small>THIS PLACE CONTINUES TO GROW.</small>
          </div>
        </aside>
        <main className="index-content" id="collection">
          <div className="index-title">
            <p className="eyebrow">
              THE COLLECTION / {String(tabs.indexOf(tab) + 1).padStart(2, "0")}
            </p>
            <h1>{tab === "Unfinished" ? "Unfinished futures." : `${tab}.`}</h1>
            <p>
              {tab === "Research"
                ? "Mathematical ideas, given room to breathe."
                : tab === "Unfinished"
                  ? "Ideas still becoming. Nothing here needs to be finished."
                  : tab === "Projects"
                    ? "Things made, explored, and put into the world."
                    : tab === "Music"
                      ? "An intimate collection. Bring something you love."
                      : tab === "Wallpapers"
                        ? "Images to inhabit, rather than scroll past."
                        : tab === "Experiments"
                          ? "Small questions with unpredictable answers."
                          : "Mathematics, machines, and meaningful questions."}
            </p>
          </div>
          {["Projects", "Research", "Experiments", "Unfinished"].includes(
            tab,
          ) && (
            <>
              <label className="index-search">
                <Search size={17} />
                <input
                  type="search"
                  aria-label="Search collection"
                  placeholder="Find a work, a thought, a medium…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <small>{items.length} WORKS</small>
              </label>
              <div className="index-items">
                {items.map((item, i) => (
                  <button
                    className="index-item"
                    key={item.id}
                    onClick={() => s.focusItem(item)}
                  >
                    <span className="index-item-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.cover ? (
                      <img src={item.cover} alt="" loading="lazy" />
                    ) : (
                      <span className="index-equation">
                        {item.equation || "Ω"}
                      </span>
                    )}
                    <span className="index-item-copy">
                      <span className="eyebrow">
                        {item.status} / {item.year}
                      </span>
                      <h2>{item.title}</h2>
                      <p>{item.subtitle}</p>
                      <span className="index-tags">
                        {item.tags.slice(0, 3).join(" · ")}
                      </span>
                    </span>
                    <ArrowUpRight className="index-arrow" size={24} />
                  </button>
                ))}
                {items.length === 0 && (
                  <p className="empty-search">
                    No works match that thought. Try another word.
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "Music" && <MusicPanel />}
          {tab === "Wallpapers" && <WallpaperPanel galleryId="wallpapers" />}
          {tab === "About" && (
            <article className="index-about">
              <h2>{profile.name}</h2>
              <p>{profile.role}</p>
              <p>{profile.bio}</p>
              <p>{profile.institution}</p>
              <blockquote>“{profile.principle}”</blockquote>
              <div className="about-links">
                <a href={profile.github} target="_blank" rel="noreferrer">
                  GitHub ↗
                </a>
                <a href={profile.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn ↗
                </a>
                <a href={`mailto:${profile.email}`}>Email ↗</a>
                <a href="/legacy/">Original portfolio ↗</a>
              </div>
            </article>
          )}
          <footer className="index-footer">
            <span>JIE TIAN · {new Date().getFullYear()}</span>
            <button
              className="text-button"
              onClick={() => {
                s.enterRoom("atrium");
                s.update({ mode: "explore", started: true });
              }}
            >
              <ArrowLeft size={14} /> RETURN TO THE PALACE
            </button>
            <span>A LIVING ARCHIVE</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
