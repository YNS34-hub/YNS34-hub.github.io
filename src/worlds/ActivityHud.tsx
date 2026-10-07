import { useEffect } from "react";
import { useActivity, courtCommand, rideCommand } from "./activity";
import { routeLength } from "./cyclingRoute";
import { usePalaceStore } from "../systems/store";
import { useMotionCue } from "../motion/useMotionCue";
import "./worlds.css";

export default function ActivityHud() {
  const room = usePalaceStore(s => s.roomId), blocked = usePalaceStore(s => !!s.overlay || !!s.focus || s.mode === "index" || !s.started);
  const a = useActivity();
  const result = useMotionCue<HTMLParagraphElement>(a.result, "copy", room === "basketball" && !blocked);
  const scenic = useMotionCue<HTMLHeadingElement>(a.scenic, "threshold", room === "cycling" && !blocked);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".palace-app");
    if (root) root.dataset.activityPhoto = String(room === "cycling" && a.photo);
    if (root) root.dataset.activityWorld = room;
    return () => { if (root) { delete root.dataset.activityPhoto; delete root.dataset.activityWorld; } };
  }, [room, a.photo]);
  if (!blocked && room === "cycling") {
    if (a.photo) return <aside className="ride-photo-controls" aria-label="Cycling photo view">
      <button onClick={() => rideCommand("save-photo")}>Save this view</button>
      <button onClick={() => useActivity.setState({ photo: false })}>Exit photo view · ESC</button>
    </aside>;
    return <aside className="activity-hud ride-hud" aria-label="Scenic cycling controls">
      <span className="scenic-eyebrow">GOLDEN FOREST / LAKE ROUTE</span><h2 ref={scenic}>{a.scenic}</h2>
      <div className="ride-speed"><strong>{(a.speed * 3.6).toFixed(1)}</strong><span>KM / H</span></div>
      <div className="ride-progress" role="progressbar" aria-label="Route progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.distance / routeLength * 100)}><i style={{ width: a.distance / routeLength * 100 + "%" }} /></div>
      <p>{Math.round(a.distance)} / {Math.round(routeLength)} m · {a.stopped ? "A moment to look." : "Follow the water."}</p>
      <div className="activity-actions">
        <button onClick={() => rideCommand("start")}>{a.stopped ? "Start / resume ride" : "Coast at an easy pace"}</button>
        <button onClick={() => rideCommand("brake")}>Brake · Space</button>
        <button onClick={() => rideCommand("viewpoint")}>Stop at next viewpoint</button>
        <button onClick={() => rideCommand("photo")}>Photo view · P</button>
        <button onClick={() => rideCommand("restart")}>Restart route</button>
        <button onClick={() => usePalaceStore.getState().enterRoom("worlds")}>Back to Worlds</button>
      </div>
      <small>W accelerate · S slow · Space brake · drag / lock to look around · P photo view. Low motion uses a steady camera.</small>
    </aside>;
  }
  if (blocked || room !== "basketball") return null;
  return <aside className="activity-hud court-hud" aria-label="Basketball practice controls">
    <div className="practice-score"><span>PRACTICE / AFTER HOURS</span><strong>{a.made}<small> / {a.shots}</small></strong><span>MADE / ATTEMPTED{a.streak > 1 ? " · STREAK " + a.streak : ""}</span></div>
    <p className="shot-result" ref={result} role="status">{a.result || "Find your spot."}</p>
    {a.mode === "held" && <div className="release-meter" aria-label="Shot release" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.charge * 100)}><span className="release-zone" /><i style={{ width: a.charge * 100 + "%" }} /></div>}
    <div className="activity-actions">
      <button onClick={() => courtCommand(a.mode === "held" ? "dribble" : "pickup")}>{a.mode === "held" ? a.dribbling ? "E · Hold ball" : "E · Dribble" : "E · Pick up nearby ball"}</button>
      {a.mode === "held" && <button onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); courtCommand("charge"); }} onPointerUp={() => courtCommand("release")} onPointerCancel={() => courtCommand("cancel")} onBlur={() => courtCommand("cancel")} onKeyDown={event => { if (event.code === "Space" && !event.repeat) { event.preventDefault(); courtCommand("charge"); } }} onKeyUp={event => { if (event.code === "Space") { event.preventDefault(); courtCommand("release"); } }}>Hold / release · Shoot</button>}
      <button onClick={() => courtCommand("recall")}>R · Recall ball</button>
      <button aria-pressed={a.assist} onClick={() => useActivity.setState({ assist: !a.assist })}>Arc assist {a.assist ? "on" : "off"}</button>
    </div>
    <small>WASD move · E pick up / dribble · hold Space or locked-view click, release to shoot · aim at either hoop</small>
  </aside>;
}
