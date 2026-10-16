import { finishEligibility, type FinishInput } from "./finishing";

export const isPrimaryShotKey = (code: string) => code === "Digit5" || code === "Numpad5";
export const isCourtTurboKey = (code: string) => code === "Enter" || code === "NumpadEnter";
// 球场严格采用访客的 2K 键位；馆内原有 Shift 行走方式仍保持。
export function courtMovementSpeed(room: string, keys: ReadonlySet<string>) {
  return room === "basketball" ? keys.has("Enter") || keys.has("NumpadEnter") ? 6.2 : 2.7
    : keys.has("ShiftLeft") || keys.has("ShiftRight") ? 4.45 : 2.7;
}

/** Creative gathers brake and accelerate on their existing physical bounce phase. */
export function creativeDribbleWindow(move:string,phase:number,active:boolean):number{
 if(!active||(move!=="between-legs"&&move!=="behind-back"&&move!=="hesitation")||!Number.isFinite(phase))return 0;
 const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
 return smooth(phase/.18)*(1-smooth((phase-.70)/.30));
}
export function creativeDribbleSpeed(base:number,move:string,phase:number,active:boolean):number{
 return base-(base-Math.min(base,3))*creativeDribbleWindow(move,phase,active);
}

// 同一个投篮键根据场上位置选择动作；远投继续交给原有蓄力 / 松键 / 球物理链路。
export function primaryCourtAction(input: FinishInput, turbo: boolean): "shoot" | "layup" | "dunk" {
  const layup = finishEligibility("layup", input);
  if (!input.held || layup.distance > 3.4 || /Face|court side/.test(layup.reason)) return "shoot";
  return turbo && layup.distance <= 2.8 ? "dunk" : "layup";
}
