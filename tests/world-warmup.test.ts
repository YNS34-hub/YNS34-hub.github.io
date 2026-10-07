import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial, PerspectiveCamera, Scene, type Material, type WebGLRenderer } from "three";
import { warmPrograms } from "../src/worlds/warmPrograms";

describe("cancellable new-scene preparation", () => {
  it("keeps original materials and geometry intact, waits for actual readiness and can cancel pending programs", () => {
    const scene = new Scene(), root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const object = new InstancedMesh(geometry, material, 1); object.castShadow = true; root.add(object); scene.add(root); root.visible = false;
    const materialDispose = vi.spyOn(material, "dispose"), geometryDispose = vi.spyOn(geometry, "dispose");
    let ready = false;
    const poll = vi.fn(() => ready), programs = new Map<Material, { currentProgram: { isReady: typeof poll } }>();
    const compile = vi.fn((source: Group) => {
      expect(root.visible).toBe(true);
      const list = new Set<Material>(); source.traverse(object => { if ("material" in object) { const m = object.material as Material; list.add(m); programs.set(m, { currentProgram: { isReady: poll } }); } }); return list;
    });
    const renderer = { compile, properties: { get: (m: Material) => programs.get(m) }, getContext: () => ({ isContextLost: () => false }),
      getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0, setRenderTarget: vi.fn() } as unknown as WebGLRenderer;
    const job = warmPrograms(renderer, root, new PerspectiveCamera(), scene);
    expect(root.visible).toBe(false); expect(compile).toHaveBeenCalledTimes(3); expect(job.ready()).toBe(false);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null, 0, 0);
    ready = true; expect(job.ready()).toBe(true);
    job.dispose(); job.dispose(); const count = poll.mock.calls.length;
    expect(job.ready()).toBe(false); expect(poll).toHaveBeenCalledTimes(count);
    expect(materialDispose).not.toHaveBeenCalled(); expect(geometryDispose).not.toHaveBeenCalled();
    const retainedDepth = [...programs.keys()].find(m => m !== material)!;
    expect(retainedDepth.type).toBe("MeshDepthMaterial");
    object.dispose(); material.dispose(); geometry.dispose();
  });
  it("restores visibility and the existing render target when compilation fails", () => {
    const scene = new Scene(), root = new Group(); root.visible = false; scene.add(root);
    const previous = { name: "existing-view" }, setRenderTarget = vi.fn();
    const renderer = { compile: () => { throw new Error("lost program"); }, getRenderTarget: () => previous,
      getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 3, setRenderTarget } as unknown as WebGLRenderer;
    expect(() => warmPrograms(renderer, root, new PerspectiveCamera(), scene)).toThrow("lost program");
    expect(root.visible).toBe(false); expect(setRenderTarget).toHaveBeenLastCalledWith(previous, 2, 3);
  });
});
