import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockParam {
  value = 0;
  ramps: { value: number; at: number }[] = [];
  cancelScheduledValues() {
    /* Native scheduling API. */
  }
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.ramps.push({ value, at });
    this.value = value;
  }
  setTargetAtTime(value: number) {
    this.value = value;
  }
}
class MockGain {
  gain = new MockParam();
  connect() {}
}
class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  gains: MockGain[] = [];
  constructor() {
    MockAudioContext.instances.push(this);
  }
  async resume() {
    this.state = "running";
  }
  createGain() {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }
  createAnalyser() {
    return {
      fftSize: 256,
      connect() {},
      getByteTimeDomainData(data: Uint8Array) {
        data.fill(128);
      },
    };
  }
  createMediaElementSource() {
    return { connect() {} };
  }
}
class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];
  src = "";
  preload = "";
  volume = 1;
  duration = 36;
  currentTime = 0;
  readyState = 3;
  paused = true;
  playCount = 0;
  constructor() {
    super();
    MockAudio.instances.push(this);
  }
  load() {
    queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
  }
  async play() {
    this.paused = false;
    this.playCount++;
  }
  pause() {
    this.paused = true;
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  MockAudio.instances = [];
  MockAudioContext.instances = [];
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const browser = new EventTarget();
  Object.assign(browser, {
    matchMedia: () => ({ matches: false }),
    localStorage,
  });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("Audio", MockAudio);
  vi.stubGlobal("AudioContext", MockAudioContext);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("audio platform integration", () => {
  it("requires explicit Play, crossfades two native sources, and pauses both during a transition", async () => {
    const { useLibraryStore } = await import("../src/systems/library");
    const { initializeAudio, useAudioStore } = await import(
      "../src/audio/player"
    );
    initializeAudio();
    await useLibraryStore.getState().initialize();
    expect(useAudioStore.getState().playing).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
    const first = useLibraryStore.getState().music[0];
    useLibraryStore.setState((state) => ({
      music: [
        ...state.music,
        { ...first, id: "second-test-track", src: "/second.wav" },
      ],
    }));
    await useAudioStore.getState().play(first.id);
    expect(useAudioStore.getState().playing).toBe(true);
    const oldSource = MockAudio.instances.find(
      (element) => element.src === first.src,
    )!;
    expect(oldSource.paused).toBe(false);
    useAudioStore.getState().setCrossfade(5);
    await useAudioStore.getState().play("second-test-track");
    const incoming = MockAudio.instances.find(
      (element) => element.src === "/second.wav",
    )!;
    expect(incoming.paused).toBe(false);
    expect(oldSource.paused).toBe(false);
    expect(useAudioStore.getState().currentId).toBe("second-test-track");
    expect(
      MockAudioContext.instances[0].gains.flatMap((gain) => gain.gain.ramps),
    ).toEqual(
      expect.arrayContaining([
        { value: 0, at: 5 },
        { value: 1, at: 5 },
      ]),
    );
    useAudioStore.getState().pause();
    expect(incoming.paused).toBe(true);
    expect(oldSource.paused).toBe(true);
    expect(useAudioStore.getState().playing).toBe(false);
    await vi.advanceTimersByTimeAsync(6000);
    expect(incoming.paused).toBe(true);
  });

  it("stops a deleted active local track before its blob source can be revoked", async () => {
    const { useLibraryStore } = await import("../src/systems/library");
    const { initializeAudio, useAudioStore } = await import(
      "../src/audio/player"
    );
    initializeAudio();
    await useLibraryStore.getState().initialize();
    const snapshot = useLibraryStore.getState().music;
    const localTrack = {
      ...snapshot[0],
      id: "delete-me",
      source: "local" as const,
      src: "blob:private-audio",
    };
    useLibraryStore.setState({ music: [...snapshot, localTrack] });
    await useAudioStore.getState().play(localTrack.id);
    const active = MockAudio.instances.find(
      (element) => element.src === localTrack.src,
    )!;
    expect(active.paused).toBe(false);
    // removeMusic performs this synchronous update before awaiting its IDB deletion/revocation.
    useLibraryStore.setState({ music: snapshot });
    expect(active.paused).toBe(true);
    expect(useAudioStore.getState().playing).toBe(false);
    expect(useAudioStore.getState().currentId).toBe(snapshot[0].id);
    expect(useAudioStore.getState().progress).toBe(0);
  });

  it("restores position and mute/volume through their browser persistence contracts", async () => {
    localStorage.setItem(
      "memory-palace:player",
      JSON.stringify({
        currentId: "palace-study-01",
        progress: 12,
        repeat: "all",
        crossfade: 0,
      }),
    );
    const { useLibraryStore } = await import("../src/systems/library");
    const { usePalaceStore } = await import("../src/systems/store");
    const { initializeAudio, useAudioStore } = await import(
      "../src/audio/player"
    );
    initializeAudio();
    await useLibraryStore.getState().initialize();
    expect(useAudioStore.getState().playing).toBe(false);
    await useAudioStore.getState().play();
    const active = MockAudio.instances.find((element) => !element.paused)!;
    expect(active.currentTime).toBe(12);
    usePalaceStore.getState().update({ musicVolume: 0.3 });
    expect(MockAudioContext.instances[0].gains[0].gain.value).toBe(0.3);
    usePalaceStore.getState().update({ mute: true });
    expect(MockAudioContext.instances[0].gains[0].gain.value).toBe(0);
    useAudioStore.getState().seek(7);
    expect(active.currentTime).toBe(7);
    useAudioStore.getState().pause();
    expect(
      JSON.parse(localStorage.getItem("memory-palace:player")!).progress,
    ).toBe(7);
  });
});
