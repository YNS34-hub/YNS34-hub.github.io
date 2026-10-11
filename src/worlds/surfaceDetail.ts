import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, NoColorSpace, Vector2, Vector3, type Texture } from "three";

// 蒙版是线性数据，各展面只拥有 sampler 副本，不能销毁 drei 的共享解码纹理。
export function cloneWearTexture(source: Texture) {
  const texture = source.clone(); texture.colorSpace = NoColorSpace;
  texture.anisotropy = 8; texture.needsUpdate = true; return texture;
}

const decoratedRoads = new WeakSet<MeshStandardMaterial>();
export function applyRoadWear(material: MeshStandardMaterial, uvToMetres: [number, number], width: number) {
  if (decoratedRoads.has(material)) return;
  decoratedRoads.add(material);
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.roadWearMetres = { value: new Vector2(...uvToMetres) };
    shader.uniforms.roadWearWidth = { value: width };
    shader.vertexShader = "varying vec2 roadWearPosition;uniform vec2 roadWearMetres;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nroadWearPosition=uv*roadWearMetres;");
    shader.fragmentShader = `varying vec2 roadWearPosition;uniform float roadWearWidth;
      float roadWearNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
    ` + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec2 wearP=roadWearPosition;float wearSide=abs(wearP.x-roadWearWidth*.5);
      float wearMacro=roadWearNoise(wearP*vec2(.32,.07));
      float wearEdge=smoothstep(roadWearWidth*.5-.50,roadWearWidth*.5,wearSide);
      float wheelPolish=exp(-pow((wearSide-1.05)/.30,2.))*(.65+.35*wearMacro);
      diffuseColor.rgb*=mix(.94,1.025,wearMacro)*(1.-wearEdge*.12)*(1.+wheelPolish*.018);
    `).replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-wheelPolish*.075+wearEdge*.035,.76,1.);");
  };
  material.customProgramCacheKey = () => key + ":metre-scale-dry-wear-v1";
  material.needsUpdate = true;
}

// 叶片面仍参与真实 PBR 与原有阴影；只把卡片法线部分朝向树冠外侧，消除整片叶子硬切亮暗。
export function softenCanopyNormals(geometry: BufferGeometry, center: Vector3) {
  const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
  const outward = new Vector3(), card = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    outward.fromBufferAttribute(positions, i).sub(center); outward.y *= .75;
    card.fromBufferAttribute(normals, i);
    if (outward.lengthSq() < .000001) continue;
    outward.normalize(); if (card.dot(outward) < 0) card.negate();
    card.lerp(outward, .68).normalize(); normals.setXYZ(i, card.x, card.y, card.z);
  }
  normals.needsUpdate = true;
}

// 保持九叶草簇的预算和固定种子；叶片沿不同方向弯曲，根部局部 Y 坐标统一为 -.5。
export function groundGrassGeometry(random: () => number) {
  const p: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let b = 0; b < 9; b++) {
    const angle = b * 2.4, radius = .5 + random() * .8, height = .55 + random() * .7;
    const width = .10 + random() * .12, bend = (random() - .5) * 1.1;
    const dx = Math.cos(angle) * radius, dz = Math.sin(angle) * .055, sideX = Math.cos(angle + .6), sideZ = Math.sin(angle + .6) * .12;
    const n = p.length / 3;
    p.push(dx-sideX*width,-.5,dz-sideZ*width, dx+sideX*width,-.5,dz+sideZ*width,
      dx+bend*.35-sideX*width*.5,-.5+height*.58,dz+.025-sideZ*width*.5,
      dx+bend*.35+sideX*width*.5,-.5+height*.58,dz+.025+sideZ*width*.5,
      dx+bend,-.5+height,dz+.025+Math.cos(angle)*.055);
    uv.push(0,0,1,0,0,.58,1,.58,.5,1); indices.push(n,n+1,n+2,n+1,n+3,n+2,n+2,n+3,n+4);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(p, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
