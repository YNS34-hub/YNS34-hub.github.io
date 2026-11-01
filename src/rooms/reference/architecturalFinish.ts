import { MeshStandardMaterial, Vector2, type Texture } from "three";

export type ArchitecturalMaps = { color: Texture; normal: Texture; roughness: Texture };
export type FinishKind = "basalt" | "limestone" | "timber" | "bronze";
export const finishPalette = {
  basalt: { color: "#4d5359", roughness: .62, metalness: .015, tile: 2.8, normal: .34 },
  limestone: { color: "#b6b6ad", roughness: .62, metalness: .015, tile: 3.2, normal: .25 },
  timber: { color: "#9c8773", roughness: .6, metalness: 0, tile: 2.8, normal: .24 },
  bronze: { color: "#a68a65", roughness: .36, metalness: .72, tile: 2.8, normal: .07 },
};

export function worldMappedFinish(material: MeshStandardMaterial, tile: number, slab = false, timber = false) {
  const original = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    shader.vertexShader = "varying vec3 architecturalPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
      vec4 stonePosition=vec4(position,1.);vec3 stoneNormal=normal;
      #ifdef USE_INSTANCING
        stonePosition=instanceMatrix*stonePosition;stoneNormal=mat3(instanceMatrix)*stoneNormal;
      #endif
      architecturalPosition=(modelMatrix*stonePosition).xyz;
      vec3 stoneWorldNormal=normalize(mat3(modelMatrix)*stoneNormal);
      vec2 stoneUv=abs(stoneWorldNormal.y)>.55?architecturalPosition.xz:(abs(stoneWorldNormal.x)>.55?architecturalPosition.zy:architecturalPosition.xy);
      ${timber ? "if(abs(stoneWorldNormal.y)<.55)stoneUv=abs(stoneWorldNormal.x)>.55?vec2(architecturalPosition.y*.5,architecturalPosition.z*1.5):vec2(architecturalPosition.y*.5,architecturalPosition.x*1.5);" : ""}
      stoneUv/=${tile.toFixed(4)};
      #ifdef USE_MAP
        vMapUv=stoneUv;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv=stoneUv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv=stoneUv;
      #endif
    `);
    shader.fragmentShader = "varying vec3 architecturalPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor,roughness*.88,1.);");
    if (slab) shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      vec2 stoneCell=abs(fract((architecturalPosition.xz+vec2(1.2,.8))/vec2(2.4,3.2))-.5)*vec2(2.4,3.2);
      float stoneEdge=min(stoneCell.x,stoneCell.y);
      float stoneJoint=1.-smoothstep(.004,.004+max(fwidth(stoneEdge),.0015),stoneEdge);
      outgoingLight*=mix(1.,.74,stoneJoint);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `architectural-world-pbr-v2-${tile}-${slab}-${timber}`;
  material.needsUpdate = true;
  return material;
}

export function createArchitecturalFinish(kind: FinishKind, maps: ArchitecturalMaps, options: { color?: string; roughness?: number; metalness?: number; floor?: boolean } = {}) {
  const profile = finishPalette[kind];
  return worldMappedFinish(new MeshStandardMaterial({
    color: options.color || profile.color, roughness: options.roughness ?? profile.roughness,
    metalness: options.metalness ?? profile.metalness,
    map: maps.color, normalMap: maps.normal, roughnessMap: maps.roughness,
    normalScale: new Vector2(options.floor ? .1 : profile.normal * .65, options.floor ? .1 : profile.normal * .65), envMapIntensity: .8,
  }), profile.tile, options.floor && kind !== "timber", kind === "timber");
}
