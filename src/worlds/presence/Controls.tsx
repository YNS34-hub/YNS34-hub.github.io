import { usePerspective, type AdventureRoom } from "./state";
export default function PerspectiveControls({ roomId }: { roomId: AdventureRoom }) {
  const view = usePerspective(s => s.views[roomId]), setView = usePerspective(s => s.setView);
  return <div className="perspective-controls" role="group" aria-label="Camera perspective">
    <button aria-pressed={view === "first"} onClick={() => setView(roomId, "first")}>First person</button>
    <button aria-pressed={view === "third"} onClick={() => setView(roomId, "third")}>Third person · V</button>
  </div>;
}
