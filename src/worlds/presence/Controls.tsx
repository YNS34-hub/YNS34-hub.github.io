import { usePerspective, type AdventureRoom } from "./state";
import { useEffect } from "react";
import { loadLocalAppearance, openWardrobe } from "./appearance";
import "./wardrobe.css";
export default function PerspectiveControls({ roomId }: { roomId: AdventureRoom }) {
  const view = usePerspective(s => s.views[roomId]), setView = usePerspective(s => s.setView);
  useEffect(() => { void loadLocalAppearance(); }, []);
  return <div className="perspective-controls" role="group" aria-label="Camera perspective">
    <button aria-pressed={view === "first"} onClick={() => setView(roomId, "first")}>First person</button>
    <button aria-pressed={view === "third"} onClick={() => setView(roomId, "third")}>Third person · V</button>
    <button onClick={() => openWardrobe(roomId)}>人物 / 穿搭</button>
  </div>;
}
