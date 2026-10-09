import { useEffect, useSyncExternalStore } from "react";
import { usePalaceStore } from "../systems/store";
import { useMotionCue } from "../motion/useMotionCue";
import { activateFocused, readInteraction, subscribeInteraction } from "./registry";
import "./interaction.css";
import PlayerContinuity from "./PlayerContinuity";

export default function InteractionHud() {
  const snapshot = useSyncExternalStore(subscribeInteraction, readInteraction);
  const visible = usePalaceStore(s => s.started && !s.overlay && !s.focus && s.mode !== "index" && s.roomId !== "cinema");
  const hint = useMotionCue<HTMLDivElement>(snapshot.id, "copy", visible && !!snapshot.id);
  const response = useMotionCue<HTMLDivElement>(snapshot.sequence, "copy", visible && !!snapshot.feedback);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".palace-app");
    if (root) root.dataset.attention = visible ? snapshot.id ? "gaze" : snapshot.nearId ? "near" : "idle" : "idle";
    return () => { if (root) delete root.dataset.attention; };
  }, [visible, snapshot.id, snapshot.nearId]);
  return <>
    <PlayerContinuity />
    {visible && !snapshot.id && snapshot.nearId && <div className="interaction-presence" aria-hidden="true"><i />{snapshot.nearTitle}<small>LOOK TO EXPLORE</small></div>}
    {visible && snapshot.id && <div className="interaction-hint" ref={hint} data-target={snapshot.id}>
      <span>{snapshot.title}</span>
      <button onClick={() => activateFocused()}><kbd>E</kbd> {snapshot.hint}</button>
      {snapshot.secondary && <button onClick={() => activateFocused(true)}><kbd>F</kbd> Keep / release</button>}
    </div>}
    {snapshot.feedback && <div className="interaction-response" role="status" key={snapshot.sequence} ref={response}>{snapshot.feedback}</div>}
  </>;
}
