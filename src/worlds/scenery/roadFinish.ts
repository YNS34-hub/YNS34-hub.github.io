import {MeshStandardMaterial,type Texture} from "three";
import {applyRoadWear} from "../surfaceDetail";

// 每条路线只拥有材质；地图与法线的解码纹理继续由原资产 hook 持有。
// UV 换算采用既有道路的真实米制比例，不改变路宽、采样或骑行碰撞。
export function dryRoadMaterial(map:Texture,normalMap:Texture,metres:[number,number],width:number){
  if(!metres.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(width)||width<=0)throw new RangeError("Invalid road material scale");
  const m=new MeshStandardMaterial({map,normalMap,color:"#adb0ab",roughness:.94});
  m.normalScale.set(.24,.24);applyRoadWear(m,metres,width);
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
      float roadGrey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(roadGrey)*vec3(1.01,1.,.97),.92);
      // 大块色差来自养护与日晒，毫米级集料仍由真实沥青照片和法线提供。
      float roadBroad=roadWearNoise(roadWearPosition*vec2(.13,.028)+vec2(9.,17.));
      diffuseColor.rgb*=.94+.10*roadBroad;
    `);
  };
  m.customProgramCacheKey=()=>key+":neutral-dry-road-v1";return m;
}

// 原有边线的几何与导航语义不变；用沿程磨损降低新漆般的连续亮度。
const painted=new WeakSet<MeshStandardMaterial>();
export function weatheredEdgePaint(m:MeshStandardMaterial,metres:[number,number]){
  if(painted.has(m))return;painted.add(m);
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    shader.vertexShader="varying vec2 edgeMetres;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>\nedgeMetres=uv*vec2(${metres[0].toFixed(3)},${metres[1].toFixed(3)});`);
    shader.fragmentShader="varying vec2 edgeMetres;\n"+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      float paintAge=.5+.5*sin(edgeMetres.y*.17+sin(edgeMetres.y*.041)*2.);
      diffuseColor.rgb*=.69+.19*paintAge;
    `);
  };m.customProgramCacheKey=()=>key+":quiet-aged-edge-v1";m.needsUpdate=true;
}
