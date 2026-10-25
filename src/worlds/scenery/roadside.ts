import {Box3,BoxGeometry,BufferGeometry,Color,Float32BufferAttribute,MeshStandardMaterial,ShaderChunk,Sphere,Vector3,type Texture} from "three";
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

// 小石沿固定八米带成簇，排水口约每 252 米一个；所有角点避开车道、停靠台与其他弯道。
// 取真实路肩三角面，钢条与框体顺坡接地；只在建立分区时生成，不参与骑行碰撞或更新。
export function createRoadsideDetails(start:number,end:number,site:RoadsideSite,shoulder:BufferGeometry){
  const stones:Instance[]=[],ground=terrainSampler(shoulder,site.ground),p=new Vector3(),t=new Vector3(),bounds=new Box3();
  for(let d=Math.ceil((start-5)/8)*8+5;d<end;d+=8)for(const side of[-1,1]){
    const seed=hash(d+side*73);if(seed<.52)continue;
    site.sample(d,p,t);const norm=Math.hypot(t.x,t.z),nx=-t.z/norm,nz=t.x/norm;
    for(let k=0;k<2;k++){
      const s=hash(d+k*29+side*5),off=side*(3.42+s*.25),along=(s-.5)*.7;
      const x=p.x+nx*off+t.x/norm*along,z=p.z+nz*off+t.z/norm*along,size=.038+s*.082;
      if(site.nearest(x,z)<3.38||site.blocked?.(x,z))continue;
      const height=size*(.32+s*.22);stones.push({position:[x,ground(x,z)-height*.15,z],scale:[size*1.15,height,size],rotation:[0,s*17,0]});bounds.expandByPoint(new Vector3(x,ground(x,z),z));
    }
  }
  const positions:number[]=[],colours:number[]=[],unit=new BoxGeometry(1,1,1).toNonIndexed(),vertex=unit.getAttribute("position");let drainCount=0;
  for(let cell=Math.ceil((start-83)/252),d=83+cell*252;d<end;d+=252,cell++){
    site.sample(d,p,t);const norm=Math.hypot(t.x,t.z),nx=-t.z/norm,nz=t.x/norm,tx=t.x/norm,tz=t.z/norm,side=cell%3===0?-1:1;
    const x=p.x+nx*side*3.55,z=p.z+nz*side*3.55;
    const corners=[[-.18,-.35],[.18,-.35],[-.18,.35],[.18,.35]].map(([u,v])=>[x+nx*u+tx*v,z+nz*u+tz*v]);
    if(corners.some(([x,z])=>site.nearest(x,z)<3.3||site.blocked?.(x,z)))continue;
    const heights=corners.map(([x,z])=>ground(x,z));if(Math.max(...heights)-Math.min(...heights)>.16)continue;
    const box=(cx:number,cz:number,w:number,h:number,l:number,lift:number,colour:string)=>{
      const c=new Color(colour);
      for(let i=0;i<vertex.count;i++){
        const u=cx+vertex.getX(i)*w,v=cz+vertex.getZ(i)*l,wx=x+nx*u+tx*v,wz=z+nz*u+tz*v;
        positions.push(wx,ground(wx,wz)+lift+vertex.getY(i)*h,wz);colours.push(c.r,c.g,c.b);
      }
    };
    box(0,0,.34,.006,.64,.003,"#292d2b");
    for(const s of[-1,1]){box(s*.16,0,.038,.018,.69,.009,"#807e71");box(0,s*.325,.36,.018,.04,.009,"#807e71");}
    for(let k=0;k<9;k++)box(0,-.28+k*.07,.275,.018,.025,.012,k%3===0?"#68716e":"#7e8580");
    drainCount++;
  }
  unit.dispose();const drains=new BufferGeometry();drains.setAttribute("position",new Float32BufferAttribute(positions,3));drains.setAttribute("color",new Float32BufferAttribute(colours,3));drains.setIndex(Array.from({length:positions.length/3},(_,i)=>i));drains.computeVertexNormals();drains.computeBoundingBox();
  if(positions.length)bounds.union(drains.boundingBox!);const sphere=bounds.getBoundingSphere(new Sphere());sphere.radius=Math.max(0,sphere.radius)+.5;
  return{stones,drains,drainCount,bounds:sphere};
}

// 细石借用现有扫描网格和纹理，仅拥有材质副本；30 米后收去细节，不增加影子或纹理解码。
export function roadsideDetailMaterials(scan:MeshStandardMaterial){
  const stone=scan.clone(),previous=scan.onBeforeCompile,key=scan.customProgramCacheKey();
  stone.onBeforeCompile=(shader,renderer)=>{previous.call(stone,shader,renderer);shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
    #ifdef USE_INSTANCING
      float stoneDistance=distance(cameraPosition,(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz);
      transformed*=1.-smoothstep(28.,40.,stoneDistance);
    #endif`);};stone.customProgramCacheKey=()=>key+":roadside-near-stone-v1";
  const drain=new MeshStandardMaterial({vertexColors:true,metalness:.22,roughness:.86,alphaTest:.3,alphaToCoverage:true});
  drain.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.a*=1.-smoothstep(30.,45.,length(vViewPosition));");};drain.customProgramCacheKey=()=>"grounded-aged-drain-v1";
  return{stone,drain};
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
      float vergeDistance=length(vViewPosition),vergeMiddle=1.-smoothstep(100.,150.,vergeDistance);
      vec2 vergeUv=vMapUv/vec2(.46,.53);
      // 150 米外仅保留低频路肩色，20–30 米平滑退去集料法线；不新增贴图、RTT 或逐帧状态。
      vec3 gravel=vec3(.24),soil=vec3(.21);
      if(vergeDistance<150.){gravel=mix(gravel,texture2D(map,vergeUv).rgb,vergeMiddle);soil=mix(soil,texture2D(shoulderSoil,vMapUv/4.).rgb,vergeMiddle);}
      float gravelGrey=dot(gravel,vec3(.2126,.7152,.0722)),soilGrey=dot(soil,vec3(.2126,.7152,.0722));
      gravel=mix(gravel,vec3(gravelGrey)*vec3(1.03,1.,.91),.70);
      soil=mix(soil,vec3(soilGrey)*vec3(.96,.91,.77),.80);
      diffuseColor.rgb*=mix(gravel*.88,soil,smoothstep(.30,.94,roadsideEdge)*.78);
      float edgeNoise=vergeNoise(floor(vec2(vMapUv.x*23.,mod(vMapUv.y,29.)*13.)));
      diffuseColor.a*=1.-smoothstep(.78+edgeNoise*.11,1.,roadsideEdge);
    `).replace("#include <normal_fragment_maps>",`float vergeNear=1.-smoothstep(20.,30.,vergeDistance);if(vergeNear>0.){
      ${ShaderChunk.normal_fragment_maps.replaceAll("vNormalMapUv","vNormalMapUv/vec2(.46,.53)").replace("mapN.xy *= normalScale;","mapN.xy *= normalScale*vergeNear;")}
    }`);
  };m.customProgramCacheKey=()=>"metre-grounded-gravel-shoulder-v2";return m;
}
