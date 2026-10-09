import { lazy, Suspense, type ReactNode } from "react";
import { Block, Floor, Label } from "../world/primitives";
import { WorldPortal } from "./WorldPortal";
import { loadCourt, loadRide } from "./preload";
import WorldWarmup from "./WorldWarmup";

const Basketball = lazy(loadCourt);
const Cycling = lazy(loadRide);
function WorldsWing() {
  return <group name="worlds-threshold-wing">
    <Floor width={26} depth={32} color="#494f48" />
    <Block position={[0, 3.65, -13.6]} scale={[26, 7.3, .5]} color="#253d46" />
    <Block position={[0, 5.8, 8]} scale={[26, .3, 11]} color="#36454b" />
    <Block position={[-12.8, 3, 0]} scale={[.4, 6, 30]} color="#53605b" />
    <Block position={[12.8, 3, 0]} scale={[.4, 6, 30]} color="#53605b" />
    <Block position={[0, .12, -10.9]} scale={[26, .24, 4]} color="#6a6b5c" />
    {[-1, 1].map(side => <group key={side}>
      <Block position={[side * 11.7, 3.2, -8.8]} scale={[.32, 6.4, .6]} color="#56696a" metalness={.18} castShadow />
      <Block position={[side * 6.1, 6.35, -9.2]} scale={[11.5, .24, 3]} color="#53656b" />
      <Block position={[side * 6.1, .13, -8.6]} scale={[8.1, .18, 7]} color="#687879" roughness={.68} />
      <Block position={[side * 6.1, .25, -4.5]} scale={[5.6, .012, .06]} color="#bda582" emissive="#bda582" emissiveIntensity={.22} />
    </group>)}
    <Label text="WORLDS BEYOND THE ARCHIVE" position={[0, 5.92, -7.6]} size={.3} color="#e3d8c3" />
    <Label text="Choose a rhythm. Make a moment." position={[0, 5.52, -7.6]} size={.14} color="#c3c9bd" />
    <WorldPortal id="basketball" title="Street Basketball Court" position={[-6.1, 3.1, -11.2]} />
    <WorldPortal id="atrium" title="Return to the Atrium" position={[0, 2.8, 15]} rotation={[0, Math.PI, 0]} compact />
    <WorldPortal id="cycling" title="Scenic Cycling Route" position={[6.1, 3.1, -11.2]} />
  </group>;
}
export function MuseumWorldsEntry({ roomId }: { roomId: string }) {
  return roomId === "atrium" ? <WorldPortal id="worlds" title="Worlds beyond the archive" position={[19.55, 3.1, 7.2]} rotation={[0, -Math.PI / 2, 0]} museum /> : null;
}
export default function WorldsBoundary({ roomId, children }: { roomId: string; children: ReactNode }) {
  if (roomId === "worlds") return <WorldWarmup key={roomId} roomId={roomId}><WorldsWing /></WorldWarmup>;
  if (roomId === "basketball") return <Suspense fallback={null}><WorldWarmup key={roomId} roomId={roomId}><Basketball /></WorldWarmup></Suspense>;
  if (roomId === "cycling") return <Suspense fallback={null}><WorldWarmup key={roomId} roomId={roomId}><Cycling /></WorldWarmup></Suspense>;
  return children;
}
