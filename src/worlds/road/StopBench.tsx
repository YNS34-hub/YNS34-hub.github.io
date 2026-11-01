import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BoxBatch, type BoxInstance } from '../../world/StudioObjects';

// 共用已有的实拍木材，不把树皮当座板；只拥有 sampler / 几何 / 材质副本。
export const stopBenchTextureUrls = ['Color', 'NormalGL', 'Roughness'].map(kind => `/media/surfaces/WoodFloor051_1K-JPG_${kind}.jpg`);
export function useStopBenchFinish() {
  const sources = useTexture(stopBenchTextureUrls);
  const owned = useMemo(() => {
    const maps = sources.map((source, i) => {
      const texture = source.clone(); texture.colorSpace = i ? NoColorSpace : SRGBColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(1.1, .35); texture.anisotropy = 4; texture.needsUpdate = true;
      return texture;
    });
    const material = new MeshStandardMaterial({ map: maps[0], normalMap: maps[1], roughnessMap: maps[2], color: '#b3a18a', normalScale: new Vector2(.14, .14), roughness: .92, envMapIntensity: .5 });
    const geometry = new RoundedBoxGeometry(1.8, .085, .14, 1, .012);
    return { maps, material, geometry };
  }, [sources]);
  useEffect(() => () => { owned.maps.forEach(texture => texture.dispose()); owned.material.dispose(); owned.geometry.dispose(); }, [owned]);
  return owned;
}

export default function StopBench({ x, seatY, feet, finish }: {
  x: number; seatY: number; feet: { x: number; y: number }[]; finish: ReturnType<typeof useStopBenchFinish>;
}) {
  const steel: BoxInstance[] = [];
  for (const foot of feet) {
    const height = seatY - .065 - foot.y;
    for (const z of [1.34, 1.66]) steel.push({ position: [foot.x, foot.y + height / 2, z], scale: [.045, height, .045] });
    steel.push({ position: [foot.x, seatY - .075, 1.5], scale: [.065, .065, .45] });
    steel.push({ position: [foot.x, foot.y + .012, 1.5], scale: [.085, .025, .43] });
  }
  steel.push({ position: [x, seatY - .15, 1.5], scale: [1.34, .045, .045] });
  return <group name="scenic-stop-slat-bench">
    <BoxBatch items={steel} color="#343e41" roughness={.55} metalness={.65} />
    {[-1, 0, 1].map(i => <mesh key={i} geometry={finish.geometry} material={finish.material} position={[x, seatY, 1.5 + i * .156]} castShadow receiveShadow dispose={null} />)}
  </group>;
}
