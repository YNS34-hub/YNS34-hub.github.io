import { useEffect, useState } from "react";
import { usePalaceStore } from "../../systems/store";
import { roomViews } from "../../world/visitView";
import { useMotionCue } from "../../motion/useMotionCue";
import { activeRoadSectors,roadChapter,roadForestDensity,roadLength } from "./route";
import { useRoadRide,roadCommand } from "./state";
import "./road.css";

let returnRoom="worlds";
export function rememberRoadReturn(previous:string){if(previous!=="cycling"&&previous!=="cinema")returnRoom=previous==="basketball"?"worlds":previous;}
function returnToPalace(){
  const view=roomViews.get(returnRoom);usePalaceStore.getState().enterRoom(returnRoom);
  if(view)usePalaceStore.getState().update({returnView:view});
}
function RoadMoment({ title, kind, hidden = false }: { title: string; kind: "gear" | "chapter" | "place"; hidden?: boolean }) {
  const [visible, setVisible] = useState(true);
  const cue = useMotionCue<HTMLDivElement>(title, "copy");
  useEffect(() => {
    // 提示寿命不依赖 CSS 动画，减少动态模式下也会正常退场。
    const timer = window.setTimeout(() => setVisible(false), kind === "gear" ? 2200 : 4800);
    return () => window.clearTimeout(timer);
  }, [kind]);
  if (!visible) return null;
  return <div ref={cue} hidden={hidden} className={"road-moment road-moment-" + kind}>
    <span>{title}</span>{kind === "place" && <small>THE ROAD WAS QUIET HERE.</small>}
  </div>;
}
export default function RoadHud(){
  const r=useRoadRide();
  const muted=usePalaceStore(s=>s.mute);
  const forestShade=roadForestDensity(r.distance/roadLength)>.45;
  // 纹理树冠不能由原建筑色取样判断亮度；只给新路线林间使用原馆标的浅色墨，不改字体或构图。
  useEffect(()=>{const root=document.querySelector<HTMLElement>(".palace-app");if(root)root.dataset.cyclingShade=String(forestShade);return()=>{if(root)delete root.dataset.cyclingShade;};},[forestShade]);
  useEffect(()=>{const root=document.querySelector<HTMLElement>(".palace-app");if(root)root.dataset.activityPhoto=String(r.photo);return()=>{if(root)delete root.dataset.activityPhoto;};},[r.photo]);
  return <div className="road-ui" data-mounted={r.mounted} data-photo={r.photo}>
    <output className="road-status sr-only" aria-live="off" data-state={r.state} data-speed={r.speed.toFixed(3)} data-distance={r.distance.toFixed(2)} data-grade={r.grade.toFixed(4)} data-cadence={r.cadence.toFixed(1)} data-gear={r.gear} data-mounted={r.mounted} data-sectors={activeRoadSectors(r.distance).join(",")} data-photo={r.photo}>The Long Way Home · {r.state}</output>
    {!r.mounted&&<div className="road-entry-copy"><span>A RIDE THROUGH MEMORY</span><h2>THE LONG WAY HOME</h2><p>{r.nearBike?"A road bike. An unhurried afternoon.":"Walk toward the bicycle beside the road."}</p><button className="road-mount" disabled={!r.nearBike} onClick={()=>roadCommand("mount")}>Mount / ride · E</button></div>}
    {r.mounted&&!r.photo&&!r.controls&&<div className="road-minimal"><div className="road-velocity"><strong>{(r.speed*3.6).toFixed(0)}</strong><span>KM/H</span></div><button onClick={()=>useRoadRide.setState({controls:true})}>Ride options</button></div>}
    {r.mounted&&r.gearSequence>0&&<RoadMoment kind="gear" title={`GEAR ${r.gear} / 12`} key={"gear:"+r.gearSequence} hidden={r.photo||r.controls}/>}
    {r.mounted&&<RoadMoment kind="chapter" title={roadChapter(r.distance)} key={"chapter:"+roadChapter(r.distance)} hidden={r.photo||r.controls||!!r.place}/>}
    {r.place&&r.speed<.5&&<RoadMoment kind="place" title={r.place} key={"place:"+r.place} hidden={r.photo||r.controls}/>}
    {r.controls&&!r.photo&&<aside className="road-options" aria-label="Road cycling options">
      <div className="road-options-heading"><span>THE LONG WAY HOME</span><button aria-label="Close ride options" onClick={()=>useRoadRide.setState({controls:false})}>×</button></div>
      <p>W / ↑ pedal · release to coast<br/>S / ↓ / Space brake · A / D steer<br/>Q easier · E harder · Shift stronger effort<br/>Drag / lock to look · P photo view<br/>Continuous pedaling selects an easier climbing gear.</p>
      <div className="road-readouts"><span>{(r.distance/1000).toFixed(2)} KM</span><span>{Math.round(r.grade*100)}% GRADE</span><span>{Math.round(r.cadence)} RPM</span></div>
      {r.mounted&&<><button onClick={()=>{roadCommand("pedal");useRoadRide.setState({controls:false});}}>{r.easy?"Coast freely":"Pedal continuously"}</button><button onClick={()=>{roadCommand("brake");useRoadRide.setState({controls:false});}}>Brake gently</button><button onClick={()=>roadCommand("stop")}>Stop at next viewpoint</button><button onClick={()=>{roadCommand("photo");useRoadRide.setState({controls:false});}}>Photo view · P</button><button disabled={r.speed>.3} onClick={()=>roadCommand("dismount")}>Dismount</button></>}
      <button aria-pressed={r.comfort} onClick={()=>useRoadRide.setState({comfort:!r.comfort})}>Camera motion · {r.comfort?"reduced":"full"}</button>
      <button aria-pressed={!muted} onClick={()=>usePalaceStore.getState().update({mute:!muted})}>Sound {muted?"off":"on"}</button>
      <button onClick={()=>usePalaceStore.getState().setOverlay("player")}>My listening library</button>
      <button disabled={r.speed>.2} onClick={()=>roadCommand("restart")}>Return to trailhead</button><button onClick={returnToPalace}>Return to the Palace</button>
    </aside>}
    {r.photo&&<div className="road-photo-tools"><button onClick={()=>roadCommand("save")}>Save this view</button><button onClick={()=>roadCommand("photo")}>Exit photo view · ESC</button></div>}
    {!r.mounted&&!r.controls&&<button className="road-entry-return" onClick={returnToPalace}>Return to the Palace</button>}
  </div>;
}
