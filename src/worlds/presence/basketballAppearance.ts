import { Mesh, MeshStandardMaterial, type Material, type Object3D } from "three";
import { outfits, type OutfitId } from "./appearance";

export type BasketballAppearanceOptions = { outfitId: OutfitId; personalHead?: boolean };

// 米制织纹只有在像素足够密时显现；距离较远时回到平均值，避免球衣闪烁。
const surfaceFunctions = /* glsl */ `
  varying vec3 vBasketballRest;
  uniform float basketballStyle, basketballPersonalHead;
  float basketballLine(float distanceToLine, float width) {
    float aa = max(fwidth(distanceToLine), .00025);
    return 1. - smoothstep(width-aa, width+aa, abs(distanceToLine));
  }
  float basketballDetailVisibility(vec3 p) {
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    return 1. - smoothstep(.0025, .009, footprint);
  }
`;

function decorateMaterial(source: MeshStandardMaterial, options: BasketballAppearanceOptions) {
  const material = source.clone(), head = /head/.test(source.name);
  const previousCompile = source.onBeforeCompile, previousKey = source.customProgramCacheKey;
  const style = outfits[options.outfitId].style;
  const styleNumber = style === "training" ? 1 : style === "denim" ? 2 : style === "urban" ? 3 : 0;
  // 材质副本沿用已授权贴图和换装 shader；不创建 / 读取脸图，也不销毁共享贴图。
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    shader.uniforms.basketballStyle = { value: styleNumber };
    shader.uniforms.basketballPersonalHead = { value: Number(options.personalHead === true) };
    shader.vertexShader = "varying vec3 vBasketballRest;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvBasketballRest = position * .01;");
    shader.fragmentShader = surfaceFunctions + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `#include <alphamap_fragment>
      float basketballFabric = 0., basketballSkin = 0., basketballShoe = 0., basketballHairSurface = 0., basketballEye = 0.;
      float basketballWeave = 0., basketballSeam = 0., basketballDetail = 0.;
      #ifdef USE_MAP
        vec3 basketballAtlas = texture2D(map, vMapUv).rgb;
        ${head ? `
          float basketballLum = dot(basketballAtlas, vec3(.2126,.7152,.0722));
          bool basketballHair = vMapUv.y < .70 && basketballLum < .085;
          bool basketballFace = basketballAtlas.r > basketballAtlas.b * 1.15;
          basketballHairSurface = float(basketballHair);
          basketballSkin = float(basketballFace && !basketballHair);
          basketballEye = float(vMapUv.y>.80 && !basketballHair && !basketballFace);
          vec3 basketballChroma = clamp(basketballAtlas/max(basketballLum,.02),vec3(.65),vec3(1.4));
          diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*mix(vec3(1.),basketballChroma,.35),basketballSkin);
          diffuseColor.rgb = mix(diffuseColor.rgb,basketballAtlas,basketballPersonalHead);
        ` : `
          bool basketballJersey = basketballAtlas.b > basketballAtlas.r*1.18 && basketballAtlas.b > basketballAtlas.g*1.10;
          bool basketballShorts = (vMapUv.x < .31 || vMapUv.x > .69) && vMapUv.y < .194;
          bool basketballTorso = abs(vBasketballRest.x)<.25 && vBasketballRest.z>.98 && vBasketballRest.z<1.56;
          bool basketballBareTorso = false;
          bool basketballLongLeg = basketballStyle>=2. && vBasketballRest.z>.17 && vBasketballRest.z<.90;
          bool basketballSleeve = basketballStyle==3. && vAthleteSleeve>.04;
          basketballShoe = float(vBasketballRest.z < .165);
          basketballFabric = float(((basketballJersey && !basketballBareTorso) || basketballShorts || basketballLongLeg || basketballSleeve) && basketballShoe<.5);
          basketballSkin = float((basketballAtlas.r > basketballAtlas.b*1.12 && basketballAtlas.r > basketballAtlas.g*1.04 || basketballBareTorso) && basketballFabric<.5 && basketballShoe<.5);
          basketballDetail = basketballDetailVisibility(vBasketballRest);
          // 3.5 毫米针织方向与平滑低频起伏，保留原贴图中的衣褶。
          vec2 basketballThread = vBasketballRest.xz * 1795.1958;
          basketballWeave = (.6*sin(basketballThread.x)*sin(basketballThread.y) + .4*sin(basketballThread.x*.5+basketballThread.y)) * basketballDetail;
          float basketballHem = max(basketballLine(vBasketballRest.z-1.005,.0021),basketballLine(vBasketballRest.z-.525,.0021));
          float basketballSide = basketballLine(abs(vBasketballRest.x)-.187,.0018) * smoothstep(.98,1.02,vBasketballRest.z) * (1.-smoothstep(1.40,1.50,vBasketballRest.z));
          float basketballStitch = .65+.35*sin(vBasketballRest.z*1256.637)*basketballDetail;
          basketballSeam = max(basketballHem,basketballSide)*basketballStitch;
          diffuseColor.rgb *= 1. + basketballFabric*(basketballWeave*.038-basketballSeam*.12);
          // 鞋面保持原鞋带 / 面板图，只加低幅度鞋底刻纹与缝线阴影。
          float basketballSole = basketballLine(vBasketballRest.z-.055,.004);
          float basketballSoleGroove = (.5+.5*sin(vBasketballRest.y*610.)) * basketballSole;
          diffuseColor.rgb *= 1.-basketballShoe*basketballSoleGroove*.075*basketballDetail;
        `}
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      // 织物漫反射、橡胶鞋底与皮肤分别响应灯光；皮肤不使用塑料般镜面。
      roughnessFactor = mix(roughnessFactor, clamp(.86 + basketballWeave*.035 + basketballSeam*.025,.79,.94), basketballFabric);
      roughnessFactor = mix(roughnessFactor, .72, basketballShoe);
      roughnessFactor = mix(roughnessFactor, .83, basketballHairSurface);
      float basketballSkinRoughness = mix(.52,.57,basketballPersonalHead) + .018*sin(vBasketballRest.z*17.)*sin(vBasketballRest.x*13.);
      roughnessFactor = mix(roughnessFactor,clamp(basketballSkinRoughness,.49,.60),basketballSkin);
      roughnessFactor = mix(roughnessFactor,.16,basketballEye);`);
    if (!head) shader.fragmentShader = shader.fragmentShader.replace("#include <clearcoat_normal_fragment_begin>", `
      // 微量表面高度的屏幕导数，跟随蒙皮后的曲面；不修改原法线贴图和人脸。
      float basketballHeight = basketballFabric*basketballWeave*.000065;
      // Filter pores in bind space, below the cloth and shoe masks.
      float basketballPores = sin(vBasketballRest.x*12391.)*sin(vBasketballRest.z*14207.)*basketballDetail;
      basketballHeight += basketballSkin*basketballPores*.000014;
      vec3 basketballDx = dFdx(-vViewPosition), basketballDy = dFdy(-vViewPosition);
      vec3 basketballR1 = cross(basketballDy,normal), basketballR2 = cross(normal,basketballDx);
      float basketballDet = dot(basketballDx,basketballR1);
      if(abs(basketballDet) > 1.e-10) {
        vec3 basketballGrad = sign(basketballDet)*(dFdx(basketballHeight)*basketballR1+dFdy(basketballHeight)*basketballR2);
        normal = normalize(abs(basketballDet)*normal-basketballGrad*faceDirection);
      }
      #include <clearcoat_normal_fragment_begin>`);
  };
  material.customProgramCacheKey = () => previousKey.call(source) + "|basketball-surface-v2|" + Number(head);
  material.needsUpdate = true;
  return material;
}

/** Install after dressAthlete on a basketball clone, before attaching outline shells. */
export function installBasketballAppearance(object: Object3D, options: BasketballAppearanceOptions) {
  const owned = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  const bindings: { mesh: Mesh; original: Material | Material[]; decorated: Material | Material[] }[] = [];
  object.traverse(child => {
    if (!(child instanceof Mesh) || child.name.startsWith("rider-outline:")) return;
    const original = child.material;
    const decorate = (value: Material) => {
      if (!(value instanceof MeshStandardMaterial) || !/^m026_(body|head)$/.test(value.name)) return value;
      let own = owned.get(value);
      if (!own) { own = decorateMaterial(value, options); owned.set(value, own); }
      return own;
    };
    const decorated = Array.isArray(original) ? original.map(decorate) : decorate(original);
    if (decorated === original || Array.isArray(original) && Array.isArray(decorated) && decorated.every((value,index) => value === original[index])) return;
    child.material = decorated;
    bindings.push({ mesh: child, original, decorated });
  });
  let released = false;
  return {
    materialCount: owned.size,
    activate() {
      if (!released) return;
      released = false;
      for (const { mesh, original, decorated } of bindings) if (mesh.material === original) mesh.material = decorated;
      for (const material of owned.values()) material.needsUpdate = true;
    },
    dispose() {
      if (released) return;
      released = true;
      for (const { mesh, original, decorated } of bindings) if (mesh.material === decorated) mesh.material = original;
      for (const material of owned.values()) material.dispose();
    },
  };
}
