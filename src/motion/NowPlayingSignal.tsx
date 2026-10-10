import { useEffect, useRef } from "react";
import { useAudioStore } from "../audio/player";
import { audioSignal } from "../audio/signal";
import { useQuietMotion } from "./useMotionCue";
import { boundedProgress } from "./choreography";
import { settleMotion } from "./tokens";

export default function NowPlayingSignal() {
  const progress = useRef<HTMLSpanElement>(null), energy = useRef<HTMLSpanElement>(null);
  const quiet = useQuietMotion();
  useEffect(() => {
    let frame = 0, last = 0, value = 0;
    const draw = (now: number) => {
      const player = useAudioStore.getState();
      if (now - last >= 80) {
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        if (progress.current) progress.current.style.transform = `scaleX(${boundedProgress(player.progress, player.duration)})`;
        value = settleMotion(value, player.playing && audioSignal.available && !quiet ? audioSignal.rms : 0, dt, .18, .6);
        if (energy.current) energy.current.style.opacity = String(.25 + value * .65);
      }
      // 暂停后仅等真实包络归零；不让静止播放器持续运行帧循环。
      if (!document.hidden && (player.playing || value > .002)) frame = requestAnimationFrame(draw);
      else frame = 0;
    };
    const wake = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); };
    const unsubscribe = useAudioStore.subscribe(wake);
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); };
    document.addEventListener("visibilitychange", visibility); wake();
    return () => { cancelAnimationFrame(frame); unsubscribe(); document.removeEventListener("visibilitychange", visibility); };
  }, [quiet]);
  return <><span className="mini-energy" ref={energy} aria-hidden="true"/><span className="mini-progress" aria-hidden="true"><span ref={progress}/></span></>;
}
