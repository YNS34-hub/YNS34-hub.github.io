import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, RGBADepthPacking, Vector3, type WebGLProgramParametersWithUniforms } from "three";
import { useQuietMotion } from "../../motion/useMotionCue";
import { usePalaceStore } from "../../systems/store";
import Instances, { type Instance } from "../Instances";
import { cloneTreeTextures, useTreeShape } from "./assets";

export default function CourtTrees() {
  const root = useRef<Group>(null);
  const shape = useTreeShape(), quiet = useQuietMotion(), tier = usePalaceStore(s => s.effectiveQuality);
  const sources = useTexture(["branches-color", "branches-normal", "trunk-color", "trunk-normal", "leaves-color"].map(n => "/media/court/tree/" + n + ".webp"));
  const maps = useMemo(() => cloneTreeTextures(sources), [sources]);
  const wood = useMemo(() => shape.parts.map(p => { const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(p.position, 3)); g.setAttribute("normal", new Float32BufferAttribute(p.normal, 3)); g.setAttribute("uv", new Float32BufferAttribute(p.uv, 2)); g.setIndex(p.index); g.computeBoundingSphere(); return g; }), [shape]);
  const locations = useMemo(() => {
    const list: Instance[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
      const scale = .59 + (i * 17 % 5) * .035;
      list.push({ position: [side * (18.5 + i % 2 * 2), 0, -32 + i * 10], scale: [scale, scale * (1 + i % 3 * .055), scale], rotation: [0, i * 1.79 + side, 0], color: i % 2 ? "#d6dbc9" : "#f1e5d3" });
    }
    for (let i = 0; i < 5; i++) { const s = .64 + i % 2 * .15; list.push({ position: [-32 + i * 15, 0, -36 - i % 2 * 3], scale: [s, s, s], rotation: [0, i * 2.07, 0], color: "#dce2cf" }); }
    return list;
  }, []);
  const crown = useMemo(() => {
    const position: number[] = [], uv: number[] = [], indices: number[] = [], center = new Vector3(), right = new Vector3(), up = new Vector3(), p = new Vector3();
    const budget = tier === "low" ? 1200 : tier === "high" ? 6000 : 3200, stride = Math.max(1, shape.crown.length / budget);
    const patches = [[.49, .51, .997, .995], [.001, .19, .51, .62], [.28, .001, .998, .4]];
    for (let n = 0; n < Math.min(budget, shape.crown.length); n++) {
      const i = Math.floor(n * stride); center.set(...shape.crown[i]);
      const a = i * 2.399963, b = (i * 41 % 100) / 100 * .9 - .45, size = .72 + i % 7 * .055;
      right.set(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(size * .5); up.set(Math.sin(a) * Math.sin(b), Math.cos(b), Math.cos(a) * Math.sin(b)).multiplyScalar(size * .5);
      const start = position.length / 3, tile = patches[i % 3];
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { p.copy(center).addScaledVector(right, x).addScaledVector(up, y); position.push(p.x, p.y, p.z); }
      uv.push(tile[0], tile[1], tile[2], tile[1], tile[2], tile[3], tile[0], tile[3]); indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(position, 3)); g.setAttribute("uv", new Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }, [shape, tier]);
  const motion = useMemo(() => ({ time: { value: 0 }, amplitude: { value: 0 } }), []);
  const leaves = useMemo(() => {
    const m = new MeshStandardMaterial({ map: maps[4], alphaTest: .48, side: DoubleSide, roughness: .93, color: "#c9d9ab" });
    const d = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: maps[4], alphaTest: .48, side: DoubleSide });
    const patch = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.courtWindTime = motion.time; shader.uniforms.courtWindAmplitude = motion.amplitude;
      shader.vertexShader = "uniform float courtWindTime; uniform float courtWindAmplitude;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.x+=sin(courtWindTime*.48+position.y*.76+position.z*.65)*courtWindAmplitude*smoothstep(3.,12.,position.y);");
    };
    m.onBeforeCompile = patch; d.onBeforeCompile = patch; m.customProgramCacheKey = d.customProgramCacheKey = () => "park-tree-breeze-v1"; return { material: m, depth: d };
  }, [maps, motion]);
  useEffect(() => () => maps.forEach(t => t.dispose()), [maps]);
  useEffect(() => () => wood.forEach(g => g.dispose()), [wood]);
  useEffect(() => () => crown.dispose(), [crown]);
  useEffect(() => () => { leaves.material.dispose(); leaves.depth.dispose(); }, [leaves]);
  // 树木在围栏外，不参与门、球或场内遮挡；无需让品牌采样/注视射线遍历每片叶子的三角形。
  useLayoutEffect(() => { root.current?.traverse(o => { if (o instanceof Mesh) o.raycast = () => {}; }); }, [wood, crown]);
  useFrame(({ clock }) => { motion.time.value = clock.elapsedTime; motion.amplitude.value = quiet ? 0 : .028; });
  return <group ref={root} name="real-jacaranda-park-canopy">
    {wood.map((g, i) => <Instances key={i} items={locations} geometry={g} map={maps[i * 2]} normalMap={maps[i * 2 + 1]} color="#b9b7aa" roughness={.94} shadows />)}
    <CrownInstances locations={locations} geometry={crown} material={leaves.material} depth={leaves.depth} />
  </group>;
}

function CrownInstances({ locations, geometry, material, depth }: { locations: Instance[]; geometry: BufferGeometry; material: MeshStandardMaterial; depth: MeshDepthMaterial }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D(); locations.forEach((item, i) => { o.position.set(...item.position); o.scale.set(...item.scale); o.rotation.set(...(item.rotation || [0, 0, 0])); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix); }); ref.current!.instanceMatrix.needsUpdate = true; ref.current!.computeBoundingSphere();
  }, [locations]);
  return <instancedMesh ref={ref} args={[geometry, material, locations.length]} customDepthMaterial={depth} castShadow receiveShadow />;
}
