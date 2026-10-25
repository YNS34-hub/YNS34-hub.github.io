import {MeshStandardMaterial,ShaderChunk,Vector4,type Texture} from "three";

export interface AlpineSunField {x0:number;z0:number;step:number;width:number;height:number;direction:[number,number,number];rayDistance:number}
const decorated=new WeakSet<MeshStandardMaterial>();
export function alpineSunUV(field:AlpineSunField,x:number,z:number):[number,number]{
  return [(x-field.x0)/((field.width-1)*field.step),1-(z-field.z0)/((field.height-1)*field.step)];
}
// 仅装饰新地图持有的材质副本，保留原有草叶/岩石 shader；不触碰共享 GLTF 源材质。
export function applyAlpineSunlight(material:MeshStandardMaterial,map:Texture,field:AlpineSunField){
  if(decorated.has(material))return;decorated.add(material);
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.userData.alpineSunTexture=map;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.uniforms.alpineSunTexture={value:map};
    shader.uniforms.alpineSunDomain={value:new Vector4(field.x0,field.z0,(field.width-1)*field.step,(field.height-1)*field.step)};
    shader.vertexShader="varying vec3 alpineSunPosition;\n"+shader.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
      vec4 alpineSunWorld=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        alpineSunWorld=instanceMatrix*alpineSunWorld;
      #endif
      alpineSunPosition=(modelMatrix*alpineSunWorld).xyz;
    `);
    shader.fragmentShader=`varying vec3 alpineSunPosition;uniform sampler2D alpineSunTexture;uniform vec4 alpineSunDomain;\n`+shader.fragmentShader.replace("#include <lights_fragment_begin>",
      ShaderChunk.lights_fragment_begin.replace("getDirectionalLightInfo( directionalLight, directLight );",`getDirectionalLightInfo( directionalLight, directLight );
        vec2 alpineSunUV=(alpineSunPosition.xz-alpineSunDomain.xy)/alpineSunDomain.zw;alpineSunUV.y=1.-alpineSunUV.y;
        directLight.color*=mix(.04,1.,texture2D(alpineSunTexture,alpineSunUV).r);
      `));
  };
  material.customProgramCacheKey=()=>key+":alpine-measured-sun-v1";material.needsUpdate=true;
}
