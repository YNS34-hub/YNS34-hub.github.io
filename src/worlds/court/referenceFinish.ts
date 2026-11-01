import type { MeshStandardMaterial, Texture } from "three";

const decorated = new WeakSet<MeshStandardMaterial>();
export function applyCourtFinish(material: MeshStandardMaterial, aggregate: Texture, wear: Texture) {
  if (decorated.has(material)) return;
  decorated.add(material);
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.courtAggregate = { value: aggregate };
    shader.uniforms.courtWear = { value: wear };
    shader.fragmentShader = "uniform sampler2D courtAggregate;uniform sampler2D courtWear;\n" + shader.fragmentShader;
    // 保留原比例画线；微表面只调制涂层，浅色线漆不再被同一磨损蒙版压暗成灰线。
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      vec3 groundDetail=texture2D(courtAggregate,vMapUv*vec2(12.,18.)).rgb;
      float grain=dot(groundDetail,vec3(.2126,.7152,.0722));
      vec3 coating=texture2D(courtWear,vMapUv).rgb;
      float lineInk=smoothstep(.58,.88,min(sampledDiffuseColor.r,min(sampledDiffuseColor.g,sampledDiffuseColor.b)));
      float dryCoating=mix(.95,1.035,smoothstep(.025,.62,grain))*(.94+coating.r*.12)*(1.-coating.b*.18);
      diffuseColor.rgb*=mix(dryCoating,1.,lineInk*.92);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*.93+coating.g*.07,.84,1.);");
  };
  material.customProgramCacheKey = () => "court-dry-coating-line-ink-v3";
  material.userData.courtTextures = [aggregate, wear];
  material.needsUpdate = true;
}
