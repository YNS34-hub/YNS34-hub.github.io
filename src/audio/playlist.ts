import type { MusicTrack } from "../content/types";

/** External share links are collectible, but never masquerade as playable audio. */
export function playableTracks(tracks: MusicTrack[]): MusicTrack[] {
  return tracks.filter((track) => Boolean(track.src));
}

export function adjacentTrack(
  tracks: MusicTrack[],
  currentId: string | null,
  direction: 1 | -1,
  shuffle = false,
  wrap = true,
  random = Math.random,
): MusicTrack | undefined {
  const playable = playableTracks(tracks);
  if (!playable.length) return undefined;
  const index = playable.findIndex((track) => track.id === currentId);
  if (shuffle && playable.length > 1) {
    const alternatives = playable.filter((track) => track.id !== currentId);
    return alternatives[
      Math.min(
        alternatives.length - 1,
        Math.floor(random() * alternatives.length),
      )
    ];
  }
  if (index === -1) return direction === 1 ? playable[0] : playable.at(-1);
  const next = index + direction;
  if (!wrap && (next < 0 || next >= playable.length)) return undefined;
  return playable[(next + playable.length) % playable.length];
}
