import { useEffect } from "react";
import { useActivity, courtCommand } from "./activity";
import { usePalaceStore } from "../systems/store";
import { useMotionCue } from "../motion/useMotionCue";
import "./worlds.css";
import RoadHud, { rememberRoadReturn } from "./road/Hud";
import {roadTravel} from "./road/state";

export default function ActivityHud() {
  const room = usePalaceStore(s => s.roomId), blocked = usePalaceStore(s => !!s.overlay || !!s.focus || s.mode === "index" || !s.started);
  const a = useActivity();
  const result = useMotionCue<HTMLParagraphElement>(a.result, "copy", room === "basketball" && !blocked);
  const score = useMotionCue<HTMLElement>(a.made, "copy", room === "basketball" && !blocked && a.made > 0);
  useEffect(() => usePalaceStore.subscribe((state, previous) => {
    if(state.roomId!==previous.roomId)roadTravel(previous.roomId,state.roomId);
    if (state.roomId === "cycling" && previous.roomId !== "cycling") rememberRoadReturn(previous.roomId);
  }), []);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".palace-app");
    if (root) root.dataset.activityPhoto = String(room === "cycling" && a.photo);
    if (root) root.dataset.activityWorld = room;
    return () => { if (root) { delete root.dataset.activityPhoto; delete root.dataset.activityWorld; } };
  }, [room, a.photo]);
  if (!blocked && !a.warming && room === "cycling") {
    return <RoadHud />;
  }
  if (blocked || a.warming || room !== "basketball") return null;
  return <aside className="activity-hud court-hud" aria-label="Basketball practice controls">
    <div className="practice-score"><span>PRACTICE / AFTER HOURS</span><strong ref={score}>{a.made}<small> / {a.shots}</small></strong><span>MADE / ATTEMPTED{a.streak > 1 ? " · STREAK " + a.streak : ""}</span></div>
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
