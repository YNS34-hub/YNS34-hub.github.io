import { create } from "zustand";
import { motionPacks, normalizePacks, type MotionPackCategory, type MotionPackSelection } from "./motionPacks";

const KEY = "memory-palace:basketball-packages:v1";
type CourtPackagePreferences = {
  packs: MotionPackSelection; preferredHand: -1 | 1;
  select: <Category extends MotionPackCategory>(category: Category, id: MotionPackSelection[Category]) => void;
  setHand: (side: -1 | 1) => void;
};

function read(): Pick<CourtPackagePreferences, "packs" | "preferredHand"> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return { packs: normalizePacks(saved?.packs), preferredHand: saved?.preferredHand === -1 ? -1 : 1 };
  } catch { return { packs: normalizePacks(null), preferredHand: 1 }; }
}

function save(state: CourtPackagePreferences) {
  try { localStorage.setItem(KEY, JSON.stringify({ packs: state.packs, preferredHand: state.preferredHand })); }
  catch { /* 本机存储不可用时，当前会话仍可选择动作；不写入人物或馆藏存档。 */ }
}

export const useCourtPackages = create<CourtPackagePreferences>((set, get) => ({
  ...read(),
  select: (category, id) => {
    if (!Object.hasOwn(motionPacks, category) || typeof id !== "string" || !Object.hasOwn(motionPacks[category], id)) return;
    set({ packs: normalizePacks({ ...get().packs, [category]: id }) }); save(get());
  },
  setHand: side => {
    if (side !== -1 && side !== 1) return;
    set({ preferredHand: side }); save(get());
  },
}));
