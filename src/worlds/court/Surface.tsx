import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { MeshStandardMaterial, SRGBColorSpace, Vector2 } from "three";
import { useCourtMaps } from "./assets";
import { cloneWearTexture } from "../surfaceDetail";

export default function CourtSurface() {
  const aggregate = useCourtMaps("aggregate", [12, 18]), paving = useCourtMaps("paving", [32, 32]), paintingSource = useTexture("/media/court/painting.webp");
  const painting = useMemo(() => { const t = paintingSource.clone(); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; }, [paintingSource]);
  const wearSource = useTexture("/media/realism/court-wear.webp"), wear = useMemo(() => cloneWearTexture(wearSource), [wearSource]);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ map: painting, normalMap: aggregate.normalMap, normalScale: new Vector2(.32, .32), roughnessMap: aggregate.roughnessMap, roughness: .92, metalness: 0 });
    // 一张原比例的大涂装，叠加实际 2m 路面颗粒；不能用低清颗粒重复贴图替代场地画线。
    m.onBeforeCompile = shader => {
      shader.uniforms.courtAggregate = { value: aggregate.map };
      shader.uniforms.courtWear = { value: wear };
      shader.fragmentShader = "uniform sampler2D courtAggregate;uniform sampler2D courtWear;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nvec3 groundDetail=texture2D(courtAggregate,vMapUv*vec2(12.,18.)).rgb;\nfloat grain=dot(groundDetail,vec3(.2126,.7152,.0722));\nvec3 coating=texture2D(courtWear,vMapUv).rgb;\ndiffuseColor.rgb*=mix(.88,1.04,smoothstep(.025,.62,grain))*(.91+coating.r*.18)*(1.-coating.b*.28);");
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*.91+coating.g*.09,.78,1.);");
    };
    m.customProgramCacheKey = () => "court-paint-coating-wear-v2";
    m.userData.courtTextures = [aggregate.map, wear]; return m;
  }, [painting, aggregate.map, aggregate.normalMap, aggregate.roughnessMap, wear]);
  useEffect(() => () => { material.dispose(); painting.dispose(); }, [material, painting]);
  useEffect(() => () => wear.dispose(), [wear]);
  return <group name="park-court-surfaces">
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}><planeGeometry args={[24, 36]} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.035, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial {...paving} color="#afb3a8" roughness={.96} normalScale={new Vector2(.55, .55)} /></mesh>
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * 12.14, .015, 0]} receiveShadow><boxGeometry args={[.25, .1, 36]} /><meshStandardMaterial color="#7c8077" roughness={.88} /></mesh>
      <mesh position={[0, .015, s * 18.13]} receiveShadow><boxGeometry args={[24.6, .1, .25]} /><meshStandardMaterial color="#7c8077" roughness={.88} /></mesh>
    </group>)}
  </group>;
}
