import {MeshStandardMaterial,type Texture} from "three";

type GroundMaps={rock:Texture;rockNormal:Texture;meadow:Texture;meadowNormal:Texture};
// 远景共享四张 1K 实拍材质；近处才采样细法线，不把林叶纹理平铺到整座山上。
export function valleyTerrainMaterial(maps:GroundMaps,mountain=false){
  // 远山保留真实形态与低频地貌颜色，避免毫米照片铺满远景后产生摩尔纹；近处岩石仍使用扫描 PBR。
  if(mountain)return new MeshStandardMaterial({vertexColors:true,color:"#333c37",roughness:1});
  const m=new MeshStandardMaterial({map:maps.meadow,normalMap:maps.meadowNormal,roughness:.98});
  m.userData.sceneryTextures=[maps.rock,maps.rockNormal];
  m.onBeforeCompile=shader=>{
    shader.uniforms.valleyRock={value:maps.rock};shader.uniforms.valleyRockNormal={value:maps.rockNormal};
    shader.vertexShader="varying vec3 valleyPosition;varying vec3 valleyNormal;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvalleyPosition=(modelMatrix*vec4(position,1.)).xyz;valleyNormal=normalize(mat3(modelMatrix)*normal);");
    shader.fragmentShader=`varying vec3 valleyPosition;varying vec3 valleyNormal;
      uniform sampler2D valleyRock;uniform sampler2D valleyRockNormal;
      float valleyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
      vec3 valleyTri(sampler2D tex,vec3 p,vec3 w){return texture2D(tex,p.yz/3.2).rgb*w.x+texture2D(tex,p.xz/3.2).rgb*w.y+texture2D(tex,p.xy/3.2).rgb*w.z;}
      vec3 valleyFar(sampler2D tex,vec3 p,vec3 w){return textureLod(tex,p.yz/3.2,5.).rgb*w.x+textureLod(tex,p.xz/3.2,5.).rgb*w.y+textureLod(tex,p.xy/3.2,5.).rgb*w.z;}
    `+shader.fragmentShader.replace("#include <map_fragment>",`
      vec3 vp=valleyPosition,vn=normalize(valleyNormal),vw=pow(abs(vn),vec3(4.));vw/=max(.001,vw.x+vw.y+vw.z);
      float vd=distance(cameraPosition,vp),vm=valleyNoise(vp.xz*.006),vs=1.-abs(vn.y);
      float stoneMask=${mountain?"max(smoothstep(.045,.20,vs+(valleyNoise(vp.xz*.035)-.5)*.055),smoothstep(65.,145.,vp.y))":"smoothstep(.27,.62,vs+(valleyNoise(vp.xz*.035)-.5)*.12)"};
      vec3 pasture=vec3(.105,.123,.071),stone=vec3(.11,.129,.133);
      // 远景显式使用低频 mip，毫米纹理不能在数百米处变成摩尔纹。
      vec3 broadRock=mix(valleyFar(valleyRock,vp*.55,vw),valleyFar(valleyRock,vec3(vp.z,vp.y,-vp.x)*.43+vec3(17.,31.,53.),vw.zyx),.46);
      float strata=valleyNoise(vec2(vp.x*.029+vp.z*.014,vp.y*.038));
      stone=mix(stone,broadRock*.82,.82)*(.73+.41*strata);
      if(vd<240.){
        vec3 photoGrass=texture2D(map,vp.xz/3.5).rgb,photoStone=valleyTri(valleyRock,vp,vw);
        float greyGrass=dot(photoGrass,vec3(.2126,.7152,.0722));
        photoGrass=mix(photoGrass,vec3(greyGrass)*vec3(1.03,1.,.83),.43);
        pasture=mix(photoGrass*.76,pasture,smoothstep(90.,240.,vd));stone=mix(photoStone*.75,stone,smoothstep(90.,240.,vd));
      }
      vec3 valleySurface=mix(pasture,stone,stoneMask)*(.70+.43*vm);
      diffuseColor.rgb*=valleySurface;
    `).replace("#include <normal_fragment_maps>",`
      normal=normalize((viewMatrix*vec4(vn,0.)).xyz);
      if(vd<85.){
        vec3 tx=texture2D(valleyRockNormal,vp.yz/3.2).xyz*2.-1.,ty=texture2D(valleyRockNormal,vp.xz/3.2).xyz*2.-1.,tz=texture2D(valleyRockNormal,vp.xy/3.2).xyz*2.-1.;
        vec3 rocks=vec3(0.,tx.x,tx.y)*vw.x+vec3(ty.x,0.,ty.y)*vw.y+vec3(tz.x,tz.y,0.)*vw.z,grass=texture2D(normalMap,vp.xz/3.5).xyz*2.-1.;
        vec3 detail=mix(vec3(grass.x,0.,grass.y)*.18,rocks,stoneMask)*.32*(1.-smoothstep(30.,85.,vd));
        normal=normalize((viewMatrix*vec4(normalize(vn+detail),0.)).xyz);
      }
    `);
  };m.customProgramCacheKey=()=>"photographed-valley-earth-v4:"+mountain;return m;
}
