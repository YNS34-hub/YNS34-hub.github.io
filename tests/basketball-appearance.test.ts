import { describe, expect, it, vi } from "vitest";
import { BufferGeometry, DataTexture, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from "three";
import { installBasketballAppearance } from "../src/worlds/presence/basketballAppearance";
import { dressAthlete } from "../src/worlds/presence/appearanceRig";
import { neutralProfile, outfits, type OutfitId } from "../src/worlds/presence/appearance";

function fixture(name = "m026_body") {
  const group = new Group(), geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0,-8,130,3,-8,130,0,-8,134],3));
  const texture = new DataTexture(new Uint8Array([128,96,72,255]),1,1);
  const material = new MeshStandardMaterial({ map: texture, normalMap: texture, roughness: .66 });
  material.name = name;
  const mesh: Mesh = new Mesh(geometry,material); group.add(mesh);
  dressAthlete(mesh,neutralProfile,"court-blue");
  return { group, mesh, geometry, material, texture };
}
function compile(material: MeshStandardMaterial) {
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} } as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as WebGLRenderer);
  return shader;
}

describe("court-only athlete surface detail", () => {
  it("renders the training torso as cloth and keeps scalp ribbons on their own hair material",()=>{
    const a=fixture();dressAthlete(a.mesh,neutralProfile,'training-blue');
    const shader=compile(a.mesh.material as MeshStandardMaterial);expect(shader.uniforms.athleteStyle.value).toBe(0);expect(shader.uniforms.athleteTop.value.getHexString()).toBe('536b65');
    const hair=new MeshStandardMaterial();hair.name='m026_hair';a.mesh.material=hair;dressAthlete(a.mesh,neutralProfile,'training-blue');expect(hair.color.getHexString()).toBe(neutralProfile.hair.slice(1));expect(hair.roughness).toBe(.58);
  });
  it("decorates separate material copies and restores the exact original identity on removal", () => {
    const a = fixture(), beforeCompile = a.material.onBeforeCompile, beforeKey = a.material.customProgramCacheKey;
    const roughness = a.material.roughness, normalScale = a.material.normalScale.clone();
    const detail = installBasketballAppearance(a.group,{ outfitId: "court-blue" });
    const own = a.mesh.material as MeshStandardMaterial;
    expect(own).not.toBe(a.material);
    expect(own.map).toBe(a.texture); expect(own.normalMap).toBe(a.texture);
    expect(a.material.onBeforeCompile).toBe(beforeCompile); expect(a.material.customProgramCacheKey).toBe(beforeKey);
    expect(a.material.roughness).toBe(roughness); expect(a.material.normalScale.equals(normalScale)).toBe(true);
    detail.dispose();
    expect(a.mesh.material).toBe(a.material);
    expect(a.mesh.geometry).toBe(a.geometry); expect(a.texture.image.data[0]).toBe(128);
  });

  it("owns each shared material once, never disposes source geometry or texture, and supports effect replay", () => {
    const a = fixture(), b = new Mesh(a.geometry,a.material); a.group.add(b);
    const disposeSource = vi.spyOn(a.material,"dispose"), disposeTexture = vi.spyOn(a.texture,"dispose"), disposeGeometry = vi.spyOn(a.geometry,"dispose");
    const detail = installBasketballAppearance(a.group,{ outfitId: "street-black" });
    expect(detail.materialCount).toBe(1); expect(b.material).toBe(a.mesh.material);
    const own = a.mesh.material as MeshStandardMaterial, disposeOwn = vi.spyOn(own,"dispose");
    detail.dispose(); detail.dispose(); expect(disposeOwn).toHaveBeenCalledTimes(1);
    expect(disposeSource).not.toHaveBeenCalled(); expect(disposeTexture).not.toHaveBeenCalled(); expect(disposeGeometry).not.toHaveBeenCalled();
    detail.activate(); detail.activate(); expect(a.mesh.material).toBe(own); expect(b.material).toBe(own);
    expect(compile(own).uniforms.athleteSkin.value).toBeDefined();
    detail.dispose(); expect(disposeOwn).toHaveBeenCalledTimes(2);
  });

  it("retains wardrobe colour, personal face texture, original normal detail, and cache separation", () => {
    const a = fixture("m026_head");
    const detail = installBasketballAppearance(a.group,{ outfitId: "training-blue", personalHead: true });
    const own = a.mesh.material as MeshStandardMaterial, shader = compile(own);
    expect(own.map).toBe(a.texture);
    expect(shader.uniforms.athleteSkin.value.getHexString()).toBe("cda587");
    expect(shader.uniforms.basketballPersonalHead.value).toBe(1);
    expect(shader.fragmentShader).toContain("#include <normal_fragment_maps>");
    expect(shader.fragmentShader).not.toContain("float basketballHeight");
    expect(shader.fragmentShader).not.toContain("diffuseColor.rgb *= 1.");
    expect(own.customProgramCacheKey()).not.toBe(a.material.customProgramCacheKey());
    detail.dispose();
  });

  it.each(Object.keys(outfits) as OutfitId[])("keeps %s wardrobe composition and finite style uniforms", outfitId => {
    const a = fixture(); dressAthlete(a.mesh,neutralProfile,outfitId);
    const originalShader = compile(a.material);
    const detail = installBasketballAppearance(a.group,{ outfitId });
    const shader = compile(a.mesh.material as MeshStandardMaterial);
    expect(shader.uniforms.athleteStyle.value).toBe(originalShader.uniforms.athleteStyle.value);
    expect(shader.uniforms.athleteTop.value.getHexString()).toBe(originalShader.uniforms.athleteTop.value.getHexString());
    expect(Number.isFinite(shader.uniforms.basketballStyle.value)).toBe(true);
    expect(shader.fragmentShader).toContain("vAthleteSleeve>.04");
    expect(shader.fragmentShader).toContain("#include <alphamap_fragment>");
    expect(shader.fragmentShader).toContain("#include <roughnessmap_fragment>");
    expect(shader.fragmentShader).toContain("#include <clearcoat_normal_fragment_begin>");
    detail.dispose();
  });

  it("leaves unrelated meshes and an externally replaced material untouched during cleanup", () => {
    const a = fixture(), external = new MeshStandardMaterial(); external.name = "another-world";
    const unrelated = new Mesh(a.geometry,external), outline = new Mesh(a.geometry,a.material);
    outline.name = "rider-outline:test"; a.group.add(unrelated,outline);
    const detail = installBasketballAppearance(a.group,{ outfitId: "court-blue" });
    expect(unrelated.material).toBe(external); expect(outline.material).toBe(a.material);
    const replacement = new MeshBasicMaterial(); a.mesh.material = replacement;
    detail.dispose(); detail.activate(); expect(a.mesh.material).toBe(replacement);
    detail.dispose(); expect(a.mesh.material).toBe(replacement);
  });

  it("handles material arrays without modifying the original slots", () => {
    const a = fixture(), plain = new MeshBasicMaterial(), originals = [a.material,plain]; a.mesh.material = originals;
    const detail = installBasketballAppearance(a.group,{ outfitId: "court-blue" });
    const own = a.mesh.material as (MeshStandardMaterial | MeshBasicMaterial)[];
    expect(own).not.toBe(originals); expect(own[0]).not.toBe(a.material); expect(own[1]).toBe(plain);
    expect(originals).toEqual([a.material,plain]); detail.dispose(); expect(a.mesh.material).toBe(originals);
  });
});
