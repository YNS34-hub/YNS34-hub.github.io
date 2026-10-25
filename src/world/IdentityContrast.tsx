import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Mesh, Raycaster, Vector2, type Intersection, type Material } from "three";
import { useIdentityTone } from "../systems/identityTone";
import { usePalaceStore } from "../systems/store";
import { resolveRoomPlan } from "./roomPlan";
const sampleFractions = [0.25, 0.6, 0.9];

/** Sparse architectural samples, without GPU readback or changing the identity's layout. */
export default function IdentityContrast() {
  const { camera, scene, gl } = useThree();
  const roomId = usePalaceStore(s => s.roomId);
  const dark = useMemo(() => resolveRoomPlan(roomId).dark, [roomId]);
  const sample = useMemo(() => ({ ray: new Raycaster(), uv: new Vector2(), color: new Color(), hits: [] as Intersection[], elapsed: 1 }), []);
  useFrame((_, dt) => {
    sample.elapsed += dt;
    if (sample.elapsed < 0.75) return;
    sample.elapsed = 0;
    // Fog and low scene illumination make base material colors misleading in dark galleries.
    // Keep the same light ink there; only the bright atrium needs architectural sampling.
    if (dark) {
      if (!useIdentityTone.getState().light) useIdentityTone.setState({ light: true });
      return;
    }
    camera.updateMatrixWorld();
    const brand = document.querySelector(".hud .wordmark");
    if (!brand) return;
    const bounds = brand.getBoundingClientRect();
    let luminance = 0;
    for (const fraction of sampleFractions) {
      sample.uv.set(((bounds.left + bounds.width * fraction) / innerWidth) * 2 - 1, 1 - ((bounds.top + bounds.height / 2) / innerHeight) * 2);
      sample.ray.setFromCamera(sample.uv, camera);
      sample.hits.length = 0;
      sample.ray.intersectObjects(scene.children, true, sample.hits);
      gl.getClearColor(sample.color);
      for (const hit of sample.hits) {
        if (!(hit.object instanceof Mesh) || !hit.object.visible) continue;
        const material = (Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material) as Material & { color?: Color; transmission?: number };
        if (!material?.color || material.opacity < 0.8 || (material.transmission || 0) > 0.5) continue;
        sample.color.copy(material.color);
        break;
      }
      luminance += sample.color.r * 0.2126 + sample.color.g * 0.7152 + sample.color.b * 0.0722;
    }
    luminance /= 3;
    const previous = useIdentityTone.getState().light;
    const light = previous ? luminance < 0.28 : luminance < 0.16;
    if (light !== previous) useIdentityTone.setState({ light });
  });
  return null;
}
