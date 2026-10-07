import { unlockAudioContext, useAudioStore } from "../audio/player";
import { usePalaceStore } from "../systems/store";
import { useEffect, useMemo, useRef } from "react";

export function useSceneAudio(kind: "court" | "cycling") {
  const ref = useRef<ReturnType<typeof sceneAudio> | null>(null);
  useEffect(() => {
    const audio = sceneAudio(kind); ref.current = audio;
    return () => { audio.dispose(); if (ref.current === audio) ref.current = null; };
  }, [kind]);
  return useMemo(() => ({
    unlock: () => ref.current?.unlock(),
    update: (speed = 0, nearWater = 0) => ref.current?.update(speed, nearWater),
    sound: (name: Parameters<ReturnType<typeof sceneAudio>["sound"]>[0]) => ref.current?.sound(name),
    dispose: () => ref.current?.dispose(),
  }), []);
}

// 音效连接现有播放器提供的 AudioContext；没有第二个播放器、曲库或音量持久化。
export function sceneAudio(kind: "court" | "cycling") {
  let context: AudioContext | undefined, bus: GainNode | undefined, bed: GainNode | undefined;
  let tires: GainNode | undefined, water: GainNode | undefined;
  let ambient: AudioBufferSourceNode | undefined, noise: AudioBuffer | undefined;
  const voices = new Set<AudioScheduledSourceNode>();
  let disposed = false, updatedAt = -1, lastLevel = -1, lastBed = -1, lastTires = -1, lastWater = -1;
  const unlock = () => {
    if (disposed) return;
    context = unlockAudioContext();
    if (!context || bus) return;
    bus = context.createGain(); bus.gain.value = 0; bus.connect(context.destination);
    bed = context.createGain(); bed.gain.value = 0; bed.connect(bus);
    noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = noise.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) { smooth = smooth * 0.96 + (Math.random() * 2 - 1) * 0.04; data[i] = smooth; }
    ambient = context.createBufferSource(); ambient.buffer = noise; ambient.loop = true;
    const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = kind === "court" ? 240 : 750;
    ambient.connect(filter); filter.connect(bed); ambient.start();
    const filters = [filter];
    if (kind === "cycling") {
      // 同一个原创噪声源分出道路摩擦与湖岸声；真实速度和位置决定音量，静止时轮胎层归零。
      const roadFilter = context.createBiquadFilter(); roadFilter.type = "bandpass"; roadFilter.frequency.value = 580; roadFilter.Q.value = .7;
      tires = context.createGain(); tires.gain.value = 0; ambient.connect(roadFilter); roadFilter.connect(tires); tires.connect(bus);
      const waterFilter = context.createBiquadFilter(); waterFilter.type = "bandpass"; waterFilter.frequency.value = 1900; waterFilter.Q.value = .4;
      water = context.createGain(); water.gain.value = 0; ambient.connect(waterFilter); waterFilter.connect(water); water.connect(bus);
      filters.push(roadFilter, waterFilter);
    }
    ambient.onended = () => { ambient?.disconnect(); filters.forEach(node => node.disconnect()); };
  };
  const update = (speed = 0, nearWater = 0) => {
    if (!context || !bus || !bed || disposed || context.currentTime - updatedAt < .1) return;
    updatedAt = context.currentTime;
    const s = usePalaceStore.getState();
    const level = s.mute ? 0 : s.ambientVolume;
    if (level !== lastLevel) { bus.gain.setTargetAtTime(level, context.currentTime, 0.15); lastLevel = level; }
    const duck = useAudioStore.getState().playing ? 0.3 : 1;
    const bedLevel = (kind === "court" ? 0.045 : 0.045 + Math.min(12, speed) * 0.02) * duck;
    if (Math.abs(bedLevel - lastBed) > .002) { bed.gain.setTargetAtTime(bedLevel, context.currentTime, 0.4); lastBed = bedLevel; }
    const tireLevel = Math.pow(Math.max(0, Math.min(1, speed / 9)), 1.5) * .16 * duck;
    const waterLevel = Math.max(0, Math.min(1, nearWater)) * .065 * duck;
    if (tires && Math.abs(tireLevel - lastTires) > .001) { tires.gain.setTargetAtTime(tireLevel, context.currentTime, .3); lastTires = tireLevel; }
    if (water && Math.abs(waterLevel - lastWater) > .001) { water.gain.setTargetAtTime(waterLevel, context.currentTime, .6); lastWater = waterLevel; }
  };
  const sound = (name: "bounce" | "rim" | "backboard" | "made" | "step" | "bird") => {
    if (!context || !bus || context.state !== "running" || disposed || voices.size >= 8 || usePalaceStore.getState().mute) return;
    const ctx = context, now = ctx.currentTime, envelope = ctx.createGain();
    const duration = name === "made" ? 0.38 : name === "bird" ? 0.22 : 0.16;
    const level = name === "bounce" ? 1.9 : name === "step" ? 0.16 : name === "bird" ? 0.12 : 0.6;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(level, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    envelope.connect(bus);
    let source: AudioScheduledSourceNode, filter: BiquadFilterNode | undefined;
    if (name === "made" || name === "backboard" || name === "step") {
      const buffer = ctx.createBufferSource(); buffer.buffer = noise!; source = buffer;
      filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = name === "made" ? 0.6 : 1.2;
      filter.frequency.value = name === "made" ? 2100 : name === "backboard" ? 850 : 140;
      source.connect(filter); filter.connect(envelope);
    } else {
      const oscillator = ctx.createOscillator(); source = oscillator;
      oscillator.type = name === "rim" ? "triangle" : "sine";
      const hz = name === "bounce" ? 180 : name === "rim" ? 820 : 2400;
      oscillator.frequency.setValueAtTime(hz, now);
      oscillator.frequency.exponentialRampToValueAtTime(name === "bounce" ? 58 : hz * 0.72, now + duration);
      oscillator.connect(envelope);
    }
    voices.add(source); source.start(); source.stop(now + duration + 0.015);
    source.onended = () => { source.disconnect(); filter?.disconnect(); envelope.disconnect(); voices.delete(source); };
  };
  return { unlock, update, sound, dispose: () => {
    if (disposed) return;
    disposed = true; ambient?.stop(); voices.forEach(voice => { try { voice.stop(); } catch { /* 已结束节点无需再次停止。 */ } });
    bus?.disconnect(); bed?.disconnect(); tires?.disconnect(); water?.disconnect(); voices.clear();
  } };
}
