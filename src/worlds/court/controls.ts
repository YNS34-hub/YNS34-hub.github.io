import { finishEligibility, type FinishInput } from "./finishing";

export const isPrimaryShotKey = (code: string) => code === "Digit5" || code === "Numpad5";
export const isCourtTurboKey = (code: string) => code === "Enter" || code === "NumpadEnter" || code === "ShiftLeft" || code === "ShiftRight";

// 同一个投篮键根据场上位置选择动作；远投继续交给原有蓄力 / 松键 / 球物理链路。
export function primaryCourtAction(input: FinishInput, turbo: boolean): "shoot" | "layup" | "dunk" {
  const layup = finishEligibility("layup", input);
  if (!input.held || layup.distance > 3.4 || /Face|court side/.test(layup.reason)) return "shoot";
  return turbo && layup.distance <= 2.8 ? "dunk" : "layup";
}
