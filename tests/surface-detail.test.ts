import { describe, expect, it, vi } from "vitest";
import { Matrix4, MeshStandardMaterial, NoColorSpace, PlaneGeometry, ShaderLib, Texture, Vector3, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from "three";
import { applyRoadWear, cloneWearTexture, groundGrassGeometry, softenCanopyNormals } from "../src/worlds/surfaceDetail";
import { applyAlpineSunlight } from "../src/worlds/alpine/sunlight";
import {dryRoadMaterial} from "../src/worlds/scenery/roadFinish";

describe("bounded surface detail", () => {
  it("owns linear mask samplers without mutating or disposing a shared image", () => {
    const source = new Texture(), disposed = vi.fn(); source.addEventListener("dispose", disposed);
    const mask = cloneWearTexture(source); expect(mask).not.toBe(source); expect(mask.source).toBe(source.source);
    expect(mask.colorSpace).toBe(NoColorSpace); expect(mask.anisotropy).toBe(8);
    mask.dispose(); expect(disposed).not.toHaveBeenCalled();
  });
  it("composes metre-space road wear once, retaining prior shader code and material identity", () => {
    const m = new MeshStandardMaterial(), original = vi.fn((s: WebGLProgramParametersWithUniforms) => { s.fragmentShader += "\n// preserved-desaturation"; });
    m.onBeforeCompile = original; m.customProgramCacheKey = () => "accepted-road";
    applyRoadWear(m, [2,5], 6.4); const compile = m.onBeforeCompile; applyRoadWear(m, [2,5], 6.4);
    expect(m.onBeforeCompile).toBe(compile); expect(m.customProgramCacheKey()).toBe("accepted-road:metre-scale-dry-wear-v1");
    const s = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} } as WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(s, {} as WebGLRenderer); expect(original).toHaveBeenCalledOnce();
    expect(s.fragmentShader).toContain("preserved-desaturation"); expect(s.fragmentShader).toContain("#include <roughnessmap_fragment>");
    expect(s.uniforms.roadWearMetres.value.toArray()).toEqual([2,5]); expect(s.uniforms.roadWearWidth.value).toBe(6.4);
    expect(s.vertexShader).toContain("roadWearPosition=uv*roadWearMetres"); expect(s.fragmentShader).not.toContain("uniform float time"); m.dispose();
  });
  it("keeps crown positions and bounds while producing finite unit normals", () => {
    const g = new PlaneGeometry(2,2), before = Array.from(g.getAttribute("position").array);
    softenCanopyNormals(g, new Vector3(0,-2,-1)); expect(Array.from(g.getAttribute("position").array)).toEqual(before);
    const normal = new Vector3(); for(let i=0;i<4;i++){normal.fromBufferAttribute(g.getAttribute("normal"),i);expect(normal.length()).toBeCloseTo(1,5);expect(normal.y).toBeGreaterThan(0);}
    g.dispose();
  });
  it("retains the measured alpine shadow field when road wear is composed beneath it", () => {
    const material=new MeshStandardMaterial(), sun=new Texture();applyRoadWear(material,[3,6],6.4);
    applyAlpineSunlight(material,sun,{x0:-100,z0:-200,step:5,width:64,height:64,direction:[0,1,0],rayDistance:2000});
    const s={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}} as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(s,{} as WebGLRenderer);
    expect(s.uniforms.alpineSunTexture.value).toBe(sun);expect(s.uniforms.roadWearMetres.value.toArray()).toEqual([3,6]);
    expect(s.fragmentShader).toContain("directLight.color*=mix(.04,1.");expect(s.fragmentShader).toContain("wheelPolish");
    expect(material.customProgramCacheKey()).toContain(":metre-scale-dry-wear-v1:alpine-measured-sun-v1");material.dispose();sun.dispose();
  });
  it("keeps measured sunlight and shared assets when the layered pavement is composed beneath it",()=>{
    const map=new Texture(),normal=new Texture(),sun=new Texture(),dispose=vi.fn();
    for(const texture of [map,normal,sun])texture.addEventListener("dispose",dispose);
    const material=dryRoadMaterial(map,normal,[3,6],6.4),identity=material.uuid;
    applyAlpineSunlight(material,sun,{x0:-100,z0:-200,step:5,width:64,height:64,direction:[0,1,0],rayDistance:2000});
    const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}} as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader,{} as WebGLRenderer);
    expect(material.uuid).toBe(identity);expect(shader.uniforms.alpineSunTexture.value).toBe(sun);
    expect(shader.uniforms.roadWearMetres.value.toArray()).toEqual([3,6]);expect(shader.uniforms.roadWearWidth.value).toBe(6.4);
    expect(shader.fragmentShader).toContain("directLight.color*=mix(.04,1.");
    expect(shader.fragmentShader).toContain("#include <fog_fragment>");expect(shader.fragmentShader).toContain("#include <lights_fragment_end>");
    expect(shader.uniforms).not.toHaveProperty("time");expect(material.transparent).toBe(false);
    material.dispose();expect(dispose).not.toHaveBeenCalled();expect(map.repeat.toArray()).toEqual([1,1]);
  });
  it("keeps grass roots below the ground for the complete placement height and tilt range", () => {
    let seed=617;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
    const g=groundGrassGeometry(rand), p=g.getAttribute("position"), point=new Vector3();
    expect(p.count).toBe(45);expect(g.index!.count/3).toBe(27);
    for(const height of[.14,.36])for(const width of[.05,.095])for(const tilt of[-.15,.15]){
      const matrix=new Matrix4().makeRotationZ(tilt).scale(new Vector3(width,height,1));matrix.setPosition(0,height*.5-.025,0);
      for(let b=0;b<9;b++)for(const i of[b*5,b*5+1]){point.fromBufferAttribute(p,i).applyMatrix4(matrix);expect(point.y).toBeLessThanOrEqual(.002);expect(point.y).toBeGreaterThan(-.065);}
    }
    g.dispose();
  });
});
