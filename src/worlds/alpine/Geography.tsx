import {useEffect,useMemo} from "react";
import {MeshStandardMaterial,Vector2,Vector4} from "three";
import {usePalaceStore} from "../../systems/store";
import {useAlpineGeography,useAlpineHeightfield,useAlpineTextures} from "./assets";
import {buildAlpineTerrain} from "./terrainMesh";
import {atlasProjection} from "./projection";

type Maps=ReturnType<typeof useAlpineTextures>;
export default function Geography({maps}:{maps:Maps}){
  const field=useAlpineHeightfield(),meta=useAlpineGeography(),quality=usePalaceStore(s=>s.effectiveQuality);
  const geometries=useMemo(()=>buildAlpineTerrain(field,quality),[field,quality]);
  const material=useMemo(()=>{
    const m=new MeshStandardMaterial({map:maps.meadow,roughness:.97,normalMap:maps.meadowNormal,normalScale:new Vector2(.45,.45)});
    // 只读诊断可统计自定义采样器；这些纹理由当前地图资产 hook 统一持有。
    m.userData.alpineTextures=[maps.rock,maps.rockNormal,maps.imagery,maps.nearImagery];
    const image=atlasProjection(meta.imagery),nearImage=atlasProjection(meta.nearImagery);
    m.onBeforeCompile=shader=>{
      shader.uniforms.alpineRock={value:maps.rock};shader.uniforms.alpineRockNormal={value:maps.rockNormal};shader.uniforms.alpineAerial={value:maps.imagery};
      shader.uniforms.alpineNearAerial={value:maps.nearImagery};
      shader.uniforms.alpineAtlas={value:new Vector4(...image.origin,image.x,image.z)};
      shader.uniforms.alpineNearAtlas={value:new Vector4(...nearImage.origin,nearImage.x,nearImage.z)};
      shader.uniforms.alpineProjectionCurve={value:new Vector4(image.quadratic,image.cubic,nearImage.quadratic,nearImage.cubic)};
      shader.vertexShader="varying vec3 alpinePosition;varying vec3 alpineNormal;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nalpinePosition=(modelMatrix*vec4(position,1.)).xyz;alpineNormal=normalize(mat3(modelMatrix)*normal);");
      shader.fragmentShader=`
        varying vec3 alpinePosition;varying vec3 alpineNormal;
        uniform sampler2D alpineRock;uniform sampler2D alpineRockNormal;uniform sampler2D alpineAerial;uniform sampler2D alpineNearAerial;
        uniform vec4 alpineAtlas;uniform vec4 alpineNearAtlas;uniform vec4 alpineProjectionCurve;
        vec2 alpineUV(vec4 atlas,vec2 curve,vec3 p){vec2 uv=atlas.xy+vec2(p.x*atlas.z,p.z*atlas.w+p.z*p.z*curve.x+p.z*p.z*p.z*curve.y);uv.y=1.-uv.y;return uv;}
        float alpineNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+vec2(1.,1.),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
        vec3 alpineTri(sampler2D tex,vec3 w,vec3 weights,float scale){return texture2D(tex,w.yz/scale).rgb*weights.x+texture2D(tex,w.xz/scale).rgb*weights.y+texture2D(tex,w.xy/scale).rgb*weights.z;}
      `+shader.fragmentShader.replace("#include <map_fragment>",`
        vec3 aw=alpinePosition,an=normalize(alpineNormal),weights=pow(abs(an),vec3(4.));weights/=max(.001,weights.x+weights.y+weights.z);
        float eyeDistance=distance(cameraPosition,aw),macro=alpineNoise(aw.xz*.010),steep=1.-abs(an.y);
        vec2 grassUV=aw.xz/3.5;
        vec3 grass=mix(texture2D(map,grassUV).rgb,texture2D(map,mat2(.8,-.6,.6,.8)*grassUV*.93+vec2(.31,.73)).rgb,macro)*vec3(.48,.83,.36);
        vec3 rock=alpineTri(alpineRock,aw,weights,2.8);
        float rockMask=smoothstep(.28,.62,steep+(alpineNoise(aw.xz*.027)-.5)*.10);
        vec2 aerialUV=alpineUV(alpineAtlas,alpineProjectionCurve.xy,aw),nearUV=alpineUV(alpineNearAtlas,alpineProjectionCurve.zw,aw);
        vec3 aerial=texture2D(alpineAerial,aerialUV).rgb;
        float edge=min(min(nearUV.x,nearUV.y),min(1.-nearUV.x,1.-nearUV.y));
        float fineCoverage=smoothstep(.015,.055,edge)*(1.-smoothstep(220.,900.,eyeDistance));
        aerial=mix(aerial,texture2D(alpineNearAerial,nearUV).rgb,fineCoverage);
        // 航拍决定远景地貌；近处保留毫米级材质。少量去除照片中的暗影，避免把烘焙阴影再照黑一次。
        aerial=mix(aerial,pow(max(aerial,vec3(.001)),vec3(.85)),.14);
        float saturation=(max(max(aerial.r,aerial.g),aerial.b)-min(min(aerial.r,aerial.g),aerial.b))/max(.001,max(max(aerial.r,aerial.g),aerial.b));
        float vegetation=smoothstep(.010,.070,aerial.g-aerial.b-max(0.,aerial.r-aerial.g)*2.)*smoothstep(.12,.30,saturation)*(1.-rockMask);
        aerial*=mix(vec3(.62),vec3(.33,.62,.22),vegetation);
        vec3 surface=mix(grass,rock,rockMask);
        float aerialWeight=mix(.28,.94,smoothstep(20.,240.,eyeDistance));
        surface=mix(surface,aerial,aerialWeight);
        diffuseColor.rgb*=surface;
      `).replace("#include <normal_fragment_maps>",`
        // 岩壁使用世界坐标三平面法线；草地法线只参与上表面，不再把草纹投到直立岩壁上。
        float normalStrength=.18+(1.-smoothstep(160.,700.,eyeDistance))*.42;
        vec3 tx=texture2D(alpineRockNormal,aw.yz/2.8).xyz*2.-1.,ty=texture2D(alpineRockNormal,aw.xz/2.8).xyz*2.-1.,tz=texture2D(alpineRockNormal,aw.xy/2.8).xyz*2.-1.;
        vec3 rockDetail=vec3(0.,tx.x,tx.y)*weights.x+vec3(ty.x,0.,ty.y)*weights.y+vec3(tz.x,tz.y,0.)*weights.z;
        vec3 grassDetail=texture2D(normalMap,grassUV).xyz*2.-1.;
        vec3 detail=mix(vec3(grassDetail.x,0.,grassDetail.y)*.40,rockDetail,rockMask);
        normal=normalize((viewMatrix*vec4(normalize(an+detail*normalStrength),0.)).xyz);
      `);
    };
    m.customProgramCacheKey=()=>"alpine-measured-ortho-triplanar-v2";return m;
  },[maps,meta]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);useEffect(()=>()=>material.dispose(),[material]);
  return <group name="real-elevation-alpine-massif">{geometries.map(g=><mesh key={g.name} name={"alpine-terrain-tile:"+g.name} geometry={g} material={material} castShadow receiveShadow dispose={null}/>)}</group>;
}
