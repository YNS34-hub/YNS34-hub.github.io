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
