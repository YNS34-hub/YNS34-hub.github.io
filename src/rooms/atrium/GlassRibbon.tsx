import { useEffect, useMemo } from "react";
import { MeshPhysicalMaterial } from "three";
import { createMemoryRibbon } from "./ribbonGeometry";

export default function GlassRibbon() {
  const resources = useMemo(() => ({
    geometry: createMemoryRibbon(),
    material: new MeshPhysicalMaterial({ color: "#e6f6ff", metalness: 0, roughness: .04, transmission: .98, thickness: .18, ior: 1.46, attenuationColor: "#a9d2e5", attenuationDistance: 3.5, clearcoat: 0, envMapIntensity: .75 }),
  }), []);
  // 独立拥有装饰网格与材质；原 GLB 和其缓存从不被写入或释放。
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose(); }, [resources]);
  return <mesh name="memory-glass-ribbon" geometry={resources.geometry} material={resources.material} dispose={null} />;
}
