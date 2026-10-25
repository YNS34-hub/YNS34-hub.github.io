import { useAlpineVisuals } from "./visualPreferences";

export default function AlpineVisualOptions() {
  const { weather, detailed, outline, choose } = useAlpineVisuals();
  return <div className="alpine-visual-options" aria-label="高山画面设置">
    <button aria-pressed={weather === "sunny"} onClick={() => choose({ weather: weather === "sunny" ? "cloudy" : "sunny" })}>天气 · {weather === "sunny" ? "晴朗" : "山谷薄雾"}</button>
    <button aria-pressed={detailed} onClick={() => choose({ detailed: !detailed })}>画面 · {detailed ? "高清" : "原生"}</button>
    <button aria-pressed={outline} onClick={() => choose({ outline: !outline })}>人物描边 · {outline ? "开" : "关"}</button>
  </div>;
}
