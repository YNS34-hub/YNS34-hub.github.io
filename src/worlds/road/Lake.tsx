import {useEffect,useMemo,useRef} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import {Frustum,Matrix3,Matrix4,Mesh,PlaneGeometry,ShaderMaterial,UniformsLib,UniformsUtils,Vector3,type Texture,type BufferGeometry} from "three";
import {Reflector} from 'three/addons/objects/Reflector.js';
import {usePalaceStore} from '../../systems/store';
import {textureStatus} from '../../world/textureCache';
import {ReflectionBudget} from '../../rooms/atrium/budget';
import {captureLakeReflection,lakeReflectionTier,lakeWorldProjection} from './lakeReflection';
import {lake} from './route';
import {useQuietMotion} from "../../motion/useMotionCue";
import {forestSkyRotation,forestSun} from "../scenery/lighting";
import {createLakeMesh,createLakeShore} from "./lakeMesh";
import {ScanInstances,type useAlpineScans} from "../alpine/Scans";
import {GrassField,type useAlpineGrass} from "../alpine/Grass";
import {lakeBankShader} from './lakeShore';

const vertex=`
  #include <common>
  #include <fog_pars_vertex>
  uniform mat4 reflectionProjection;attribute float waterDepth;varying vec3 waterWorld;varying float lakeDepth;varying vec4 reflectionUV;
  void main(){
    waterWorld=(modelMatrix*vec4(position,1.)).xyz;lakeDepth=waterDepth;
    reflectionUV=reflectionProjection*vec4(waterWorld,1.);
    vec4 mvPosition=viewMatrix*vec4(waterWorld,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }`;
const fragment=lakeBankShader+`
  #include <common>
  #include <fog_pars_fragment>
  uniform float time;uniform sampler2D skyMap;uniform sampler2D bedMap;uniform mat3 skyRotation;uniform vec3 sunDirection;
  uniform sampler2D lakeMirror;uniform float mirrorReady;uniform float mirrorTexel;
  varying vec3 waterWorld;varying float lakeDepth;varying vec4 reflectionUV;
  void main(){
    vec2 p=waterWorld.xz;float depth=max(0.,lakeDepth);
    // 保留已验收的浅水静稳和远处细波衰减；水面没有顶点位移。
    float detail=1.-smoothstep(.35,2.6,length(fwidth(p)));
    vec2 ripple=vec2(.73,.37)*sin(dot(p,vec2(.73,.37))-time*.62)*.009
      +vec2(.29,-.91)*sin(dot(p,vec2(.29,-.91))+time*.49)*.006;
    vec2 swell=vec2(.55,.83)*sin(dot(p,vec2(.045,.069))-time*.22+sin(p.x*.013)*.5)*.010;
    vec2 slope=(swell+ripple*detail)*mix(.24,1.,smoothstep(.08,1.6,depth));
    vec3 n=normalize(vec3(slope.x,1.,slope.y));
    vec3 v=normalize(cameraPosition-waterWorld),r=reflect(-v,n);
    float fresnel=.0204+.9796*pow(1.-max(0.,dot(n,v)),5.);
    vec3 reflected=texture2D(skyMap,equirectUv(normalize(skyRotation*r)),1.2).rgb;
    float luminance=dot(reflected,vec3(.2126,.7152,.0722));reflected=mix(reflected,vec3(luminance)*vec3(.93,1.,1.03),.18)*.50;
    vec2 uv=reflectionUV.xy/max(.0001,reflectionUV.w)+n.xz*.008;
    float valid=mirrorReady*step(.002,uv.x)*step(uv.x,.998)*step(.002,uv.y)*step(uv.y,.998)*step(.0001,reflectionUV.w);
    vec2 blur=vec2(mirrorTexel*1.3);vec3 scenery=texture2D(lakeMirror,uv).rgb*.4;
    scenery+=(texture2D(lakeMirror,uv+vec2(blur.x,0.)).rgb+texture2D(lakeMirror,uv-vec2(blur.x,0.)).rgb+texture2D(lakeMirror,uv+vec2(0.,blur.y)).rgb+texture2D(lakeMirror,uv-vec2(0.,blur.y)).rgb)*.15;
    reflected=mix(reflected,scenery*.82,valid*smoothstep(.03,.6,lakeDepth));
    vec3 bed=lakeMineral(texture2D(bedMap,p/3.2).rgb)*.42;
    float pathDepth=depth/max(.22,abs(v.y));
    vec3 transmission=exp(-vec3(.55,.22,.14)*pathDepth);
    vec3 water=bed*transmission+vec3(.016,.049,.058)*(1.-transmission);
    float glint=pow(max(0.,dot(n,normalize(v+sunDirection))),420.);
    vec3 c=mix(water,reflected,fresnel*.76)+vec3(.68,.52,.31)*glint*.10;
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export default function RoadLake({bedMap,scans,grassTemplates,floor,farGround}:{bedMap:Texture;scans:ReturnType<typeof useAlpineScans>;grassTemplates:ReturnType<typeof useAlpineGrass>;floor:BufferGeometry;farGround:(x:number,z:number)=>number}){
  const quiet=useQuietMotion(),scene=useThree(s=>s.scene),quality=usePalaceStore(s=>s.effectiveQuality),water=useRef<Mesh>(null);
  const loading=useRef(true),frustum=useMemo(()=>new Frustum(),[]),viewProjection=useMemo(()=>new Matrix4(),[]);
  const geometry=useMemo(()=>createLakeMesh(floor),[floor]);
  const shore=useMemo(()=>createLakeShore(geometry,farGround),[geometry,farGround]),staticMotion=useMemo(()=>({time:{value:0},wind:{value:0}}),[]);
  const optics=useMemo(()=>{
    const tier=lakeReflectionTier(quality);if(!tier)return null;
    const plane=new PlaneGeometry(lake.rx*4,lake.rz*4),mirror=new Reflector(plane,{textureWidth:tier.size,textureHeight:tier.size,clipBias:.004,multisample:0}),mirrorMaterial=mirror.material;
    if(!(mirrorMaterial instanceof ShaderMaterial))throw Error('Expected Reflector shader');
    mirror.name='lake-reflection-capture';mirror.position.set(lake.x,lake.y,lake.z);mirror.rotation.x=-Math.PI/2;mirror.visible=false;mirror.raycast=()=>{};
    const capture=mirror.onBeforeRender.bind(mirror);mirror.onBeforeRender=()=>{};
    return{plane,mirror,mirrorMaterial,capture,budget:new ReflectionBudget(tier.hz),size:tier.size};
  },[quality]);
  const uniforms=useMemo(()=>({...UniformsUtils.clone(UniformsLib.fog),time:{value:0},skyMap:{value:null as Texture|null},bedMap:{value:bedMap},reflectionProjection:{value:new Matrix4()},lakeMirror:{value:null as Texture|null},mirrorReady:{value:0},mirrorTexel:{value:1/512},skyRotation:{value:new Matrix3().setFromMatrix4(new Matrix4().makeRotationY(-forestSkyRotation))},sunDirection:{value:new Vector3(...forestSun).normalize()}}),[bedMap]);
  useEffect(()=>{uniforms.mirrorReady.value=0;uniforms.lakeMirror.value=optics?.mirror.getRenderTarget().texture??null;uniforms.mirrorTexel.value=1/(optics?.size??512);optics?.budget.invalidate();return()=>{optics?.mirror.dispose();optics?.plane.dispose();};},[optics,uniforms]);
  const material=useMemo(()=>new ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,fog:true}),[uniforms]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>()=>material.dispose(),[material]);
  useFrame(({gl,camera,clock},dt)=>{
    if(!quiet)uniforms.time.value+=Math.min(dt,.06);
    const background=scene.background;
    // 使用 Three 的结构标识，兼容当前 vendor / drei 解码对象跨模块的 Texture 构造器。
    if(background&&"isTexture" in background&&background.isTexture)uniforms.skyMap.value=background as Texture;
    if(!optics||!water.current)return;
    const pending=!!textureStatus().pending;if(loading.current&&!pending)optics.budget.invalidate();loading.current=pending;
    camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
    const visible=!document.hidden&&!pending&&camera.position.y>lake.y+.04&&!!geometry.boundingSphere&&frustum.intersectsSphere(geometry.boundingSphere);
    if(!optics.budget.take(clock.elapsedTime,camera.position,camera.quaternion,!quiet&&!usePalaceStore.getState().overlay,visible))return;
    optics.mirror.updateMatrixWorld(true);
    captureLakeReflection(gl,water.current,optics.mirror,()=>optics.capture(gl,scene,camera,optics.plane,optics.mirrorMaterial,null!));
    lakeWorldProjection(uniforms.reflectionProjection.value,optics.mirrorMaterial.uniforms.textureMatrix.value,optics.mirror.matrixWorld);
    uniforms.mirrorReady.value=1;water.current.userData.reflectionCaptures=(water.current.userData.reflectionCaptures||0)+1;
  });
  return <group name="grounded-lake-shore">
    {optics&&<primitive object={optics.mirror} dispose={null}/>}
    <mesh ref={water} name="long-way-home-lake" geometry={geometry} material={material} raycast={()=>{}} dispose={null}/>
    <ScanInstances scan={scans[0]} items={shore.rocks} shadows={false}/>
    {shore.grass.map((items,i)=><GrassField key={i} template={grassTemplates[i+3]} items={items} {...staticMotion}/>)}
  </group>;
}
