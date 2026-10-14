import { usePalaceStore } from "../../systems/store";
import { Dialog } from "../../ui/primitives";
import { outfits, useAppearance } from "./appearance";
import { motionPacks, type MotionPackCategory, type MotionPackSelection } from "../court/motionPacks";
import { useCourtPackages } from "../court/packagePreferences";
import { courtSets, useCourtSet, type CourtSetId } from "../court/courtSets";
import "./wardrobe.css";

const packageGroups: { category: MotionPackCategory; title: string }[] = [
  { category: "shot", title: "投篮包" },
  { category: "hands", title: "双手动作包" }, { category: "dribble", title: "运球包" },
  { category: "layup", title: "上篮包" }, { category: "dunk", title: "扣篮包" },
];

function CourtPackages() {
  const court = useCourtPackages(), venue = useCourtSet();
  return <section className="court-motion-packs" aria-labelledby="court-package-title">
    <p className="eyebrow">YOUR COURT / YOUR MOTION</p><h3 id="court-package-title">球场动作</h3>
    <p className="panel-description">选择起始持球手与动作节奏。返回球场后生效，X 可随时左右换手。</p>
    <fieldset className="court-package-options court-set-options"><legend>球场风格</legend>
      {Object.entries(courtSets).map(([id, set]) => <button key={id} type="button" aria-pressed={venue.selected === id} onClick={() => venue.setCourt(id as CourtSetId)}><span>{set.title}</span><small>{set.description}</small></button>)}
    </fieldset>
    <fieldset className="court-hand-choice"><legend>起始持球手</legend>
      <button type="button" aria-pressed={court.preferredHand === -1} onClick={() => court.setHand(-1)}>左手</button>
      <button type="button" aria-pressed={court.preferredHand === 1} onClick={() => court.setHand(1)}>右手</button>
    </fieldset>
    {packageGroups.map(({ category, title }) => <fieldset key={category} className="court-package-options" data-package-category={category}><legend>{title}</legend>
      {Object.entries(motionPacks[category]).map(([id, pack]) => <button key={id} type="button" aria-pressed={court.packs[category] === id} onClick={() => court.select(category, id as MotionPackSelection[typeof category])}>
        <span>{pack.title}</span><small>{pack.description}</small>
      </button>)}
    </fieldset>)}
  </section>;
}

export default function AthleteWardrobe() {
  const a = useAppearance(), room = a.wardrobe;
  if (!room) return null;
  return <Dialog label="人物与穿搭" className="athlete-wardrobe" onClose={() => usePalaceStore.getState().setOverlay(null)}>
    <p className="eyebrow">YOUR PRESENCE / YOUR WARDROBE</p><h2>{room === "basketball" ? "人物与球场" : "人物与穿搭"}</h2>
    <p className="panel-description">这一处场景会记住你的选择。应用后回到第三视角查看。</p>
    <div className="wardrobe-view" role="group" aria-label="人物预览视角"><button onClick={() => useAppearance.setState({ previewAngle: a.previewAngle - Math.PI / 4 })}>↶ 转向</button><button onClick={() => useAppearance.setState({ previewAngle: a.previewAngle + Math.PI / 4 })}>转向 ↷</button></div>
    {a.profile && <fieldset className="athlete-profile-choice"><legend>人物轮廓</legend><button aria-pressed={a.personal} onClick={() => a.setPersonal(true)}>照片参考角色 · 仅本机</button><button aria-pressed={!a.personal} onClick={() => a.setPersonal(false)}>基础角色</button></fieldset>}
    <fieldset className="athlete-outfits"><legend>穿搭</legend>{Object.entries(outfits).map(([id, outfit]) => <button key={id} aria-pressed={a.selected[room] === id} onClick={() => a.select(room, id as keyof typeof outfits)}>
      <span className="outfit-swatch" style={{ background: `linear-gradient(150deg, ${outfit.top} 50%, ${outfit.bottom} 50%)` }} aria-hidden="true"/><span>{outfit.title}<small>{room === "basketball" ? "球场 / 日常穿搭" : outfit.bike === "city" ? "休闲直把骑姿" : "公路骑姿"}{outfit.backpack ? " · 轻背包" : ""}</small></span>
    </button>)}</fieldset>
    {room === "basketball" && <CourtPackages />}
    <p className="athlete-private-note">原始照片、视频与个人形态参数留在本机。公共版本提供基础人物和原创穿搭。</p>
    <button className="primary-button" onClick={() => usePalaceStore.getState().setOverlay(null)}>应用并返回场景</button>
  </Dialog>;
}
