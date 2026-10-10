import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { Color, InstancedMesh, Mesh, Object3D, type BufferGeometry, type MeshStandardMaterial } from "three";
import { crowdNames } from "./assets";

// 场外观众共用离线姿态，不安装另一套骨骼动画器；他们不会参与碰撞或挡住回馆入口。
function SpectatorType({ name, type }: { name: string; type: number }) {
  const source = useGLTF("/media/court/people/" + name + "/pose.gltf");
  const parts = useMemo(() => {
    const list: { geometry: BufferGeometry; material: MeshStandardMaterial }[] = [];
    source.scene.traverse(o => {
      if (!(o instanceof Mesh)) return;
      const material = (o.material as MeshStandardMaterial).clone(); material.color.set("#ffffff"); material.roughness = .86;
      list.push({ geometry: o.geometry, material });
    }); return list;
  }, [source]);
  const positions = useMemo(() => {
    const list: { x: number; z: number; rotation: number; scale: number }[] = [];
    for (let i = 0; i < 60; i++) {
      if (i % crowdNames.length !== type) continue;
      const side = i < 30 ? -1 : 1, j = i % 30, z = -16 + j * 1.08, x = side * (13.25 + j % 3 * .47);
      list.push({ x, z, rotation: side < 0 ? Math.PI / 2 + (j % 5 - 2) * .07 : -Math.PI / 2 + (j % 5 - 2) * .07, scale: .93 + j % 7 * .022 });
    }
    for (let i = 0; i < 18; i++) if ((i + 2) % crowdNames.length === type) {
      list.push({ x: -10.2 + i * 1.2, z: -19.25 - i % 3 * .35, rotation: (i % 5 - 2) * .06, scale: .94 + i % 5 * .025 });
    }
    return list;
  }, [type]);
  useEffect(() => () => parts.forEach(p => p.material.dispose()), [parts]);
  return <group name={"park-spectators:" + name} dispose={null}>
    {parts.map((p, i) => <CrowdBatch key={i} {...p} positions={positions} />)}
  </group>;
}
function CrowdBatch({ geometry, material, positions }: { geometry: BufferGeometry; material: MeshStandardMaterial; positions: { x: number; z: number; rotation: number; scale: number }[] }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => { const instance = ref.current; return () => { instance?.dispose(); }; }, []);
  useLayoutEffect(() => {
    const o = new Object3D(), c = new Color();
    positions.forEach((p, i) => {
      o.position.set(p.x, 0, p.z); o.rotation.set(0, p.rotation, 0); o.scale.setScalar(p.scale); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, c.set(i % 2 ? "#e2e8e8" : "#fff0dd"));
    }); ref.current!.instanceMatrix.needsUpdate = true; ref.current!.instanceColor!.needsUpdate = true; ref.current!.computeBoundingSphere();
  }, [positions]);
  return <instancedMesh ref={ref} args={[geometry, material, positions.length]} castShadow receiveShadow />;
}
export default function CourtCrowd() { return <group name="licensed-park-spectators">{crowdNames.map((name, type) => <SpectatorType key={name} name={name} type={type} />)}</group>; }
