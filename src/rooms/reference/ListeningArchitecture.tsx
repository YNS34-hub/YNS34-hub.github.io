import { useEffect, useMemo } from "react";
import { BackSide, RingGeometry } from "three";
import { Block } from "../../world/primitives";
import { PaddedBench } from "../../world/StudioObjects";
import { ArchitecturalBlock as Stone, useArchitecturalSurfaces } from "./ArchitecturalSurfaces";

export default function ListeningArchitecture() {
  const surfaces = useArchitecturalSurfaces();
  const canopy = useMemo(() => new RingGeometry(4.85, 12, 96), []);
  useEffect(() => () => canopy.dispose(), [canopy]);
  return <group name="listening-finished-envelope">
    {/* 实体弧形内衬封住原肋条后方的空隙，保留面向入口的真实开口。 */}
    <mesh position={[0, 4.4, -4]} castShadow receiveShadow>
      <cylinderGeometry args={[12.45, 12.45, 8.8, 96, 1, true, Math.PI * .12, Math.PI * 1.76]} />
      <meshStandardMaterial color="#292e35" roughness={.94} side={BackSide} />
    </mesh>
    <mesh position={[0, 8.42, -5]} rotation={[Math.PI / 2, 0, 0]} geometry={canopy} material={surfaces.material("basalt", "#505258", .75)} dispose={null} />
    <mesh position={[0, 8.57, -5]}>
      <cylinderGeometry args={[4.86, 4.86, .3, 96, 1, true]} />
      <meshStandardMaterial color="#343c44" metalness={.24} roughness={.48} side={BackSide} />
    </mesh>
    <mesh position={[0, 8.4, -5]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[4.8, .018, 6, 120]} /><meshStandardMaterial color="#e1c49c" emissive="#f2d2a2" emissiveIntensity={1.1} roughness={.5} />
    </mesh>
    <mesh position={[0, 8.78, -4]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[12.1, .09, 8, 120, Math.PI * 1.76]} /><meshStandardMaterial color="#76644d" metalness={.6} roughness={.42} />
    </mesh>
    <Stone position={[0, 9.5, -5]} scale={[26, .65, 24]} color="#30383f" castShadow />
    <group name="listening-curved-optical-baffle" position={[0, 3.68, -5]}>
      <mesh scale={[2, 1, 1]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 6.05, 48, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#48616f" roughness={.92} side={BackSide} />
      </mesh>
      {[-1, 1].map(side => <Stone key={side} position={[side * 3.23, 0, 0]} scale={[.055, 6.1, .12]} finish="bronze" color="#8b887d" />)}
    </group>
    <PaddedBench position={[-4, 0, 6.5]} width={4.8} color="#766052" />
    <Block position={[-4, .004, 6.45]} scale={[6, .012, 2.8]} color="#41464b" roughness={.98} bevel={0} />
    <Stone position={[-7.9, 3.3, -8.09]} rotation={[0, .36, 0]} scale={[4.02, 4.02, .12]} finish="bronze" color="#716b60" roughness={.45} />
  </group>;
}
