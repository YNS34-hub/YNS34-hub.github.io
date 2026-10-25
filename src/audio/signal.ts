/** Mutable render signal: no React/global-state render for each FFT update. Zero input yields zero movement. */
export const audioSignal = {
  available: false,
  bass: 0,
  mid: 0,
  treble: 0,
  rms: 0,
};
export function bandEnergy(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  low: number,
  high: number,
) {
  const from = Math.max(0, Math.floor((low * fftSize) / sampleRate)),
    to = Math.min(data.length, Math.ceil((high * fftSize) / sampleRate));
  if (to <= from) return 0;
  let square = 0;
  for (let i = from; i < to; i++) square += (data[i] / 255) ** 2;
  return Math.sqrt(square / (to - from));
}
