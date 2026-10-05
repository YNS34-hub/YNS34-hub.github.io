import { useEffect } from "react";
import { initializeAudio, unlockAudioContext, useAudioStore } from "./player";
import { initializeSpaceAudio } from "./space";
import { usePalaceStore } from "../systems/store";
import { useLibraryStore } from "../systems/library";
import { roomSoundtrack } from "./roomMusic";

export function AudioSystem() {
  useEffect(() => {
    initializeAudio();
    const stopSpace = initializeSpaceAudio();
    let activated = false;
    let pendingRoom = "";
    const enter = () => {
      const palace = usePalaceStore.getState();
      const library = useLibraryStore.getState();
      if (
        !activated ||
        !palace.started ||
        !palace.roomSoundtracks ||
        palace.mute ||
        !library.ready
      )
        return;
      const track = roomSoundtrack(palace.roomId, library.music);
      if (!track || pendingRoom === palace.roomId) return;
      pendingRoom = palace.roomId;
      void useAudioStore.getState().play(track.id);
    };
    const activate = (event: Event) => {
      if (!event.isTrusted) return;
      if (!activated) {
        activated = true;
        unlockAudioContext();
        enter();
      }
    };
    window.addEventListener("pointerdown", activate, true);
    window.addEventListener("keydown", activate, true);
    const stopRooms = usePalaceStore.subscribe((state, previous) => {
      if (
        state.roomId !== previous.roomId ||
        state.started !== previous.started ||
        state.roomSoundtracks !== previous.roomSoundtracks ||
        state.mute !== previous.mute
      ) {
        pendingRoom = "";
        enter();
      }
    });
    const stopLibrary = useLibraryStore.subscribe((state, previous) => {
      const assignments = (music: typeof state.music) =>
        JSON.stringify(
          music.map((track) => [track.id, Boolean(track.src), track.roomIds]),
        );
      if (
        state.ready !== previous.ready ||
        assignments(state.music) !== assignments(previous.music)
      ) {
        pendingRoom = "";
        enter();
      }
    });
    return () => {
      stopSpace();
      stopRooms();
      stopLibrary();
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("keydown", activate, true);
    };
  }, []);
  return null;
}
