import { lazy, Suspense, type ReactNode } from "react";
import { Block, Floor, Label } from "../world/primitives";
import { WorldPortal } from "./WorldPortal";

const Basketball = lazy(() => import("./BasketballCourt"));
function WorldsWing() {
  return <group name="worlds-threshold-wing">
    <Floor width={26} depth={32} color="#494f48" />
    <Block position={[0, 5.8, 8]} scale={[26, .3, 11]} color="#36454b" />
    <Block position={[-12.8, 3, 0]} scale={[.4, 6, 30]} color="#53605b" />
    <Block position={[12.8, 3, 0]} scale={[.4, 6, 30]} color="#53605b" />
    <Block position={[0, .12, -10.9]} scale={[26, .24, 4]} color="#6a6b5c" />
    <Label text="WORLDS BEYOND THE ARCHIVE" position={[0, 6.2, -13]} size={.35} color="#e3d8c3" />
    <Label text="Choose a rhythm. Make a moment." position={[0, 5.54, -13]} size={.18} color="#c3c9bd" />
    <WorldPortal id="basketball" title="Street Basketball Court" position={[-6.1, 3.1, -11.2]} />
    <WorldPortal id="atrium" title="Return to the Atrium" position={[0, 2.8, 15]} rotation={[0, Math.PI, 0]} compact />
    <Block position={[6.1, 2.1, -11.2]} scale={[6.4, 4.2, .18]} color="#496357" />
    <Label text="GOLDEN FOREST / ROUTE STUDY" position={[6.1, 3.1, -11]} size={.24} color="#e0d3b7" maxWidth={6} />
  </group>;
}
export function MuseumWorldsEntry({ roomId }: { roomId: string }) {
  return roomId === "atrium" ? <WorldPortal id="worlds" title="Worlds beyond the archive" position={[20, 3.1, 12]} rotation={[0, -Math.PI / 2, 0]} /> : null;
}
export default function WorldsBoundary({ roomId, children }: { roomId: string; children: ReactNode }) {
  if (roomId === "worlds") return <WorldsWing />;
  if (roomId === "basketball") return <Suspense fallback={null}><Basketball /></Suspense>;
  return children;
}
