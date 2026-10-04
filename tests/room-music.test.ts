import { describe, it, expect } from "vitest";
import { roomSoundtrack } from "../src/audio/roomMusic";
import type { MusicTrack } from "../src/content/types";
const track = (id: string, rooms: string[], src?: string): MusicTrack => ({
  id,
  title: id,
  artist: "Artist",
  album: "Album",
  favorite: false,
  source: "local",
  roomIds: rooms,
  src,
});
describe("room soundtracks", () => {
  it("matches physical wings to their parent and excludes preference-only records", () => {
    const songs = [
      track("metadata", ["projects"]),
      track("song", ["projects"], "blob:local"),
    ];
    expect(roomSoundtrack("projects-page-2", songs)?.id).toBe("song");
    expect(roomSoundtrack("research", songs)).toBeUndefined();
  });
  it("lets later personal assignments override an earlier default", () => {
    expect(
      roomSoundtrack("music", [
        track("default", ["music"], "/local.mp3"),
        track("chosen", ["music"], "blob:chosen"),
      ])?.id,
    ).toBe("chosen");
  });
});
