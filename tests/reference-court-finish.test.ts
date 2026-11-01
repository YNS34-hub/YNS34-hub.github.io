import { describe, expect, it, vi } from "vitest";
import { MeshStandardMaterial, Texture, type WebGLProgramParametersWithUniforms } from "three";
import { applyCourtFinish } from "../src/worlds/court/referenceFinish";

describe("dry court coating finish", () => {
  it("decorates once, binds owned samplers, and preserves material ownership and dry roughness", () => {
    const aggregate = new Texture(), wear = new Texture(), paint = new Texture();
    const dispose = vi.fn(); for (const t of [aggregate, wear, paint]) t.addEventListener("dispose", dispose);
    const material = new MeshStandardMaterial({ map: paint, roughness: .92, metalness: 0 });
    applyCourtFinish(material, aggregate, wear);
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
    applyCourtFinish(material, aggregate, wear);
    expect(material.onBeforeCompile).toBe(compile); expect(material.customProgramCacheKey()).toBe(key);
    expect(material.map).toBe(paint); expect(material.roughness).toBeGreaterThan(.8); expect(material.metalness).toBe(0);
    const shader = { uniforms: {}, vertexShader: "", fragmentShader: "#include <map_fragment>\n#include <roughnessmap_fragment>" } as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as never);
    expect(shader.uniforms.courtAggregate.value).toBe(aggregate); expect(shader.uniforms.courtWear.value).toBe(wear);
    expect(shader.fragmentShader.match(/uniform sampler2D courtAggregate/g)).toHaveLength(1);
    expect(shader.fragmentShader).not.toContain("#include <roughnessmap_fragment>\n#include");
    material.dispose(); expect(dispose).not.toHaveBeenCalled();
    aggregate.dispose(); wear.dispose(); paint.dispose();
  });
});
