import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { MeshStandardMaterial, SRGBColorSpace, Vector2 } from "three";
import { useCourtMaps } from "./assets";

export default function CourtSurface() {
  const aggregate = useCourtMaps("aggregate", [12, 18]), paving = useCourtMaps("paving", [32, 32]), paintingSource = useTexture("/media/court/painting.webp");
  const painting = useMemo(() => { const t = paintingSource.clone(); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; }, [paintingSource]);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ map: painting, normalMap: aggregate.normalMap, normalScale: new Vector2(.32, .32), roughnessMap: aggregate.roughnessMap, roughness: .92, metalness: 0 });
    // 一张原比例的大涂装，叠加实际 2m 路面颗粒；不能用低清颗粒重复贴图替代场地画线。
    m.onBeforeCompile = shader => {
      shader.uniforms.courtAggregate = { value: aggregate.map };
      shader.fragmentShader = "uniform sampler2D courtAggregate;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nvec3 groundDetail=texture2D(courtAggregate,vMapUv*vec2(12.,18.)).rgb;\nfloat grain=dot(groundDetail,vec3(.2126,.7152,.0722));\ndiffuseColor.rgb*=mix(.73,1.14,smoothstep(.025,.62,grain));");
    };
    m.customProgramCacheKey = () => "court-paint-aggregate-v1";
    m.userData.courtTextures = [aggregate.map]; return m;
  }, [painting, aggregate.map, aggregate.normalMap, aggregate.roughnessMap]);
  useEffect(() => () => { material.dispose(); painting.dispose(); }, [material, painting]);
  return <group name="park-court-surfaces">
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}><planeGeometry args={[24, 36]} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.035, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial {...paving} color="#afb3a8" roughness={.96} normalScale={new Vector2(.55, .55)} /></mesh>
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * 12.14, .015, 0]} receiveShadow><boxGeometry args={[.25, .1, 36]} /><meshStandardMaterial color="#7c8077" roughness={.88} /></mesh>
      <mesh position={[0, .015, s * 18.13]} receiveShadow><boxGeometry args={[24.6, .1, .25]} /><meshStandardMaterial color="#7c8077" roughness={.88} /></mesh>
    </group>)}
  </group>;
}
