import { describe, expect, it } from "vitest";
import { parseNetEaseLink } from "../src/systems/library";
import { adjacentTrack, playableTracks } from "../src/audio/playlist";
import type { MusicTrack } from "../src/content/types";
import { restorePlayerState } from "../src/audio/persistence";

describe("official NetEase collection links", () => {
  it("normalizes mobile and fragment links without seeking protected audio", () => {
    expect(
      parseNetEaseLink("https://y.music.163.com/m/song?id=123&userid=456"),
    ).toEqual({
      url: "https://music.163.com/#/song?id=123",
      id: "netease-song-123",
      kind: "song",
    });
    expect(
      parseNetEaseLink(
        "Sharing my playlist https://music.163.com/#/playlist?id=987",
      ),
    ).toEqual({
      url: "https://music.163.com/#/playlist?id=987",
      id: "netease-playlist-987",
      kind: "playlist",
    });
    expect(parseNetEaseLink("https://music.163.com/album?id=321").kind).toBe(
      "album",
    );
  });
  it("preserves official short links as external shares", () => {
    const link = parseNetEaseLink("http://163cn.tv/AbCD");
    expect(link.url).toBe("https://163cn.tv/AbCD");
    expect(link.kind).toBe("share");
  });
  it.each([
    "https://music.163.com.attacker.example/song?id=123",
    "https://attacker.example/?url=https://music.163.com/song?id=123",
    "javascript:alert(1)",
    "https://user:password@music.163.com/song?id=123",
    "https://music.163.com/song?id=not-an-id",
    "https://music.163.com/",
  ])("rejects unsupported or deceptive links: %s", (value) => {
    expect(() => parseNetEaseLink(value)).toThrow();
  });
});

const playlist: MusicTrack[] = [
  {
    id: "a",
    title: "A",
    artist: "Artist",
    album: "Album",
    source: "static",
    src: "/a.wav",
    favorite: false,
  },
  {
    id: "link",
    title: "External",
    artist: "Artist",
    album: "Album",
    source: "netease",
    url: "https://music.163.com/#/song?id=1",
    favorite: false,
  },
  {
    id: "b",
    title: "B",
    artist: "Artist",
    album: "Album",
    source: "local",
    src: "blob:audio",
    favorite: false,
  },
  {
    id: "c",
    title: "C",
    artist: "Artist",
    album: "Album",
    source: "local",
    src: "blob:other",
    favorite: false,
  },
];

describe("persistent player playlist behavior", () => {
  it("never attempts to play a collected external URL as an audio source", () => {
    expect(playableTracks(playlist).map((track) => track.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(adjacentTrack(playlist, "a", 1)?.id).toBe("b");
  });
  it("stops at the end without repeat and wraps when repeat is enabled", () => {
    expect(adjacentTrack(playlist, "c", 1, false, false)).toBeUndefined();
    expect(adjacentTrack(playlist, "c", 1, false, true)?.id).toBe("a");
    expect(adjacentTrack(playlist, "a", -1)?.id).toBe("c");
  });
  it("shuffles only among alternatives and tolerates unavailable saved tracks", () => {
    expect(adjacentTrack(playlist, "a", 1, true, true, () => 0)?.id).toBe("b");
    expect(adjacentTrack(playlist, "a", 1, true, true, () => 0.999)?.id).toBe(
      "c",
    );
    expect(adjacentTrack(playlist, "deleted", 1)?.id).toBe("a");
    expect(adjacentTrack([], null, 1)).toBeUndefined();
  });
  it("allows a one-track playlist to repeat without an invalid selection", () => {
    expect(adjacentTrack([playlist[0]], "a", 1, true, true)?.id).toBe("a");
    expect(adjacentTrack([playlist[0]], "a", 1, true, false)).toBeUndefined();
  });
});

describe("player restoration", () => {
  it("restores the selected record and position without an autoplay flag", () => {
    expect(
      restorePlayerState(
        JSON.stringify({
          currentId: "local-a",
          progress: 17.25,
          shuffle: true,
          repeat: "all",
          crossfade: 5,
          playing: true,
        }),
      ),
    ).toEqual({
      currentId: "local-a",
      progress: 17.25,
      shuffle: true,
      repeat: "all",
      crossfade: 5,
    });
  });
  it.each(["null", "invalid-json", "[]", "42", "{}"])(
    "recovers from malformed persisted state: %s",
    (raw) => {
      expect(restorePlayerState(raw)).toEqual({
        currentId: null,
        progress: 0,
        shuffle: false,
        repeat: "off",
        crossfade: 2.5,
      });
    },
  );
  it("bounds imported settings and discards untrusted state shapes", () => {
    expect(
      restorePlayerState(
        JSON.stringify({
          currentId: {},
          progress: -99,
          shuffle: "true",
          repeat: "forever",
          crossfade: 999,
        }),
      ),
    ).toEqual({
      currentId: null,
      progress: 0,
      shuffle: false,
      repeat: "off",
      crossfade: 8,
    });
  });
});
