export interface VisitView {
  roomId: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
}
export const roomViews = new Map<string, VisitView>();
export let cinemaReturn: VisitView | undefined;
export let cinemaOrigin = "wallpapers";
export let cinemaOriginMode: "index" | "tour" | "explore" = "explore";
export function rememberCinema(
  view: VisitView | undefined,
  roomId = "wallpapers",
  mode: "index" | "tour" | "explore" = "explore",
) {
  cinemaReturn = view;
  cinemaOrigin = roomId;
  cinemaOriginMode = mode;
}
