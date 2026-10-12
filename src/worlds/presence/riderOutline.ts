import { BackSide, Color, ShaderMaterial, SkinnedMesh, UniformsLib, UniformsUtils, Vector2, type WebGLRenderer } from "three";

export function createRiderOutline() {
  const resolution=new Vector2(1,1), shells:{source:SkinnedMesh;shell:SkinnedMesh}[]=[];
  const material=new ShaderMaterial({side:BackSide,depthWrite:true,fog:true,toneMapped:false,
    uniforms:UniformsUtils.merge([UniformsLib.fog,{resolution:{value:resolution},pixels:{value:1.1},ink:{value:new Color("#17262c")}}]),
    vertexShader:`
      #include <common>
      #include <skinning_pars_vertex>
      #include <morphtarget_pars_vertex>
      #include <fog_pars_vertex>
      uniform vec2 resolution; uniform float pixels;
      void main(){
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vec3 viewNormal=normalize(normalMatrix*objectNormal);
        vec2 edge=(projectionMatrix*vec4(viewNormal,0.)).xy;
        edge/=max(.0001,length(edge));
        gl_Position.xy+=edge*(pixels*2./max(resolution,vec2(1.)))*gl_Position.w;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform vec3 ink;
      #include <fog_pars_fragment>
      void main(){gl_FragColor=vec4(ink,1.);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // 克隆节点而不克隆蒙皮资源：同一套骨骼、同一个形变网格，只多一次薄轮廓绘制。
  let released=false;
  return {material,resolution,
    attach(source:SkinnedMesh){
      const shell=source.clone(false);shell.name="rider-outline:"+source.name;
      shell.position.set(0,0,0);shell.quaternion.identity();shell.scale.set(1,1,1);shell.matrix.identity();shell.matrixAutoUpdate=true;
      shell.material=material;shell.castShadow=false;shell.receiveShadow=false;shell.raycast=()=>{};shell.frustumCulled=false;
      source.add(shell);shells.push({source,shell});return shell;
    },
    // StrictMode 的 effect 清理会重播；同一自有材质可重新上传，壳体重新挂回原蒙皮节点。
    activate(){released=false;for(const {source,shell} of shells)if(shell.parent!==source)source.add(shell);},
    update(renderer:WebGLRenderer,visible:boolean){
      renderer.getDrawingBufferSize(material.uniforms.resolution.value);
      material.uniforms.pixels.value=1.1*renderer.getPixelRatio();
      for(const {shell} of shells)shell.visible=visible;
    },
    dispose(){if(released)return;released=true;for(const {shell} of shells)shell.removeFromParent();material.dispose();},
  };
}
