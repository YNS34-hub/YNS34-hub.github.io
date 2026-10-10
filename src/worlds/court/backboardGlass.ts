import { MeshPhysicalMaterial } from "three";

// 平直的 55mm 篮板采用两界面的 Fresnel 近似；反射来自既有 IBL 和真实灯，不重新渲染整座公园。
// 保留边框、厚度和实际视角透过率；中庭厚玻璃及其折射实现不受影响。
export function makeBackboardGlass() {
  const material = new MeshPhysicalMaterial({ color: "#000000", roughness: .045, metalness: 0, ior: 1.48,
    transparent: true, depthWrite: false, emissive: "#e8c597", emissiveIntensity: 0 });
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      float facing=clamp(dot(normal,normalize(vViewPosition)),0.,1.);
      float surfaceF=.03746+.96254*pow(1.-facing,5.);
      float paneF=clamp(2.*surfaceF/(1.+surfaceF),.072,1.);
      // 双界面增加反射，透射背景按视角守恒混合；不使用固定的低 opacity 冒充玻璃。
      gl_FragColor=vec4(outgoingLight*(2./(1.+surfaceF))/max(paneF,.001),paneF);
    `);
  };
  material.customProgramCacheKey = () => "park-flat-pane-fresnel-v1";
  return material;
}
