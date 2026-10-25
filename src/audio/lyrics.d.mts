export interface TrackLyrics {
  lines: { time: number | null; text: string }[];
  synced: boolean;
  source: string;
}
export function decodeLyrics(bytes: Uint8Array): string;
export function parseLyrics(raw: string, source?: string): TrackLyrics | undefined;
export function embeddedLyrics(tags?: { text?: string; timeStampFormat?: number; syncText?: { text: string; timestamp?: number }[] }[]): TrackLyrics | undefined;
export function lyricIndex(lyrics: TrackLyrics | undefined, seconds: number, offsetSeconds?: number): number;
