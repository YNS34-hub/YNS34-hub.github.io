import { useEffect, useMemo } from "react";
import { BackSide, ExtrudeGeometry, Path, Shape } from "three";
import { EntryBlock, useEntrySurfaces } from "./surfaces";

export default function AtriumSkylight() {
  const surfaces = useEntrySurfaces();
  const slab = useMemo(() => {
    const shape = new Shape(); shape.moveTo(-21, -25); shape.lineTo(21, -25); shape.lineTo(21, 25); shape.lineTo(-21, 25); shape.closePath();
    const hole = new Path(); hole.absellipse(0, 0, 8, 14, 0, Math.PI * 2, true, 0); shape.holes.push(hole);
    return new ExtrudeGeometry(shape, { depth: .55, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 1, curveSegments: 48 });
  }, []);
  useEffect(() => () => slab.dispose(), [slab]);
  return <group name="atrium-elliptical-skylight">
    <mesh position={[0, 14.3, -2]} rotation={[Math.PI / 2, 0, 0]} geometry={slab} material={surfaces.get("#cbdfe9", .65, .02, 1)} castShadow receiveShadow dispose={null} />
    <mesh position={[0, 14.25, -2]} scale={[1, 1, 1.75]}>
      <cylinderGeometry args={[8, 8, .65, 120, 1, true]} />
      <meshStandardMaterial color="#4c555e" metalness={.26} roughness={.42} side={BackSide} />
    </mesh>
    <mesh position={[0, 13.71, -2]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.75, 1]}>
      <torusGeometry args={[8.045, .026, 6, 144]} /><meshStandardMaterial color="#d8c3a1" emissive="#e8c996" emissiveIntensity={1.25} roughness={.5} />
    </mesh>
    <mesh position={[0, 14.63, -2]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.75, 1]}>
      <circleGeometry args={[8, 120]} /><meshPhysicalMaterial color="#edf6fa" roughness={.025} metalness={0} transmission={.98} thickness={.025} ior={1.46} envMapIntensity={.5} />
    </mesh>
    {[-10, -4, 2, 8].map(z => {
      const width = 2 * 8 * Math.sqrt(1 - (z / 14) ** 2);
      return <EntryBlock key={z} position={[0, 14.68, z - 2]} scale={[width, .14, .12]} color="#a8cfe5" metalness={.7} />;
    })}
  </group>;
}
