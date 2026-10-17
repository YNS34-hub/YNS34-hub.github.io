import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial } from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { usePalaceStore } from "../../systems/store";
import { useSurfaceTexture } from "../../world/materials";
import { Floor } from "../../world/primitives";
import { textureStatus } from "../../world/textureCache";
import { setWalkTarget } from "../../world/walkTarget";
import { ReflectionBudget } from "./budget";
import { useQuietMotion } from "../../motion/useMotionCue";

export default function EntryFloor(){
  const quality=usePalaceStore(s=>s.effectiveQuality);
  return quality==="low"?<group position={[0,.035,0]}><Floor width={42} depth={54} color="#b9beb7"/></group>:<ReflectiveStone high={quality==="high"}/>;
}
function ReflectiveStone({high}:{high:boolean}){
  const stone=useSurfaceTexture("stone"),floor=useRef<Mesh>(null),pending=useRef(true),quiet=useQuietMotion();
  const memory=useRef(false),memoryAt=useRef(-Infinity);
  const optics=useMemo(()=>{
    const geometry=new PlaneGeometry(42,54),size=high?768:512;
    const mirror=new Reflector(geometry,{textureWidth:size,textureHeight:size,clipBias:.003,multisample:0});
    const mirrorMaterial=mirror.material;
    if(!(mirrorMaterial instanceof ShaderMaterial))throw new Error("Expected the built-in Reflector shader");
    // 原基底上表面为 -0.03，旧 Floor 在 -0.035 被遮住；饰面置于实际行走的零高度。
    mirror.name="atrium-floor-capture";mirror.position.y=0;mirror.rotation.x=-Math.PI/2;mirror.visible=false;mirror.raycast=()=>{};
    const capture=mirror.onBeforeRender.bind(mirror);mirror.onBeforeRender=()=>{};
    const material=new MeshStandardMaterial({color:"#b9beb7",roughness:.32,metalness:.06,bumpMap:stone,bumpScale:.0045});
    material.onBeforeCompile=shader=>{
      shader.uniforms.entryMirror={value:mirror.getRenderTarget().texture};shader.uniforms.entryMatrix=mirrorMaterial.uniforms.textureMatrix;shader.uniforms.entryTexel={value:1/size};
      shader.vertexShader="uniform mat4 entryMatrix;varying vec4 entryUV;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nentryUV=entryMatrix*vec4(position,1.);");
      shader.fragmentShader="uniform sampler2D entryMirror;uniform float entryTexel;varying vec4 entryUV;\n"+shader.fragmentShader;
      // 反射在主通道色调映射之前混入线性光；五点软采样保留石材粗糙感，不把原图染色。
      shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`vec2 euv=entryUV.xy/max(.0001,entryUV.w);
        vec2 spread=vec2(entryTexel*2.5);vec3 reflection=texture2D(entryMirror,euv).rgb*.4;
        reflection+=(texture2D(entryMirror,euv+vec2(spread.x,0.)).rgb+texture2D(entryMirror,euv-vec2(spread.x,0.)).rgb+texture2D(entryMirror,euv+vec2(0.,spread.y)).rgb+texture2D(entryMirror,euv-vec2(0.,spread.y)).rgb)*.15;
        float valid=step(0.,euv.x)*step(euv.x,1.)*step(0.,euv.y)*step(euv.y,1.)*step(0.,entryUV.w);
        float grazing=pow(1.-clamp(dot(normal,geometryViewDir),0.,1.),3.);
        outgoingLight=mix(outgoingLight,reflection,valid*(.13+.28*grazing));
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>"museum-entry-stone-soft-reflection-v2";
    return {mirror,mirrorMaterial,material,geometry,capture,budget:new ReflectionBudget(high?12:8)};
  },[high,stone]);
  useEffect(()=>()=>{optics.material.dispose();optics.mirror.dispose();optics.geometry.dispose();},[optics]);
  useFrame(({gl,scene,camera,clock})=>{
    const state=usePalaceStore.getState(),loading=!!textureStatus().pending;
    if(pending.current&&!loading)optics.budget.invalidate();pending.current=loading;
    if(memory.current!==state.memoryReveal){memory.current=state.memoryReveal;memoryAt.current=clock.elapsedTime;optics.budget.invalidate();}
    const animated=state.memoryReveal||clock.elapsedTime-memoryAt.current<3.2||!quiet&&!state.overlay&&!state.focus;
    if(!floor.current||!optics.budget.take(clock.elapsedTime,camera.position,camera.quaternion,animated,!document.hidden))return;
    // 主平面不参与自己的镜像；沿用 Three 的正确镜像 / 斜裁切，阴影不在此副通道重复更新。
    const visible=floor.current.visible;floor.current.visible=false;optics.mirror.updateMatrixWorld(true);
    try{optics.capture(gl,scene,camera,optics.geometry,optics.mirrorMaterial,null!);floor.current.userData.reflectionCaptures=(floor.current.userData.reflectionCaptures||0)+1;}
    finally{floor.current.visible=visible;optics.mirror.visible=false;}
  });
  return <><primitive object={optics.mirror} dispose={null}/><mesh ref={floor} name="atrium-polished-stone" geometry={optics.geometry} material={optics.material} position={[0,0,0]} rotation={[-Math.PI/2,0,0]} receiveShadow dispose={null}
    onClick={event=>{if(event.delta<5&&usePalaceStore.getState().mode==="tour")setWalkTarget(event.point);}}/></>;
}
