import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

export default function MasonryDetails() {
  const joints = useRef<InstancedMesh>(null);
  const segments = useMemo(() => {
    const result: { position: [number, number, number]; scale: [number, number, number] }[] = [];
    // 阴缝贴在原墙面以内，不改墙、门洞或碰撞；全部共用一个实例批次。
    for (const side of [-1, 1]) {
      for (const z of [-24, -14, -4, 6, 16]) {
        result.push({ position: [side * 20.185, 7, z], scale: [.018, 13.4, .025] });
      }
      result.push({ position: [side * 20.185, 11.8, -1], scale: [.018, .028, 50] });
    }
    for (const x of [-19, -11, 11, 19]) {
      result.push({ position: [x, 7.3, -25.085], scale: [.025, 14.1, .018] });
    }
    return result;
  }, []);
  useLayoutEffect(() => {
    if (!joints.current) return;
    const transform = new Matrix4(), rotation = new Quaternion();
    for (const [index, segment] of segments.entries()) {
      transform.compose(new Vector3(...segment.position), rotation, new Vector3(...segment.scale));
      joints.current.setMatrixAt(index, transform);
    }
    joints.current.instanceMatrix.needsUpdate = true;
    joints.current.computeBoundingSphere();
  }, [segments]);
  return <group name="atrium-masonry-details">
    <instancedMesh ref={joints} args={[undefined, undefined, segments.length]} raycast={() => {}}>
      <boxGeometry />
      <meshStandardMaterial color="#353b36" roughness={.88} />
    </instancedMesh>
    <mesh position={[0, .316, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[3.43, 3.495, 96]} />
      <meshStandardMaterial color="#8b7756" metalness={.72} roughness={.43} />
    </mesh>
  </group>;
}
