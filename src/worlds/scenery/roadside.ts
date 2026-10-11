import {BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,ShaderChunk,Vector3,type Texture} from "three";
import type {RideMap} from "../road/mapTypes";
import type {Instance} from "../Instances";
import {terrainSampler} from "./ecology";

export interface RoadsideSite{
  kind:"forest"|"alpine";
  sample:RideMap["sample"];ground:RideMap["ground"];
  nearest:(x:number,z:number)=>number;blocked?:(x:number,z:number)=>boolean;
}
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const noise=(d:number)=>{const i=Math.floor(d),f=d-i,t=f*f*(3-2*f);return hash(i)*(1-t)+hash(i+1)*t;};

// 只生成原 6.4 米公路外侧的薄路肩；不改变骑行网格、地形高度或碰撞。
// 固定沿程场在分区边界取同值，外缘接实际渲染地面，停靠台与邻近回头弯留出空间。
export function createShoulders(start:number,end:number,site:RoadsideSite){
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new RangeError("Invalid roadside span");
  const p:number[]=[],uv:number[]=[],edge:number[]=[],indices:number[]=[],point=new Vector3(),tangent=new Vector3(),n=Math.ceil((end-start)/2);
  for(const side of [-1,1]){
    const base=p.length/3,safe:boolean[]=[];
    for(let i=0;i<=n;i++){
      const d=start+(end-start)*i/n;site.sample(d,point,tangent);
      if(d<0)point.addScaledVector(tangent,d);
      const norm=Math.hypot(tangent.x,tangent.z),nx=-tangent.z/norm,nz=tangent.x/norm;
      const width=(site.kind==="forest"?.62:.48)+noise(d/7+side*31)*(site.kind==="forest"?.48:.30);
      const offsets=[3.16,3.35,3.2+width];
      for(let j=0;j<3;j++){
        const a=offsets[j]*side,x=point.x+nx*a,z=point.z+nz*a,y=j===0?point.y+.004:j===1?point.y-.014:site.ground(x,z)+.014;
        p.push(x,y,z);uv.push(offsets[j]-3.16,d);edge.push(j===0?0:j===1?.22:1);
        safe.push(!site.blocked?.(x,z)&&site.nearest(x,z)>3.10);
      }
      if(i===0)continue;
      for(let j=0;j<2;j++){
        const a=(i-1)*3+j,b=a+1,c=i*3+j,e=c+1;
        if(![a,b,c,e].every(k=>safe[k]))continue;
        if(side<0)indices.push(base+a,base+c,base+b,base+b,base+c,base+e);
        else indices.push(base+a,base+b,base+c,base+b,base+e,base+c);
      }
    }
  }
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(p,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setAttribute("shoulderEdge",new Float32BufferAttribute(edge,1));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

// 只补碎路肩外侧的稀疏低草，沿原草模板批次绘制；根部取新路肩的三角面，不浮在土壤上。
export function createVergeGrass(start:number,end:number,site:RoadsideSite,shoulder:BufferGeometry){
  const groups:Instance[][]=[[],[],[]],ground=terrainSampler(shoulder,site.ground),p=new Vector3(),t=new Vector3();
  for(let d=Math.ceil(start/9)*9+3;d<end;d+=9)for(const side of[-1,1]){
    const seed=hash(d+side*93);if(seed<.46)continue;
    site.sample(d,p,t);const norm=Math.hypot(t.x,t.z),off=side*(3.51+seed*.42),x=p.x-t.z/norm*off,z=p.z+t.x/norm*off;
    if(site.nearest(x,z)<3.4||site.blocked?.(x,z))continue;
    groups[Math.floor(seed*19)%3].push({position:[x,ground(x,z)-.02,z],scale:[.28+seed*.11,.13+seed*.12,.28+seed*.11],rotation:[0,seed*17,0]});
  }return groups;
}

// 共用已公开岩石与土壤照片，只拥有材质；外缘 cutout 与地表相接，不增加透明排序层。
export function shoulderMaterial(map:Texture,normalMap:Texture,soil:Texture){
  const m=new MeshStandardMaterial({map,normalMap,roughness:.99,color:"#b9b29f",alphaTest:.3,alphaToCoverage:true});m.normalScale.set(.20,.20);m.userData.sceneryTextures=[soil];
  m.onBeforeCompile=shader=>{
    shader.uniforms.shoulderSoil={value:soil};
    shader.vertexShader="attribute float shoulderEdge;varying float roadsideEdge;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nroadsideEdge=shoulderEdge;");
    shader.fragmentShader=`varying float roadsideEdge;uniform sampler2D shoulderSoil;
      float vergeNoise(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
    `+shader.fragmentShader.replace("#include <map_fragment>",`
      vec2 vergeUv=vMapUv/vec2(.46,.53);
      vec3 gravel=texture2D(map,vergeUv).rgb,soil=texture2D(shoulderSoil,vMapUv/4.).rgb;
      float gravelGrey=dot(gravel,vec3(.2126,.7152,.0722)),soilGrey=dot(soil,vec3(.2126,.7152,.0722));
      gravel=mix(gravel,vec3(gravelGrey)*vec3(1.03,1.,.91),.70);
      soil=mix(soil,vec3(soilGrey)*vec3(.96,.91,.77),.80);
      diffuseColor.rgb*=mix(gravel*.88,soil,smoothstep(.30,.94,roadsideEdge)*.78);
      float edgeNoise=vergeNoise(floor(vec2(vMapUv.x*23.,mod(vMapUv.y,29.)*13.)));
      diffuseColor.a*=1.-smoothstep(.78+edgeNoise*.11,1.,roadsideEdge);
    `).replace("#include <normal_fragment_maps>",`if(length(vViewPosition)<30.){
      ${ShaderChunk.normal_fragment_maps.replaceAll("vNormalMapUv","vNormalMapUv/vec2(.46,.53)")}
    }`);
  };m.customProgramCacheKey=()=>"metre-grounded-gravel-shoulder-v1";return m;
}
