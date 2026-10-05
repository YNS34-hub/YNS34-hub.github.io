import { describe, expect, it } from "vitest";
import { parseLyrics, embeddedLyrics, lyricIndex, decodeLyrics } from "../src/audio/lyrics.mjs";

describe("local lyrics and playback position", () => {
  it("sorts repeated timestamps, joins translation and applies millisecond offsets", () => {
    const lyrics = parseLyrics("[ar:Local]\n[offset:-500]\n[00:12.25][00:24.250]Second memory\n[00:02]First memory\n[00:02.000]第二行");
    expect(lyrics?.synced).toBe(true);
    expect(lyrics?.lines).toEqual([
      { time: 1.5, text: "First memory\n第二行" },
      { time: 11.75, text: "Second memory" },
      { time: 23.75, text: "Second memory" },
    ]);
  });
  it("does not invent timestamps for plain text or empty lyrics", () => {
    expect(parseLyrics("First memory\nSecond memory")?.synced).toBe(false);
    expect(parseLyrics("[ti:Only metadata]")).toBeUndefined();
    expect(lyricIndex(parseLyrics("plain"), 20)).toBe(-1);
  });
  it("recognizes missing-lyric and instrumental placeholders without displaying metadata as song lyrics", () => {
    expect(parseLyrics('[00:00.00]暂无歌词')).toBeUndefined();
    expect(parseLyrics('{"t":0,"c":[{"tx":"作曲: local"}]}\n[00:05.00]纯音乐，请欣赏')).toBeUndefined();
    expect(parseLyrics('[00:00]No lyrics available')).toBeUndefined();
  });
  it("uses playback time including seeking backwards, before first line and user offset", () => {
    const lyrics = parseLyrics("[00:10]First\n[00:20]Second");
    expect(lyricIndex(lyrics, 5)).toBe(-1);
    expect(lyricIndex(lyrics, 22)).toBe(1);
    expect(lyricIndex(lyrics, 11)).toBe(0);
    expect(lyricIndex(lyrics, 19, 2)).toBe(1);
  });
  it("preserves bracketed words while separating real metadata and timestamp tokens", () => {
    expect(parseLyrics("[ar:Local artist]\n[00:01]Through [glass] and light")?.lines).toEqual([{ time: 1, text: "Through [glass] and light" }]);
  });
  it("converts embedded millisecond SYLT but keeps MPEG frame lyrics untimed", () => {
    expect(embeddedLyrics([{ timeStampFormat: 2, syncText: [{ timestamp: 1500, text: "Memory" }] }])?.lines[0].time).toBe(1.5);
    expect(embeddedLyrics([{ timeStampFormat: 1, syncText: [{ timestamp: 1500, text: "Memory" }] }])?.synced).toBe(false);
  });
  it("reads UTF-8 and UTF-16 sidecars without rendering executable markup", () => {
    const bytes = new Uint8Array([255, 254, 77, 0, 101, 0, 109, 0]);
    expect(decodeLyrics(bytes)).toBe("Mem");
    expect(parseLyrics("[00:01]<script>plain text</script>")?.lines[0].text).toContain("<script>");
  });
});
