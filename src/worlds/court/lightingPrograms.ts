import { DirectionalLight, HemisphereLight, Scene, SpotLight, type Camera, type Material, type Object3D, type WebGLRenderer } from "three";

// 只提交原球场将要使用的灯光拓扑；临时 Scene 从不加入真实场景或绘制，不分配阴影贴图。
// 骨骼人物也需要昼夜/交接期的 PBR 变体，否则首次移除太阳时会在交互中同步链接程序。
export function prepareCourtLighting(renderer: WebGLRenderer, root: Object3D, camera: Camera, scene: Scene) {
  const target=new Scene(),materials=new Set<Material>(),shadow=renderer.shadowMap.enabled;
  target.environment=scene.environment;target.fog=scene.fog;target.environmentIntensity=scene.environmentIntensity;
  const hemisphere=new HemisphereLight(),sun=new DirectionalLight(),left=new SpotLight(),right=new SpotLight();
  for(const [day,night,dayShadow] of [[true,false,true],[true,true,false],[false,true,false],[true,true,true]]){
    target.clear();target.add(hemisphere);
    if(day){sun.castShadow=shadow&&dayShadow;target.add(sun);}
    if(night){left.castShadow=shadow&&!dayShadow;target.add(left,right);}
    for(const material of renderer.compile(root,camera,target))materials.add(material);
  }
  target.clear();return materials;
}
