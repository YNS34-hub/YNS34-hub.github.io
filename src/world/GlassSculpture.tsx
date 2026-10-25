import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Mesh } from "three";
/** Same closed optical solid at every tier. Cache owns the original; the mount owns only its clone. */
export function GlassSculpture({ radius = 2.6 }: { radius?: number }) {
  const gltf = useGLTF("/assets/memory-glass.glb");
  const geometry = useMemo(() => {
    let source: BufferGeometry | undefined;
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh && !source) source = o.geometry;
    });
    const result = source?.clone() || new BufferGeometry();
    result.computeBoundingSphere();
    const scale = radius / (result.boundingSphere?.radius || 1);
    result.center();
    result.scale(scale, scale, scale);
    return result;
  }, [gltf, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshPhysicalMaterial
        color="#eefaff"
        roughness={0.025}
        metalness={0}
        transmission={1}
        thickness={3.8}
        ior={1.46}
        attenuationColor="#a1dbfc"
        attenuationDistance={12}
        clearcoat={0.22}
        clearcoatRoughness={0.03}
        envMapIntensity={1.3}
      />
    </mesh>
  );
}
