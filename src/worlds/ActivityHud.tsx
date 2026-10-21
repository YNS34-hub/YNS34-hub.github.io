import { useEffect } from "react";
import { useActivity, courtCommand } from "./activity";
import { usePalaceStore } from "../systems/store";
import { useMotionCue } from "../motion/useMotionCue";
import "./worlds.css";
import RoadHud, { rememberRoadReturn } from "./road/Hud";
import {roadTravel} from "./road/state";
import {isRideScene} from "./road/maps";
import { useCourtTime } from "./court/state";
import {courtSets,useCourtSet} from "./court/courtSets";
import PerspectiveControls from "./presence/Controls";
import {isPrimaryShotKey} from "./court/controls";

export default function ActivityHud() {
  const room = usePalaceStore(s => s.roomId), blocked = usePalaceStore(s => !!s.overlay || !!s.focus || s.mode === "index" || !s.started);
  const a = useActivity();
  const courtTime = useCourtTime(), selectedCourt=useCourtSet(s=>s.selected);
  const result = useMotionCue<HTMLParagraphElement>(a.result, "copy", room === "basketball" && !blocked);
  const score = useMotionCue<HTMLElement>(a.made, "copy", room === "basketball" && !blocked && a.made > 0);
  useEffect(() => usePalaceStore.subscribe((state, previous) => {
    if(state.roomId!==previous.roomId)roadTravel(previous.roomId,state.roomId);
    if (isRideScene(state.roomId) && previous.roomId !== state.roomId) rememberRoadReturn(previous.roomId);
  }), []);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".palace-app");
    if (root) root.dataset.activityPhoto = String(isRideScene(room) && a.photo);
    if (root) root.dataset.activityWorld = room;
    return () => { if (root) { delete root.dataset.activityPhoto; delete root.dataset.activityWorld; } };
  }, [room, a.photo]);
  if (!blocked && !a.warming && isRideScene(room)) {
    return <RoadHud />;
  }
  if (blocked || a.warming || room !== "basketball") return null;
  return <aside className="activity-hud court-hud" aria-label="Basketball practice controls" data-primary-action={a.primaryAction} data-finish-ready={a.finishReady} onClick={event=>{if(event.detail===0||!(event.target instanceof Element))return;const button=event.target.closest('button');if(button instanceof HTMLButtonElement&&!button.hasAttribute('data-court-charge'))button.blur();}}>
    <div className="practice-score"><span>PRACTICE / {courtSets[selectedCourt].title}{!courtSets[selectedCourt].indoor&&courtTime.time==="night"?" / AFTER HOURS":""}</span><strong ref={score}>{a.made}<small> / {a.shots}</small></strong><span>MADE / ATTEMPTED{a.streak > 1 ? " · STREAK " + a.streak : ""}</span></div>
    <p className="shot-result" ref={result} role="status">{a.result || (a.finishReady ? a.primaryAction === "dunk" ? "ENTER + 5 · DUNK IN RANGE" : "5 · LAYUP IN RANGE" : "Find your spot.")}</p>
    {a.mode === "held" && <div className="release-meter" aria-label="Shot release" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.charge * 100)}><span className="release-zone" /><i style={{ width: a.charge * 100 + "%" }} /></div>}
    <div className="activity-actions">
      <button onClick={() => courtCommand(a.mode === "held" ? "dribble" : "pickup")}>{a.mode === "held" ? a.dribbling ? "E · Hold ball" : "E · Dribble" : "E · Pick up nearby ball"}</button>
      {a.mode === "held" && <button data-court-charge="true" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); courtCommand("charge"); }} onPointerUp={() => courtCommand("release")} onPointerCancel={() => courtCommand("cancel")} onBlur={() => courtCommand("cancel")} onKeyDown={event => { if (isPrimaryShotKey(event.code) && !event.repeat) { event.preventDefault(); courtCommand("charge"); } }} onKeyUp={event => { if (isPrimaryShotKey(event.code)) { event.preventDefault(); courtCommand("release"); } }}>Hold / release · Shoot</button>}
      {a.dribbling&&<><button onClick={()=>courtCommand("between-legs")}>Z · 胯下换手</button><button onClick={()=>courtCommand("behind-back")}>C · 背后换手</button><button onClick={()=>courtCommand("hesitation")}>Q · 迟疑运球</button></>}
      <button onClick={() => courtCommand("recall")}>R · Recall ball</button>
      <button aria-pressed={a.assist} onClick={() => useActivity.setState({ assist: !a.assist })}>Arc assist {a.assist ? "on" : "off"}</button>
      {a.mode === "held" && <><button disabled={a.finishing !== "idle"} onClick={() => courtCommand("layup")}>5 · Layup</button><button disabled={a.finishing !== "idle"} onClick={() => courtCommand("dunk")}>Enter + 5 · Dunk</button></>}
    </div>
    <PerspectiveControls roomId="basketball" />
    {!courtSets[selectedCourt].indoor&&<div className="court-time" role="group" aria-label="Court lighting">
      <button aria-pressed={courtTime.time === "day"} onClick={() => courtTime.setTime("day")}>Daylight</button>
      <button aria-pressed={courtTime.time === "night"} onClick={() => courtTime.setTime("night")}>Night lights</button>
    </div>}
    <small>WASD 移动 · Enter 加速运球 · V 切换视角<br />长按 5 / 小键盘 5，松开投篮 · 近篮 5 上篮 · 助跑 Enter + 5 扣篮<br />E 拾球 / 运球 · X 换手 · Z 胯下 · C 背后 · Q 迟疑 · R 找回球</small>
  </aside>;
}
