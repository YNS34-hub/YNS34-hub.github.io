import { usePalaceStore } from "../../systems/store";
import { Dialog } from "../../ui/primitives";
import { outfits, useAppearance } from "./appearance";
import "./wardrobe.css";

export default function AthleteWardrobe() {
  const a = useAppearance(), room = a.wardrobe;
  if (!room) return null;
  return <Dialog label="人物与穿搭" className="athlete-wardrobe" onClose={() => usePalaceStore.getState().setOverlay(null)}>
    <p className="eyebrow">YOUR PRESENCE / YOUR WARDROBE</p><h2>人物与穿搭</h2>
    <p className="panel-description">这一处场景会记住你的选择。应用后回到第三视角查看。</p>
    <div className="wardrobe-view" role="group" aria-label="人物预览视角"><button onClick={() => useAppearance.setState({ previewAngle: a.previewAngle - Math.PI / 4 })}>↶ 转向</button><button onClick={() => useAppearance.setState({ previewAngle: a.previewAngle + Math.PI / 4 })}>转向 ↷</button></div>
    {a.profile && <fieldset className="athlete-profile-choice"><legend>人物轮廓</legend><button aria-pressed={a.personal} onClick={() => a.setPersonal(true)}>照片参考角色 · 仅本机</button><button aria-pressed={!a.personal} onClick={() => a.setPersonal(false)}>基础角色</button></fieldset>}
    <fieldset className="athlete-outfits"><legend>穿搭</legend>{Object.entries(outfits).map(([id, outfit]) => <button key={id} aria-pressed={a.selected[room] === id} onClick={() => a.select(room, id as keyof typeof outfits)}>
      <span className="outfit-swatch" style={{ background: `linear-gradient(150deg, ${outfit.top} 50%, ${outfit.bottom} 50%)` }} aria-hidden="true"/><span>{outfit.title}<small>{outfit.bike === "city" ? "休闲直把骑姿" : "公路骑姿"}{outfit.backpack ? " · 轻背包" : ""}</small></span>
    </button>)}</fieldset>
    <p className="athlete-private-note">原始照片、视频与个人形态参数留在本机。公共版本提供基础人物和原创穿搭。</p>
    <button className="primary-button" onClick={() => usePalaceStore.getState().setOverlay(null)}>应用并返回场景</button>
  </Dialog>;
}
