import { usePalaceStore, type Quality } from "../systems/store";
import { Dialog } from "./primitives";
export default function Settings() {
  const s = usePalaceStore();
  return (
    <Dialog
      label="Experience settings"
      className="settings-panel"
      onClose={() => s.setOverlay(null)}
    >
      <p className="eyebrow">MAKE YOURSELF AT HOME</p>
      <h2>Your experience.</h2>
      <p className="panel-description">
        A quiet space should feel comfortable.
      </p>
      <div className="setting-row">
        <label htmlFor="quality">
          Rendering quality
          <small>Automatic adapts to your device and frame rate.</small>
        </label>
        <select
          id="quality"
          value={s.quality}
          onChange={(e) => s.update({ quality: e.target.value as Quality })}
        >
          <option value="auto">Automatic</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="setting-row">
        <label htmlFor="motion">
          Reduce motion
          <small>Gentle transitions; no automatic spatial rotation.</small>
        </label>
        <input
          id="motion"
          type="checkbox"
          checked={s.reducedMotion}
          onChange={(e) => s.update({ reducedMotion: e.target.checked })}
        />
      </div>
      <div className="setting-row">
        <label htmlFor="mute">Mute all sound</label>
        <input
          id="mute"
          type="checkbox"
          checked={s.mute}
          onChange={(e) => s.update({ mute: e.target.checked })}
        />
      </div>
      {(
        [
          ["musicVolume", "Music"],
          ["ambientVolume", "Atmosphere"],
          ["uiVolume", "Spatial cues"],
          ["sensitivity", "Mouse sensitivity"],
        ] as const
      ).map(([key, label]) => (
        <div className="setting-row" key={key}>
          <label htmlFor={key}>
            {label}
            <small>{Math.round(s[key] * 100)}%</small>
          </label>
          <input
            id={key}
            type="range"
            min="0"
            max="1"
            step=".01"
            value={s[key]}
            onChange={(e) => s.update({ [key]: Number(e.target.value) })}
          />
        </div>
      ))}
      <div className="setting-row">
        <label htmlFor="mode">
          Navigation<small>Tour uses drag to look and touch controls.</small>
        </label>
        <select
          id="mode"
          value={s.mode}
          onChange={(e) =>
            s.update({ mode: e.target.value as "explore" | "tour" | "index" })
          }
        >
          <option value="explore">Explore</option>
          <option value="tour">Cinematic tour</option>
          <option value="index">2D collection index</option>
        </select>
      </div>
      <div className="settings-note">
        <span className="status-dot" /> {s.effectiveQuality.toUpperCase()} ·{" "}
        {s.fps} FPS <small>All settings stay on this device.</small>
      </div>
    </Dialog>
  );
}
