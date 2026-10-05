import type { RoomPlan } from "./roomPlan";

/** One material and lighting language, with a different curatorial temperature per room. */
export const museum = {
  wall: "#e4e0d7",
  ceiling: "#cecfc9",
  floor: "#bfc3be",
  reveal: "#929a97",
  joint: "#626d6b",
  metal: "#818c8b",
  ink: "#303c40",
  charcoal: "#242826",
  walnut: "#594337",
  ice: "#c4e5f5",
};

export function roomLighting(plan: RoomPlan, roomId: string) {
  const themes: Record<
    string,
    {
      background: string;
      sky: string;
      ground: string;
      key: string;
      keyIntensity: number;
      environment: number;
      hemisphere: number;
      dark: boolean;
    }
  > = {
    corridor: {
      background: "#102131",
      sky: "#81b3d2",
      ground: "#162937",
      key: "#c7a67c",
      keyIntensity: 0.65,
      environment: 0.38,
      hemisphere: 0.58,
      dark: true,
    },
    "liquid-web": {
      background: "#162c35",
      sky: "#90c8cf",
      ground: "#14252e",
      key: "#b8dadd",
      keyIntensity: 0.8,
      environment: 0.4,
      hemisphere: 0.55,
      dark: true,
    },
    experiments: {
      background: "#162c35",
      sky: "#90c8cf",
      ground: "#14252e",
      key: "#b8dadd",
      keyIntensity: 0.8,
      environment: 0.4,
      hemisphere: 0.55,
      dark: true,
    },
    editorial: {
      background: "#30261f",
      sky: "#c3b39d",
      ground: "#302b28",
      key: "#ebc28c",
      keyIntensity: 0.7,
      environment: 0.38,
      hemisphere: 0.5,
      dark: true,
    },
    projects: {
      background: "#18283d",
      sky: "#89aad7",
      ground: "#192134",
      key: "#bbcce0",
      keyIntensity: 1.3,
      environment: 0.45,
      hemisphere: 0.55,
      dark: true,
    },
    research: {
      background: "#121e2c",
      sky: "#9dd6ef",
      ground: "#142b3a",
      key: "#c7e3ec",
      keyIntensity: 0.7,
      environment: 0.4,
      hemisphere: 0.5,
      dark: true,
    },
    music: {
      background: "#09132b",
      sky: "#728bd2",
      ground: "#141c34",
      key: "#ebbd86",
      keyIntensity: 0.45,
      environment: 0.35,
      hemisphere: 0.45,
      dark: true,
    },
    wallpapers: {
      background: "#17222f",
      sky: "#779aaf",
      ground: "#122029",
      key: "#bdcedb",
      keyIntensity: 0.38,
      environment: 0.3,
      hemisphere: 0.4,
      dark: true,
    },
    "imagined-worlds": {
      background: "#070c21",
      sky: "#5568a2",
      ground: "#071225",
      key: "#9caddb",
      keyIntensity: 0.28,
      environment: 0.3,
      hemisphere: 0.4,
      dark: true,
    },
    "glass-life": {
      background: "#163b52",
      sky: "#8adbe3",
      ground: "#103453",
      key: "#c8eff2",
      keyIntensity: 0.8,
      environment: 0.5,
      hemisphere: 0.5,
      dark: true,
    },
    portraits: {
      background: "#191c26",
      sky: "#b9a493",
      ground: "#22202b",
      key: "#e5b28e",
      keyIntensity: 0.7,
      environment: 0.35,
      hemisphere: 0.4,
      dark: true,
    },
    archive: {
      background: "#283932",
      sky: "#a3b6a0",
      ground: "#333b31",
      key: "#e7c795",
      keyIntensity: 0.6,
      environment: 0.35,
      hemisphere: 0.55,
      dark: true,
    },
    unfinished: {
      background: "#101923",
      sky: "#57749e",
      ground: "#1b242d",
      key: "#748dad",
      keyIntensity: 0.38,
      environment: 0.25,
      hemisphere: 0.45,
      dark: true,
    },
    "my-collection": {
      background: "#173040",
      sky: "#98c5de",
      ground: "#25323e",
      key: "#e8cba4",
      keyIntensity: 0.75,
      environment: 0.4,
      hemisphere: 0.5,
      dark: true,
    },
  };
  const baseRoom = roomId.split("-page-")[0];
  const theme = themes[baseRoom === "cosmic" ? "imagined-worlds" : baseRoom];
  if (theme) return theme;
  const listening = plan.type === "listening";
  const archive = roomId.startsWith("archive");
  const dark = plan.dark || archive;
  return {
    background: listening ? "#252522" : dark ? "#22292b" : "#dce1df",
    sky: listening ? "#e4ddd2" : "#e2f0f6",
    ground: listening ? "#3c3027" : dark ? "#263032" : "#777d73",
    hemisphere: listening ? 0.36 : dark ? 0.43 : 0.48,
    key: listening ? "#ffe3bc" : roomId === "corridor" ? "#e4f3ff" : "#f4f4ec",
    keyIntensity: listening ? 0.16 : archive ? 0.8 : dark ? 0.38 : 2.35,
    environment: listening ? 0.28 : dark ? 0.32 : 0.38,
    dark,
  };
}
