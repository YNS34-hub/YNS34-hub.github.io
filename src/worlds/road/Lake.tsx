import {useEffect,useMemo} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import {Matrix3,Matrix4,ShaderMaterial,UniformsLib,UniformsUtils,Vector3,type Texture} from "three";
import {useQuietMotion} from "../../motion/useMotionCue";
import {forestSkyRotation,forestSun} from "../scenery/lighting";
import {createLakeMesh,createLakeShore} from "./lakeMesh";
import {ScanInstances,type useAlpineScans} from "../alpine/Scans";
import {GrassField,type useAlpineGrass} from "../alpine/Grass";

const vertex=`
  #include <common>
  #include <fog_pars_vertex>
  attribute float waterDepth;varying vec3 waterWorld;varying float lakeDepth;
  void main(){
    waterWorld=(modelMatrix*vec4(position,1.)).xyz;lakeDepth=waterDepth;
    vec4 mvPosition=viewMatrix*vec4(waterWorld,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }`;
const fragment=`
  #include <common>
  #include <fog_pars_fragment>
  uniform float time;uniform sampler2D skyMap;uniform mat3 skyRotation;uniform vec3 sunDirection;
  varying vec3 waterWorld;varying float lakeDepth;
  void main(){
    vec2 p=waterWorld.xz;float warp=sin(p.x*.021+p.y*.014)*1.7;
    // 沿既有时间与减少动态开关推进轻波；非正交波向避免原先的棋盘状交叉亮纹。
    vec3 n=normalize(vec3(sin(p.x*.19+p.y*.08+warp+time*.26)*.008+sin(p.y*.39-p.x*.16-time*.31)*.003,1.,sin(p.x*.11+p.y*.23+warp-time*.19)*.006));
    vec3 v=normalize(cameraPosition-waterWorld),r=reflect(-v,n);
    float fresnel=.0204+.9796*pow(1.-max(0.,dot(n,v)),5.);
    vec3 reflected=texture2D(skyMap,equirectUv(normalize(skyRotation*r))).rgb;
    float luminance=dot(reflected,vec3(.2126,.7152,.0722));reflected=mix(reflected,vec3(luminance)*vec3(.93,1.,1.03),.18)*.50;
    vec3 water=mix(vec3(.041,.062,.043),vec3(.023,.040,.041),1.-exp(-max(0.,lakeDepth)*.65));
    float glint=pow(max(0.,dot(n,normalize(v+sunDirection))),320.);
    vec3 c=mix(water,reflected,fresnel*.82)+vec3(.68,.52,.31)*glint*.12;
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export default function RoadLake({scans,grassTemplates}:{scans:ReturnType<typeof useAlpineScans>;grassTemplates:ReturnType<typeof useAlpineGrass>}){
  const quiet=useQuietMotion(),scene=useThree(s=>s.scene);
  const geometry=useMemo(createLakeMesh,[]);
  const shore=useMemo(()=>createLakeShore(geometry),[geometry]),staticMotion=useMemo(()=>({time:{value:0},wind:{value:0}}),[]);
  const uniforms=useMemo(()=>({...UniformsUtils.clone(UniformsLib.fog),time:{value:0},skyMap:{value:null as Texture|null},skyRotation:{value:new Matrix3().setFromMatrix4(new Matrix4().makeRotationY(-forestSkyRotation))},sunDirection:{value:new Vector3(...forestSun).normalize()}}),[]);
  const material=useMemo(()=>new ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,fog:true}),[uniforms]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame((_,dt)=>{
    if(!quiet)uniforms.time.value+=Math.min(dt,.06);
    // 复用当前天空的同一纹理，不复制 GPU 资源、不创建反射相机；只提供天空反射，绝不声称山体倒影。
    const background=scene.background;
    // 使用 Three 的结构标识，兼容当前 vendor / drei 解码对象跨模块的 Texture 构造器。
    if(background&&"isTexture" in background&&background.isTexture)uniforms.skyMap.value=background as Texture;
  });
  return <group name="grounded-lake-shore">
    <mesh name="long-way-home-lake" geometry={geometry} material={material} raycast={()=>{}} dispose={null}/>
    <ScanInstances scan={scans[0]} items={shore.rocks} shadows={false}/>
    {shore.grass.map((items,i)=><GrassField key={i} template={grassTemplates[i+3]} items={items} {...staticMotion}/>)}
  </group>;
}
