import { Group, InstancedMesh, Line, LineSegments, Mesh, MeshDepthMaterial, Points, WebGLRenderTarget, BackSide, DoubleSide, FrontSide, RGBADepthPacking, type Camera, type Material, type Object3D, type Scene, type WebGLRenderer } from "three";

// r180 的 compile 提交程序后，由当前版本的 isReady 查询 KHR_parallel_shader_compile。
// 不创建另一个 renderer、不绘制离屏画面。原材质仍由原组件拥有，帧内轮询允许随时取消。
export function warmPrograms(renderer: WebGLRenderer, root: Object3D, camera: Camera, scene: Scene) {
  const holder = new Group(), depths = new Map<Material, MeshDepthMaterial>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    const original = Array.isArray(object.material) ? object.material : [object.material];
    const copy = (material: Material | Material[]) => {
      if (object instanceof InstancedMesh) {
        const mesh = new InstancedMesh(object.geometry, material, 0); mesh.instanceColor = object.instanceColor; return mesh;
      }
      if (object instanceof Mesh) return new Mesh(object.geometry, material);
      if (object instanceof LineSegments) return new LineSegments(object.geometry, material);
      if (object instanceof Line) return new Line(object.geometry, material);
      return new Points(object.geometry, material);
    };
    if (object.castShadow && object instanceof Mesh) {
      const source = original[0];
      let depth = depths.get(source);
      if (!depth) {
        const sampled = source as Material & { map?: MeshDepthMaterial["map"]; alphaMap?: MeshDepthMaterial["alphaMap"] };
        depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: sampled.map, alphaMap: sampled.alphaMap, alphaTest: source.alphaTest,
          side: source.side === DoubleSide ? DoubleSide : source.side === FrontSide ? BackSide : FrontSide });
        depths.set(source, depth);
      }
      holder.add(copy(depth));
    }
  });
  let cancelled = false;
  const dispose = () => {
    if (cancelled) return;
    cancelled = true; depths.forEach(material => material.dispose()); holder.clear();
  };
  const visible = root.visible;
  const beforeTarget = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
  let variantTarget: WebGLRenderTarget | undefined;
  try {
    // 让编译器读取真实灯光组合；同步提交后立刻恢复隐藏，不会出现一帧闪现。
    root.visible = true;
    const materials = renderer.compile(scene, camera);
    const offscreen = [...materials].some(material => (material as Material & { transmission?: number }).transmission) || !!root.getObjectByName("sky-reflecting-lake") || depths.size > 0;
    if (offscreen) {
      // 玻璃、湖面与阴影还使用线性输出变体；1×1 临时目标只用于正确编译，完全不绘制并立即释放。
      variantTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
      renderer.setRenderTarget(variantTarget);
      renderer.compile(scene, camera).forEach(material => materials.add(material));
      renderer.compile(holder, camera, scene).forEach(material => materials.add(material));
    }
    const programs = new Set([...materials].flatMap(material => {
      const entry = renderer.properties.get(material) as { currentProgram?: { isReady: () => boolean }; programs?: Map<string, { isReady: () => boolean }> };
      return entry.programs ? [...entry.programs.values()] : entry.currentProgram ? [entry.currentProgram] : [];
    }));
    const pending = [...programs];
    return {
      ready: () => !cancelled && !renderer.getContext().isContextLost() && pending.every(program => program.isReady()),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
  finally { renderer.setRenderTarget(beforeTarget, face, level); variantTarget?.dispose(); root.visible = visible; }
}
