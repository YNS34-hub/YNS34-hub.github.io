import { usePalaceStore } from "../systems/store";
import { useAudioStore, unlockAudioContext } from "./player";

let context: AudioContext | undefined;
let ambient: GainNode | undefined;
let ui: GainNode | undefined;
let roomFilter: BiquadFilterNode | undefined;
let started = false;
function updateLevels() {
  if (!context || !ambient || !ui) return;
  const settings = usePalaceStore.getState();
  const music = useAudioStore.getState().playing;
  const roomWeight = settings.roomId === "music" ? 0.55 : 1;
  roomFilter?.frequency.setTargetAtTime(
    settings.roomId === "music"
      ? 160
      : settings.roomId === "archive"
        ? 1100
        : 380,
    context.currentTime,
    1.2,
  );
  ambient.gain.setTargetAtTime(
    settings.mute
      ? 0
      : settings.ambientVolume * roomWeight * (music ? 0.22 : 1),
    context.currentTime,
    0.9,
  );
  ui.gain.setTargetAtTime(
    settings.mute ? 0 : settings.uiVolume,
    context.currentTime,
    0.03,
  );
}
function startAmbience() {
  if (started) return;
  context = unlockAudioContext();
  if (!context) return;
  started = true;
  ambient = context.createGain();
  ui = context.createGain();
  ambient.gain.value = 0;
  ui.gain.value = 0;
  ambient.connect(context.destination);
  ui.connect(context.destination);
  const buffer = context.createBuffer(
    1,
    Math.floor(context.sampleRate * 4),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let smoothed = 0;
  for (let index = 0; index < samples.length; index++) {
    smoothed = smoothed * 0.985 + (Math.random() * 2 - 1) * 0.015;
    samples[index] = smoothed * 0.025;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  roomFilter = filter;
  filter.type = "lowpass";
  filter.frequency.value = 380;
  source.connect(filter);
  filter.connect(ambient);
  source.start();
  updateLevels();
}
function tone(
  frequency: number,
  duration: number,
  level: number,
  destination: GainNode | undefined,
  endFrequency = frequency,
) {
  if (
    !context ||
    !destination ||
    context.state !== "running" ||
    usePalaceStore.getState().mute
  )
    return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    context.currentTime + duration,
  );
  envelope.gain.setValueAtTime(0.00001, context.currentTime);
  envelope.gain.exponentialRampToValueAtTime(
    level,
    context.currentTime + 0.015,
  );
  envelope.gain.exponentialRampToValueAtTime(
    0.00001,
    context.currentTime + duration,
  );
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.01);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}
/** Quiet architectural cues, owned once and shared by all rooms. */
export function initializeSpaceAudio() {
  if (typeof window === "undefined") return () => undefined;
  const gesture = () => {
    startAmbience();
  };
  const click = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button,a"))
      tone(620, 0.07, 0.009, ui, 470);
  };
  const step = () => tone(79, 0.18, 0.09, ambient, 43);
  window.addEventListener("pointerdown", gesture, { once: true });
  window.addEventListener("keydown", gesture, { once: true });
  window.addEventListener("click", click);
  window.addEventListener("palace:footstep", step);
  const unsubscribe = usePalaceStore.subscribe((state, previous) => {
    if (
      state.mute !== previous.mute ||
      state.ambientVolume !== previous.ambientVolume ||
      state.uiVolume !== previous.uiVolume ||
      state.roomId !== previous.roomId
    )
      updateLevels();
    if (state.travelSequence !== previous.travelSequence) {
      if (state.roomId === "music") tone(55, 2.6, 0.025, ambient, 44);
      else tone(180, 0.48, 0.016, ui, 94);
    }
  });
  const unsubscribeMusic = useAudioStore.subscribe((state, previous) => {
    if (state.playing !== previous.playing) updateLevels();
  });
  return () => {
    window.removeEventListener("pointerdown", gesture);
    window.removeEventListener("keydown", gesture);
    window.removeEventListener("click", click);
    window.removeEventListener("palace:footstep", step);
    unsubscribe();
    unsubscribeMusic();
  };
}
