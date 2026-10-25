import { usePerspective, type AdventureRoom } from "./state";
import { useEffect } from "react";
import { loadLocalAppearance, openWardrobe } from "./appearance";
import "./wardrobe.css";
import {useCourtFraming} from './courtFraming';
export default function PerspectiveControls({ roomId }: { roomId: AdventureRoom }) {
  const view = usePerspective(s => s.views[roomId]), setView = usePerspective(s => s.setView);
  const framing=useCourtFraming();
  useEffect(() => { void loadLocalAppearance(); }, []);
  return <div className="perspective-controls" role="group" aria-label="Camera perspective">
    <button aria-pressed={view === "first"} onClick={() => setView(roomId, "first")}>First person</button>
    <button aria-pressed={view === "third"} onClick={() => setView(roomId, "third")}>Third person · V</button>
    {roomId==='basketball'&&view==='third'&&<button aria-pressed={framing.framing==='detail'} onClick={event=>{framing.setFraming(framing.framing==='detail'?'court':'detail');event.currentTarget.blur();}}>动作近景</button>}
    <button onClick={() => openWardrobe(roomId)}>人物 / 穿搭</button>
  </div>;
}
