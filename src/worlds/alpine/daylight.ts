export type AlpineWeather = "sunny" | "cloudy";

export function alpineDaylight(weather: AlpineWeather) {
  return weather === "sunny"
    ? { sun: 3, hemisphere: .9, environment: .61, fog: .000035, turbidity: 1.8, rayleigh: 1.35 }
    : { sun: 1.55, hemisphere: 1.15, environment: .56, fog: .00012, turbidity: 6, rayleigh: 2.2 };
}

// 高清档在普通 DPR 1 屏幕也超采样；1440p 限制到约六百万像素，4K 保留原生清晰度。
export function alpinePixelRatio(deviceDpr: number, width: number, height: number, detailed: boolean) {
  const native = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  if (!detailed) return Math.min(native, 1.6);
  const pixels = Math.max(1, width * height);
  return Math.max(1, Math.min(2, Math.max(1.5, native), Math.sqrt(6_000_000 / pixels)));
}
