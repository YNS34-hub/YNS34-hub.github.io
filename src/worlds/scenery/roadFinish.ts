import {MeshStandardMaterial,ShaderChunk,type Texture} from "three";
import {applyRoadWear} from "../surfaceDetail";

// 每条路线只拥有材质；地图与法线的解码纹理继续由原资产 hook 持有。
// UV 换算采用既有道路的真实米制比例，不改变路宽、采样或骑行碰撞。
export function dryRoadMaterial(map:Texture,normalMap:Texture,metres:[number,number],width:number){
  if(!metres.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(width)||width<=0)throw new RangeError("Invalid road material scale");
  const m=new MeshStandardMaterial({map,normalMap,color:"#adb0ab",roughness:.94});
  m.normalScale.set(.20,.20);applyRoadWear(m,metres,width);
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    shader.fragmentShader=`
      float pavementHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    `+shader.fragmentShader.replace("#include <map_fragment>",`
      vec2 roadM=roadWearPosition;
      float roadDistance=length(vViewPosition);
      float roadNear=1.-smoothstep(20.,30.,roadDistance),roadMiddle=1.-smoothstep(100.,150.,roadDistance);
      // 两处不含主裂缝的实拍裁窗保持集料与法线一致，避免把同一条大裂缝每五米复制一次。
      // 裁窗的实体尺度约半米；所有年龄层沿米制路线固定，回头与分区交界不重新随机。
      vec2 roadAggregateUv=fract(roadM/vec2(.50,.55))*vec2(.25,.275)+vec2(.28,.32);
      vec2 roadAggregateUvB=fract((roadM+vec2(.137,.277))/vec2(.46,.52))*vec2(.23,.26)+vec2(.29,.63);
      vec3 aggregate=vec3(.195);
      if(roadDistance<150.){
        vec3 photo=mix(texture2D(map,roadAggregateUv).rgb,texture2D(map,roadAggregateUvB).rgb,.42);
        float grey=dot(photo,vec3(.2126,.7152,.0722));
        aggregate=mix(aggregate,mix(photo,vec3(grey)*vec3(1.01,1.,.98),.94),roadMiddle);
      }
      float roadBroad=roadWearNoise(roadM*vec2(.17,.028)+vec2(9.,17.));
      // 稀疏小型养护补片：每个 3.2×31 米带只有有限机会出现，尺寸和中心固定，不形成规则棋盘。
      vec2 repairCell=floor(roadM/vec2(3.2,31.)),repairLocal=mod(roadM,vec2(3.2,31.));
      float repairSeed=pavementHash(repairCell+17.);
      vec2 repairCentre=vec2(1.15+pavementHash(repairCell+31.)*.85,5.+pavementHash(repairCell+53.)*20.);
      vec2 repairHalf=vec2(.35+pavementHash(repairCell+7.)*.32,.9+pavementHash(repairCell+23.)*1.3);
      vec2 repairDelta=abs(repairLocal-repairCentre)-repairHalf;
      float repairSdf=max(repairDelta.x,repairDelta.y)+(roadWearNoise(roadM*7.)-.5)*.024;
      float repairAA=max(.007,fwidth(repairSdf)),repairMask=(1.-smoothstep(-repairAA,repairAA,repairSdf))*step(.73,repairSeed)*roadMiddle;
      float repairRim=(1.-smoothstep(.006,.025,abs(repairSdf)))*step(.73,repairSeed)*roadNear;
      // 仅近场保留 3–8 毫米细裂缝；像素足迹变大时消失，避免远处闪烁和夸大的黑色沟槽。
      float crackRow=floor(roadM.y/23.),crackSeed=pavementHash(vec2(crackRow,83.)),crackD=mod(roadM.y,23.);
      float crackCentre=1.1+pavementHash(vec2(crackRow,19.))*4.2;
      float crackPath=roadM.x-crackCentre+sin(crackD*2.1+crackSeed*9.)*.018+sin(crackD*8.2)*.004;
      float crackWidth=.003+crackSeed*.005,crackAA=max(.001,fwidth(crackPath));
      float roadCrack=(1.-smoothstep(crackWidth,crackWidth+crackAA,abs(crackPath)))*
        (1.-smoothstep(.7,2.2,abs(crackD-(5.+crackSeed*13.))))*step(.67,crackSeed)*roadNear*
        (1.-smoothstep(.009,.035,crackAA));
      diffuseColor.rgb*=aggregate*(.93+.11*roadBroad)*mix(1.,.87,repairMask)*(1.-roadCrack*.32);
    `).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+(roadBroad-.5)*.045-repairMask*.035,.82,1.);
    `).replace("#include <aomap_fragment>",`#include <aomap_fragment>
      // 浅裂隙只压低少量间接光；不把整条道路当作 AO 黑带。
      reflectedLight.indirectDiffuse*=1.-roadCrack*.16-repairRim*.05;
    `).replace("#include <normal_fragment_maps>",`
      if(roadNear>0.){
        ${ShaderChunk.normal_fragment_maps.replaceAll("texture2D( normalMap, vNormalMapUv )","mix(texture2D(normalMap,roadAggregateUv),texture2D(normalMap,roadAggregateUvB),.42)").replace("mapN.xy *= normalScale;","mapN.xy *= normalScale*roadNear;")}
      }
    `);
  };
  m.customProgramCacheKey=()=>key+":layered-dry-pavement-v2";return m;
}

// 原有边线的几何与导航语义不变；用沿程磨损降低新漆般的连续亮度。
const painted=new WeakSet<MeshStandardMaterial>();
export function weatheredEdgePaint(m:MeshStandardMaterial,metres:[number,number]){
  if(painted.has(m))return;painted.add(m);
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    shader.vertexShader="varying vec2 edgeMetres;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>\nedgeMetres=uv*vec2(${metres[0].toFixed(3)},${metres[1].toFixed(3)});`);
    shader.fragmentShader=`varying vec2 edgeMetres;
      float paintHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
    `+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      float paintAge=paintHash(vec2(floor(edgeMetres.y/6.),29.));
      float paintNear=1.-smoothstep(30.,150.,length(vViewPosition));
      float paintEdge=min(edgeMetres.x,${metres[0]===3?".11":".10"}-edgeMetres.x);
      float paintChip=.001+paintHash(vec2(floor(mod(edgeMetres.y,16.)*14.),71.))*.003;
      float paintCoverage=smoothstep(paintChip-fwidth(paintEdge),paintChip+fwidth(paintEdge)+.001,paintEdge);
      // 高频颗粒先约束到局部米制窗口，避免十公里路线上的大数 sin 精度把漆线整片抹掉。
      float paintPore=step(.02,paintHash(floor(vec2(edgeMetres.x*360.,mod(edgeMetres.y,16.)*150.))));
      diffuseColor.a*=mix(1.,paintCoverage*paintPore,paintNear);
      diffuseColor.rgb*=.61+.18*paintAge;
    `);
  // 两条路线的 UV 比例与线宽不同，不能共用嵌入常量不同的编译程序。
  };m.customProgramCacheKey=()=>key+":porous-aged-edge-v3:"+metres.join(",");m.alphaTest=.3;m.alphaToCoverage=true;m.needsUpdate=true;
}
