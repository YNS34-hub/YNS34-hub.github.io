import { beforeEach, describe, expect, it, vi } from "vitest";
import { allContent } from "../src/content/catalog";

const storage = new Map<string, string>();
const location = { href: "https://palace.test/" };
const replaceState = vi.fn((_state: unknown, _title: string, path: string) => {
  location.href = new URL(path, location.href).href;
});
const pushState = vi.fn((_state: unknown, _title: string, path: string) => {
  location.href = new URL(path, location.href).href;
});
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});
vi.stubGlobal("window", {
  location,
  localStorage,
  matchMedia: () => ({ matches: false }),
  history: { replaceState, pushState },
});
vi.stubGlobal("document", { exitPointerLock: vi.fn() });
const { usePalaceStore, resolvePalaceRoute } = await import(
  "../src/systems/store"
);
const initial = usePalaceStore.getState();
const project = allContent.find((item) => item.category === "project")!;
const research = allContent.find((item) => item.category === "research")!;

beforeEach(() => {
  storage.clear();
  location.href = "https://palace.test/";
  usePalaceStore.setState({
    ...initial,
    visits: {},
    viewed: [],
    recent: [],
    bookmarks: [],
  });
  replaceState.mockClear();
  pushState.mockClear();
});

describe("shareable palace navigation", () => {
  it("resolves stable room paths, item paths and index links, including static trailing slashes", () => {
    expect(resolvePalaceRoute("/music/").roomId).toBe("music");
    expect(
      resolvePalaceRoute(`/projects/${project.id}/`, "?view=index"),
    ).toMatchObject({ roomId: "projects", focus: project, index: true });
    expect(resolvePalaceRoute("/about/")).toMatchObject({
      roomId: "atrium",
      about: true,
    });
    expect(resolvePalaceRoute(`/projects/${research.id}`).focus).toBeNull();
    expect(resolvePalaceRoute("/missing-room").roomId).toBe("atrium");
    expect(resolvePalaceRoute("/projects-page-12").roomId).toBe(
      "projects-page-12",
    );
    expect(resolvePalaceRoute("/wallpapers-page-3").roomId).toBe(
      "wallpapers-page-3",
    );
    expect(resolvePalaceRoute("/anomaly-gravity").roomId).toBe(
      "anomaly-gravity",
    );
    expect(resolvePalaceRoute("/anomaly-missing").roomId).toBe("atrium");
    expect(() => resolvePalaceRoute("/%invalid")).not.toThrow();
  });
  it("restores a deep exhibit without changing browser history or overriding its route", () => {
    usePalaceStore
      .getState()
      .syncRoute(`/projects/${project.id}`, "?view=index");
    expect(usePalaceStore.getState()).toMatchObject({
      roomId: "projects",
      lastRoom: "projects",
      started: true,
      mode: "index",
      focus: project,
    });
    expect(usePalaceStore.getState().visits.projects).toBe(1);
    expect(usePalaceStore.getState().viewed).toContain(project.id);
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
  it("resolves an individual exhibit room only when its configured content exists", () => {
    expect(resolvePalaceRoute(`/exhibit-${project.id}/`)).toMatchObject({
      roomId: `exhibit-${project.id}`,
      focus: null,
      entered: true,
    });
    expect(resolvePalaceRoute(`/exhibit-${research.id}/`)).toMatchObject({
      roomId: `exhibit-${research.id}`,
      focus: null,
    });
    expect(resolvePalaceRoute("/exhibit-unknown-content").roomId).toBe(
      "atrium",
    );
    usePalaceStore.getState().syncRoute(`/exhibit-${project.id}`);
    expect(usePalaceStore.getState()).toMatchObject({
      roomId: `exhibit-${project.id}`,
      lastRoom: `exhibit-${project.id}`,
      focus: null,
      started: true,
    });
    expect(usePalaceStore.getState().visits[`exhibit-${project.id}`]).toBe(1);
  });
  it("preserves the previous room for Continue Exploring when landing at the atrium", () => {
    usePalaceStore.setState({ lastRoom: "music" });
    usePalaceStore.getState().syncRoute("/");
    expect(usePalaceStore.getState()).toMatchObject({
      roomId: "atrium",
      lastRoom: "music",
      started: false,
    });
    expect(usePalaceStore.getState().visits).toEqual({});
  });
  it("keeps browser back navigation, close-focus navigation and 2D links consistent", () => {
    const state = usePalaceStore.getState();
    state.update({ mode: "index", started: true });
    state.enterRoom("projects");
    state.focusItem(project);
    expect(location.href).toBe(
      `https://palace.test/projects/${project.id}?view=index`,
    );
    state.focusItem(null);
    expect(location.href).toBe("https://palace.test/projects?view=index");
    state.enterRoom("research");
    expect(location.href).toBe("https://palace.test/research?view=index");
    location.href = "https://palace.test/projects?view=index";
    state.syncRoute("/projects", "?view=index");
    expect(usePalaceStore.getState()).toMatchObject({
      roomId: "projects",
      focus: null,
    });
    state.update({ mode: "explore" });
    expect(location.href).toBe("https://palace.test/projects");
  });
  it("returns an exhibit opened inside a procedural room to that same architecture", () => {
    const state = usePalaceStore.getState();
    state.enterRoom("anomaly-floating");
    state.focusItem(project);
    expect(usePalaceStore.getState().roomId).toBe("anomaly-floating");
    state.focusItem(null);
    expect(location.href).toBe("https://palace.test/anomaly-floating");
  });
  it("restores spatial mode when browser history returns from the index to a spatial URL", () => {
    const state = usePalaceStore.getState();
    state.syncRoute("/projects", "?view=index");
    expect(usePalaceStore.getState().mode).toBe("index");
    state.syncRoute("/music");
    expect(usePalaceStore.getState().mode).toBe("explore");
  });
  it("retains visit memory, bookmarks and comfort settings after a storage rehydrate", async () => {
    const state = usePalaceStore.getState();
    for (let i = 0; i < 12; i++) state.enterRoom(`room-${i}`);
    state.toggleBookmark("music");
    state.update({ quality: "low", reducedMotion: true, tutorialDone: true });
    const saved = storage.get("memory-palace:v3")!;
    const serialized = JSON.parse(saved).state;
    expect(serialized.recent).toHaveLength(8);
    expect(serialized).not.toHaveProperty("started");
    expect(serialized).not.toHaveProperty("focus");
    usePalaceStore.setState({
      ...initial,
      bookmarks: [],
      recent: [],
      visits: {},
    });
    storage.set("memory-palace:v3", saved);
    await usePalaceStore.persist.rehydrate();
    expect(usePalaceStore.getState()).toMatchObject({
      lastRoom: "room-11",
      bookmarks: ["music"],
      quality: "low",
      reducedMotion: true,
      tutorialDone: true,
    });
    expect(usePalaceStore.getState().visits["room-0"]).toBe(1);
  });
});
