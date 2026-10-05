import type { MusicTrack } from "../content/types";

export function roomSoundtrack(
  roomId: string,
  tracks: MusicTrack[],
): MusicTrack | undefined {
  const base = roomId.split("-page-")[0];
  return [...tracks]
    .reverse()
    .find((track) => Boolean(track.src) && track.roomIds?.includes(base));
}
