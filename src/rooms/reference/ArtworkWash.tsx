import { useMemo } from "react";
import { Object3D } from "three";
import type { ArtPlacement } from "../../world/spatialLayout";

export default function ArtworkWash({ placement }: { placement: ArtPlacement }) {
  const target = useMemo(() => new Object3D(), []);
  return <group position={placement.position} rotation={placement.rotation}>
    <primitive object={target} />
    <spotLight position={[0, placement.height / 2 + 1.4, 3]} target={target} color="#f2e7d4" intensity={52 + placement.width * 5} angle={.88} penumbra={.8} distance={14} decay={2} />
  </group>;
}
