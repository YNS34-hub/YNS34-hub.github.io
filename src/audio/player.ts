import { create } from "zustand";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { adjacentTrack, playableTracks } from "./playlist";
import type { MusicTrack } from "../content/types";
import { restorePlayerState } from "./persistence";
import { audioSignal, bandEnergy } from "./signal";

type Repeat = "off" | "all" | "one";
interface AudioState {
  currentId: string | null;
  playing: boolean;
  progress: number;
  duration: number;
  energy: number;
  shuffle: boolean;
  repeat: Repeat;
  crossfade: number;
  error: string | null;
  play: (id?: string) => Promise<void>;
  pause: () => void;
  toggle: () => void;
  previous: () => void;
  next: () => void;
  seek: (seconds: number) => void;
  setShuffle: (value: boolean) => void;
  setRepeat: (value: Repeat) => void;
  setCrossfade: (seconds: number) => void;
}
interface Slot {
  element: HTMLAudioElement;
  gain?: GainNode;
  source?: MediaElementAudioSourceNode;
  trackId: string | null;
}
function readSaved() {
  try {
    return restorePlayerState(localStorage.getItem("memory-palace:player"));
  } catch {
    return restorePlayerState(null);
  }
}
const saved = readSaved();
let slots: Slot[] = [];
let activeIndex = 0;
let context: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
let output: GainNode | undefined;
let signal: Uint8Array<ArrayBuffer> | undefined;
let spectrum: Uint8Array<ArrayBuffer> | undefined;
let pendingSeek = saved.progress || 0;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let saveAt = 0;
let playGeneration = 0;
let starting = false;

function save() {
  const state = useAudioStore.getState();
  try {
    localStorage.setItem(
      "memory-palace:player",
      JSON.stringify({
        currentId: state.currentId,
        progress: state.progress,
        shuffle: state.shuffle,
        repeat: state.repeat,
        crossfade: state.crossfade,
        playlist: useLibraryStore.getState().music.map((track) => track.id),
      }),
    );
  } catch {
    /* The collection still works in a private or storage-restricted browser. */
  }
}
function cancelFade() {
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = undefined;
  slots.forEach((slot, index) => {
    if (index !== activeIndex) {
      slot.element.pause();
      setSlotGain(slot, 0);
    }
  });
}
function setSlotGain(slot: Slot, value: number, seconds = 0) {
  if (slot.gain && context) {
    const gain = slot.gain.gain;
    gain.cancelScheduledValues(context.currentTime);
    gain.setValueAtTime(gain.value, context.currentTime);
    gain.linearRampToValueAtTime(
      value,
      context.currentTime + Math.max(0.012, seconds),
    );
  } else {
    const settings = usePalaceStore.getState();
    slot.element.volume = settings.mute
      ? 0
      : Math.min(1, value * settings.musicVolume);
  }
}
function applyVolume() {
  const settings = usePalaceStore.getState();
  const volume = settings.mute ? 0 : settings.musicVolume;
  if (output && context) {
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(volume, context.currentTime, 0.06);
  } else
    slots.forEach((slot, index) => {
      slot.element.volume = index === activeIndex ? volume : 0;
    });
}
function createRuntime() {
  if (slots.length || typeof Audio === "undefined") return;
  slots = [0, 1].map(() => {
    const element = new Audio();
    element.preload = "metadata";
    const slot: Slot = { element, trackId: null };
    element.addEventListener("loadedmetadata", () => {
      if (slots[activeIndex] !== slot) return;
      if (pendingSeek && Number.isFinite(element.duration)) {
        element.currentTime =
          pendingSeek >= element.duration - 0.25 ? 0 : pendingSeek;
        pendingSeek = 0;
      }
      useAudioStore.setState({
        duration: Number.isFinite(element.duration) ? element.duration : 0,
      });
    });
    element.addEventListener("timeupdate", () => {
      if (slots[activeIndex] !== slot) return;
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      useAudioStore.setState({ progress: element.currentTime, duration });
      if (Date.now() - saveAt > 1800) {
        save();
        saveAt = Date.now();
      }
      const state = useAudioStore.getState();
      if (
        state.playing &&
        !starting &&
        !fadeTimer &&
        state.crossfade > 0 &&
        state.repeat !== "one" &&
        duration > state.crossfade + 2 &&
        duration - element.currentTime <= state.crossfade
      ) {
        const next = adjacentTrack(
          useLibraryStore.getState().music,
          state.currentId,
          1,
          state.shuffle,
          state.repeat === "all",
        );
        if (next && next.id !== state.currentId) void startTrack(next, true);
      }
    });
    element.addEventListener("ended", () => {
      if (slots[activeIndex] !== slot || starting) return;
      const state = useAudioStore.getState();
      if (state.repeat === "one") {
        element.currentTime = 0;
        void element.play().catch(handleError);
        return;
      }
      const next = adjacentTrack(
        useLibraryStore.getState().music,
        state.currentId,
        1,
        state.shuffle,
        state.repeat === "all",
      );
      if (next) void startTrack(next, false);
      else {
        useAudioStore.setState({ playing: false, energy: 0 });
        save();
      }
    });
    element.addEventListener("error", () => {
      if (slots[activeIndex] === slot)
        handleError(
          new Error(
            "This audio format cannot be played by this browser. Try MP3, M4A, OGG or WAV.",
          ),
        );
    });
    return slot;
  });
  applyVolume();
}
function createAudioGraph() {
  if (context || !slots.length) return;
  try {
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    signal = new Uint8Array(analyser.fftSize);
    spectrum = new Uint8Array(analyser.frequencyBinCount);
    output = context.createGain();
    analyser.connect(output);
    output.connect(context.destination);
    slots.forEach((slot) => {
      slot.gain = context!.createGain();
      slot.source = context!.createMediaElementSource(slot.element);
      slot.source.connect(slot.gain);
      slot.gain.connect(analyser!);
      slot.gain.gain.value = 0;
      slot.element.volume = 1;
    });
    applyVolume();
  } catch {
    /* Native audio remains available if Web Audio is disabled. */
  }
}

/** Called only by a trusted user gesture; this never starts a song. */
export function unlockAudioContext(): AudioContext | undefined {
  createRuntime();
  createAudioGraph();
  if (context?.state === "suspended")
    void context.resume().catch(() => undefined);
  return context;
}
function handleError(error: unknown) {
  starting = false;
  useAudioStore.setState({
    playing: false,
    energy: 0,
    error:
      error instanceof Error
        ? error.message
        : "Playback could not start. Click Play to try again.",
  });
}
async function startTrack(track: MusicTrack, crossfade: boolean) {
  if (!track.src) return;
  createRuntime();
  createAudioGraph();
  if (!slots.length) return;
  const generation = ++playGeneration;
  starting = true;
  try {
    if (context?.state === "suspended") await context.resume();
    if (generation !== playGeneration) return;
    const oldSlot = slots[activeIndex];
    const same = oldSlot.trackId === track.id;
    if (same) {
      if (
        oldSlot.element.ended ||
        (getFiniteDuration(oldSlot.element) > 0 &&
          oldSlot.element.currentTime >= oldSlot.element.duration - 0.25)
      )
        oldSlot.element.currentTime = 0;
      setSlotGain(oldSlot, 1);
      await oldSlot.element.play();
      if (generation === playGeneration)
        useAudioStore.setState({ playing: true, error: null });
      starting = false;
      save();
      return;
    }
    cancelFade();
    const nextIndex = (activeIndex + 1) % 2;
    const newSlot = slots[nextIndex];
    newSlot.element.pause();
    newSlot.trackId = track.id;
    newSlot.element.src = track.src;
    newSlot.element.load();
    const seconds =
      crossfade && !oldSlot.element.paused
        ? useAudioStore.getState().crossfade
        : 0;
    activeIndex = nextIndex;
    if (useAudioStore.getState().currentId !== track.id) pendingSeek = 0;
    useAudioStore.setState({
      currentId: track.id,
      progress: pendingSeek,
      duration: track.duration || 0,
      error: null,
    });
    setSlotGain(newSlot, seconds > 0 ? 0 : 1);
    await newSlot.element.play();
    if (generation !== playGeneration) {
      newSlot.element.pause();
      return;
    }
    useAudioStore.setState({ playing: true });
    if (seconds > 0) {
      setSlotGain(newSlot, 1, seconds);
      setSlotGain(oldSlot, 0, seconds);
      fadeTimer = setTimeout(
        () => {
          oldSlot.element.pause();
          fadeTimer = undefined;
        },
        seconds * 1000 + 40,
      );
    } else {
      oldSlot.element.pause();
      setSlotGain(oldSlot, 0);
    }
    starting = false;
    save();
  } catch (error) {
    if (generation === playGeneration) handleError(error);
  }
}

function getFiniteDuration(element: HTMLAudioElement) {
  return Number.isFinite(element.duration) ? element.duration : 0;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  currentId: saved.currentId,
  playing: false,
  progress: saved.progress,
  duration: 0,
  energy: 0,
  shuffle: saved.shuffle,
  repeat: saved.repeat,
  crossfade: saved.crossfade,
  error: null,
  play: async (id) => {
    await useLibraryStore.getState().initialize();
    const tracks = useLibraryStore.getState().music;
    const track =
      tracks.find((item) => item.id === (id || get().currentId)) ||
      playableTracks(tracks)[0];
    if (!track) {
      set({
        error:
          "Import a local song, or add an audio file to public/media/music.",
      });
      return;
    }
    if (!track.src) {
      set({
        error:
          "This item is an official NetEase link. Open it on NetEase, or pair it with a local audio file.",
      });
      return;
    }
    await startTrack(track, get().playing && track.id !== get().currentId);
  },
  pause: () => {
    ++playGeneration;
    starting = false;
    cancelFade();
    slots.forEach((slot) => slot.element.pause());
    set({ playing: false, energy: 0 });
    save();
  },
  toggle: () => {
    if (get().playing) get().pause();
    else void get().play();
  },
  previous: () => {
    if (get().progress > 3) {
      get().seek(0);
      return;
    }
    const track = adjacentTrack(
      useLibraryStore.getState().music,
      get().currentId,
      -1,
      false,
    );
    if (track) void get().play(track.id);
  },
  next: () => {
    const track = adjacentTrack(
      useLibraryStore.getState().music,
      get().currentId,
      1,
      get().shuffle,
    );
    if (track) void get().play(track.id);
  },
  seek: (seconds) => {
    cancelFade();
    const slot = slots[activeIndex];
    const position = Math.max(0, Math.min(seconds, get().duration || seconds));
    if (slot && slot.trackId === get().currentId && slot.element.readyState > 0)
      slot.element.currentTime = position;
    else pendingSeek = position;
    set({ progress: position });
    save();
  },
  setShuffle: (shuffle) => {
    set({ shuffle });
    save();
  },
  setRepeat: (repeat) => {
    set({ repeat });
    save();
  },
  setCrossfade: (seconds) => {
    set({ crossfade: Math.max(0, Math.min(8, seconds)) });
    save();
  },
}));

let initialized = false;
/** Mounted once, with playback owned by this module rather than any room. */
export function initializeAudio(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void useLibraryStore.getState().initialize();
  usePalaceStore.subscribe((state, previous) => {
    if (
      state.mute !== previous.mute ||
      state.musicVolume !== previous.musicVolume
    )
      applyVolume();
  });
  useLibraryStore.subscribe((state, previous) => {
    if (!state.ready || state.music === previous.music) return;
    const player = useAudioStore.getState();
    if (
      player.currentId &&
      !state.music.some((track) => track.id === player.currentId)
    ) {
      player.pause();
      pendingSeek = 0;
      useAudioStore.setState({
        currentId: playableTracks(state.music)[0]?.id || null,
        progress: 0,
        duration: 0,
      });
      save();
    }
  });
  window.addEventListener("pagehide", save);
  setInterval(() => {
    const audible = !!(
      analyser &&
      signal &&
      spectrum &&
      context?.state === "running" &&
      useAudioStore.getState().playing
    );
    audioSignal.available = audible;
    if (!audible) {
      for (const key of ["bass", "mid", "treble", "rms"] as const)
        audioSignal[key] *= 0.66;
      return;
    }
    analyser!.getByteFrequencyData(spectrum!);
    const hz = context!.sampleRate;
    const bands = {
      bass: bandEnergy(spectrum!, hz, analyser!.fftSize, 30, 240),
      mid: bandEnergy(spectrum!, hz, analyser!.fftSize, 240, 3500),
      treble: bandEnergy(spectrum!, hz, analyser!.fftSize, 3500, 13000),
    };
    for (const key of ["bass", "mid", "treble"] as const)
      audioSignal[key] += (bands[key] - audioSignal[key]) * 0.28;
    analyser!.getByteTimeDomainData(signal!);
    let square = 0;
    for (const value of signal!) square += ((value - 128) / 128) ** 2;
    const energy = Math.min(1, Math.sqrt(square / signal!.length) * 2.4);
    audioSignal.rms += (energy - audioSignal.rms) * 0.28;
    useAudioStore.setState((state) => ({
      energy: state.energy * 0.78 + energy * 0.22,
    }));
  }, 120);
}
