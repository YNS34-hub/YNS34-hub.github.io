import { create } from "zustand";
import { usePalaceStore } from "../../systems/store";
import { usePerspective, type AdventureRoom } from "./state";
import { validateAvatarProfile, type AvatarProfile } from "./avatarProfile.mjs";

export const outfits = {
  "court-blue": { title: "冰蓝球场", top: "#296dc1", bottom: "#1a71db", style: "jersey", bike: "road", cap: false, backpack: false },
  "street-black": { title: "黑白街球", top: "#202a30", bottom: "#343d44", style: "jersey", bike: "road", cap: false, backpack: false },
  "training-blue": { title: "训练 · 速干背心", top: "#536b65", bottom: "#1682de", style: "training", bike: "road", cap: false, backpack: false },
  "cap-denim": { title: "日常 · 帽子与丹宁", top: "#c7b9a1", bottom: "#334958", style: "denim", bike: "city", cap: true, backpack: false },
  "park-ride": { title: "林间 · 黑外套", top: "#242b31", bottom: "#30373a", style: "urban", bike: "city", cap: false, backpack: true },
  "road-pearl": { title: "公路 · 珍珠白", top: "#d4dedb", bottom: "#293a44", style: "jersey", bike: "road", cap: false, backpack: false },
} as const;
export type OutfitId = keyof typeof outfits;
const KEY = "memory-palace:athlete-appearance:v1";
export const neutralProfile: AvatarProfile = { version: 1, skin: "#cda587", hair: "#242523", shoulders: 1, chest: 1, waist: 1, arms: 1, jaw: 1, nose: 1, eyeHeight: 1, hairCrop: .8 };
const defaults: Record<AdventureRoom, OutfitId> = { basketball: "court-blue", cycling: "park-ride", "alpine-ride": "road-pearl" };
function read() {
  const selected = { ...defaults }; let profile: AvatarProfile | null = null, personal = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    for (const room of Object.keys(selected) as AdventureRoom[]) if (Object.hasOwn(outfits, saved?.selected?.[room] ?? "")) selected[room] = saved.selected[room];
    profile = validateAvatarProfile(saved?.profile); personal = saved?.personal !== false;
  } catch { /* 不可用的本机存储不影响原骑行与馆藏。 */ }
  return { selected, profile, personal };
}
type Appearance = ReturnType<typeof read> & { head: string|null; wardrobe: AdventureRoom | null; previewAngle: number; previewFraming:'body'|'face';select: (room: AdventureRoom, outfit: OutfitId) => void; setPersonal: (personal: boolean) => void; setProfile: (profile: AvatarProfile) => void };
function save(state: Appearance) { try { localStorage.setItem(KEY, JSON.stringify({ selected: state.selected, personal: state.personal, profile: state.profile })); } catch { /* 不上传替代存档。 */ } }
export const useAppearance = create<Appearance>((set, get) => ({ ...read(), head:null, wardrobe: null, previewAngle: Math.PI - .35,previewFraming:'body',
  select: (room, outfit) => { if (!Object.hasOwn(outfits, outfit)) return; set({ selected: { ...get().selected, [room]: outfit } }); save(get()); },
  setPersonal: personal => { set({ personal }); save(get()); },
  setProfile: profile => { const valid = validateAvatarProfile(profile); if (valid) { set({ profile: valid }); save(get()); } },
}));
let loading: Promise<void> | null = null;
export function loadLocalAppearance() {
  return loading ??= fetch("/personal-media/avatar.json", { credentials: "same-origin" }).then(async response => {
    if (!response.ok) return; const data = await response.json(), profile = validateAvatarProfile(data?.profile);
    useAppearance.setState({head:profile && data.head === "/personal-media/avatar-head.png" ? data.head : null});
    if (profile) useAppearance.getState().setProfile(profile);
  }).catch(() => { /* 旧预览无该文件时，使用授权基础人物与已有本机参数。 */ });
}
export function openWardrobe(room: AdventureRoom) {
  useAppearance.setState({ wardrobe: room, previewAngle: Math.PI - .35,previewFraming:'body' }); usePerspective.getState().setView(room, "third");
  const unsubscribe = usePalaceStore.subscribe(state => { if (state.overlay !== "settings") { useAppearance.setState({ wardrobe: null }); unsubscribe(); } });
  usePalaceStore.getState().setOverlay("settings");
}
