import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const nodes: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; gain: { setTargetAtTime: ReturnType<typeof vi.fn>; value: number } }[] = [];
  const node = () => {
    const value = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 0 }, onended: null };
    nodes.push(value); return value;
  };
  const context = { currentTime: 0, state: "running", sampleRate: 48000, destination: {}, close: vi.fn(), createGain: node, createBufferSource: node, createOscillator: node, createBiquadFilter: node, createBuffer: () => ({ getChannelData: () => new Float32Array(48000 * 3) }) };
  return { context, nodes, settings: { mute: false, ambientVolume: .3 }, audio: { playing: false } };
});
vi.mock("../src/audio/player", () => ({ unlockAudioContext: () => fixture.context, useAudioStore: { getState: () => fixture.audio } }));
vi.mock("../src/systems/store", () => ({ usePalaceStore: { getState: () => fixture.settings } }));
import { sceneAudio } from "../src/worlds/sceneAudio";

beforeEach(() => { fixture.nodes.length = 0; fixture.context.currentTime = 0; fixture.settings.mute = false; fixture.audio.playing = false; vi.clearAllMocks(); });
describe("bounded scene effects on the existing audio context", () => {
  it("unlocks once per scene, bounds overlapping voices and releases without closing the player's context", () => {
    const effects = sceneAudio("court"); effects.unlock(); const count = fixture.nodes.length;
    effects.unlock(); expect(fixture.nodes).toHaveLength(count);
    for (let i = 0; i < 20; i++) effects.sound("bounce");
    expect(fixture.nodes.filter(n => n.start.mock.calls.length)).toHaveLength(9);
    effects.dispose(); effects.dispose();
    expect(fixture.context.close).not.toHaveBeenCalled();
    expect(fixture.nodes[0].disconnect).toHaveBeenCalledTimes(1);
    const after = fixture.nodes.length; effects.sound("rim"); effects.unlock(); expect(fixture.nodes).toHaveLength(after);
  });
  it("throttles gain automation and follows real mute and playback ducking", () => {
    const effects = sceneAudio("cycling"); effects.unlock();
    for (let i = 0; i < 60; i++) effects.update(6);
    const [bus, bed] = fixture.nodes;
    expect(bus.gain.setTargetAtTime).toHaveBeenCalledTimes(1); expect(bed.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    const before = bed.gain.setTargetAtTime.mock.calls[0][0];
    fixture.context.currentTime = .2; fixture.audio.playing = true; fixture.settings.mute = true; effects.update(6);
    expect(bus.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    expect(bed.gain.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(before * .3);
    effects.dispose();
  });
  it("ties road friction to real speed and lake ambience to proximity without inventing motion", () => {
    const effects = sceneAudio("cycling"); effects.unlock(); effects.update(0, 0);
    const automated = fixture.nodes.filter(node => node.gain.setTargetAtTime.mock.calls.length);
    expect(automated).toHaveLength(4);
    const [, , tires, water] = automated;
    expect(tires.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    expect(water.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    fixture.context.currentTime = .2; effects.update(9, 1);
    expect(tires.gain.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(.16);
    expect(water.gain.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(.065);
    fixture.context.currentTime = .4; fixture.audio.playing = true; effects.update(0, 1);
    expect(tires.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    expect(water.gain.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(.065 * .3);
    effects.dispose();
    expect(tires.disconnect).toHaveBeenCalledTimes(1); expect(water.disconnect).toHaveBeenCalledTimes(1);
  });
});
