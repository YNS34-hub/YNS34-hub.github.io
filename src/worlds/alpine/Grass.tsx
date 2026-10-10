import {useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import {useGLTF,useTexture} from "@react-three/drei";
import {BufferGeometry,DoubleSide,Float32BufferAttribute,InstancedMesh,Mesh,MeshStandardMaterial,Object3D,SRGBColorSpace} from "three";
import type {Instance} from "../Instances";

const url="/media/alpine/grass_medium_01/scene.gltf",clumpUrl="/media/alpine/grass_medium_01/clumps.webp";
export function preloadAlpineGrass(){useGLTF.preload(url);useTexture.preload(clumpUrl);}
export function useAlpineGrass(){
  const model=useGLTF(url),clumpSource=useTexture(clumpUrl);
  const clumpMap=useMemo(()=>{const map=clumpSource.clone();map.colorSpace=SRGBColorSpace;map.anisotropy=8;map.needsUpdate=true;return map;},[clumpSource]);
  useEffect(()=>()=>clumpMap.dispose(),[clumpMap]);
  const templates=useMemo(()=>{
    const meshes:Mesh[]=[];model.scene.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
    const full=meshes.map(mesh=>{
      const g=mesh.geometry.clone();g.computeBoundingBox();const box=g.boundingBox!,height=box.max.y-box.min.y;
      g.translate(-(box.min.x+box.max.x)*.5,-box.min.y,-(box.min.z+box.max.z)*.5);g.scale(1/height,1/height,1/height);g.computeBoundingSphere();
      return {geometry:g,material:mesh.material as MeshStandardMaterial};
    });
    // 远处使用同一照片中的完整草簇，近景仍保留真实叶片曲面；远景纹理沿 TextureLoader 的原点取图。
    const clumps=[[0,.5,.5,1],[.5,.5,1,1],[0,0,.5,.5]];
    const flatMaterial=full[0].material.clone();flatMaterial.map=clumpMap;flatMaterial.normalMap=null;
    const flat=clumps.map(([left,top,right,bottom])=>{
      const positions:number[]=[],uv:number[]=[],indices:number[]=[];
      for(let j=0;j<2;j++){
        const angle=j*Math.PI/2,c=Math.cos(angle)*.5,s=Math.sin(angle)*.5,i=positions.length/3;
        positions.push(-c,0,-s,c,0,s,-c,1,-s,c,1,s);uv.push(left,top,right,top,left,bottom,right,bottom);indices.push(i,i+1,i+2,i+2,i+1,i+3);
      }
      const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
      return {geometry,material:flatMaterial};
    });
    return [...full,...flat];
  },[model,clumpMap]);
  useEffect(()=>()=>{templates.forEach(t=>t.geometry.dispose());templates[3].material.dispose();},[templates]);return templates;
}
export function GrassField({template,items,time,wind,near=false,blend=false}:{template:ReturnType<typeof useAlpineGrass>[number];items:Instance[];time:{value:number};wind:{value:number};near?:boolean;blend?:boolean}){
  const ref=useRef<InstancedMesh>(null);
  const {camera}=useThree();
  const material=useMemo(()=>{
    const m=template.material.clone();m.side=DoubleSide;m.transparent=false;m.alphaTest=.42;m.alphaToCoverage=true;m.forceSinglePass=true;
    m.normalScale.set(.3,.3);m.map!.anisotropy=8;m.color.set("#c3dd94");
    m.onBeforeCompile=shader=>{
      shader.uniforms.alpineGrassTime=time;shader.uniforms.alpineGrassWind=wind;
      shader.vertexShader="varying vec3 alpineGrassPosition;uniform float alpineGrassTime;uniform float alpineGrassWind;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ntransformed.x+=sin(alpineGrassTime*.7+instanceMatrix[3].x*.23)*alpineGrassWind*position.y*position.y;alpineGrassPosition=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;");
      // 薄叶片保留少量透光；根部仍有暗部，不把背光的整簇草压成黑色。
      shader.fragmentShader="varying vec3 alpineGrassPosition;\n"+shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\ndiffuseColor.rgb*=vec3(1.6,1.9,1.25);").replace("#include <alphatest_fragment>",(blend?"diffuseColor.a*="+(near?"1.-":"")+"smoothstep(60.,85.,distance(cameraPosition,alpineGrassPosition));\n":"")+"#include <alphatest_fragment>").replace("#include <opaque_fragment>","outgoingLight+=diffuseColor.rgb*.30;\n#include <opaque_fragment>");
    };m.customProgramCacheKey=()=>"alpine-photographed-grass-v2:"+near+":"+blend;return m;
  },[template,time,wind,near,blend]);
  useEffect(()=>()=>material.dispose(),[material]);
  const update=useMemo(()=>{const p=new Object3D();let lastX=Infinity,lastZ=Infinity;
    return ()=>{if(!ref.current||Math.hypot(camera.position.x-lastX,camera.position.z-lastZ)<5)return;lastX=camera.position.x;lastZ=camera.position.z;let n=0;
      for(const item of items){if(near&&(item.position[0]-lastX)**2+(item.position[2]-lastZ)**2>92**2)continue;
        p.position.set(...item.position);p.scale.set(...item.scale);p.rotation.set(...(item.rotation??[0,0,0]));p.updateMatrix();ref.current.setMatrixAt(n++,p.matrix);}
      ref.current.count=n;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();
    };
  },[items,near,camera]);
  useLayoutEffect(update,[update]);useFrame(()=>{if(near)update();});
  return <instancedMesh ref={ref} name="photographed-alpine-grass" args={[template.geometry,material,items.length]} receiveShadow raycast={()=>{}} dispose={null}/>;
}
