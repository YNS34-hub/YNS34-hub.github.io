import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CircleGeometry, ShaderMaterial, Vector3 } from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { usePalaceStore } from "../systems/store";
const waterShader = (Reflector as typeof Reflector & { ReflectorShader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string } }).ReflectorShader;

export default function LakeReflection() {
  const quality = usePalaceStore(s => s.effectiveQuality);
  const clock = useRef(0), direction = useRef(new Vector3());
  const reflector = useMemo(() => {
    const shader = {
      ...waterShader,
      uniforms: { ...waterShader.uniforms, elapsed: { value: 0 } },
      vertexShader: waterShader.vertexShader.replace("varying vec4 vUv;", "varying vec4 vUv; varying vec3 worldPoint;").replace("vUv = textureMatrix", "worldPoint = (modelMatrix * vec4(position, 1.)).xyz; vUv = textureMatrix"),
      fragmentShader: waterShader.fragmentShader.replace("varying vec4 vUv;", "varying vec4 vUv; varying vec3 worldPoint; uniform float elapsed;").replace("vec4 base = texture2DProj( tDiffuse, vUv );", "vec4 coords = vUv; coords.xy += vec2(sin(worldPoint.x * 2.1 + elapsed), cos(worldPoint.z * 1.8 + elapsed * .7)) * .0008 * coords.w; vec4 base = texture2DProj(tDiffuse, coords);").replace("blendOverlay( base.rgb, color )", "mix(vec3(.035, .095, .105), base.rgb, .68)"),
    };
    const size = quality === "high" ? 512 : 384;
    const lake = new Reflector(new CircleGeometry(1, 80), { color: "#355761", shader, textureWidth: size, textureHeight: size, multisample: 0, clipBias: .003 });
    lake.position.set(53, .23, -13); lake.rotation.x = -Math.PI / 2; lake.scale.set(39, 53, 1);
    lake.name = "sky-reflecting-lake";
    const render = lake.onBeforeRender;
    let last = -1, renders = 0;
    lake.onBeforeRender = function (...args) {
      const [, , camera] = args;
      camera.getWorldDirection(direction.current);
      // 全馆只有这里增加离屏视口；仅进入水面视野时更新，每秒最多八次，低画质禁用。
      if (direction.current.y > .28 || clock.current - last < .125) return;
      last = clock.current;
      render.apply(lake, args); lake.userData.reflectionFrames = ++renders;
    };
    return lake;
  }, [quality]);
  useEffect(() => () => { reflector.dispose(); reflector.geometry.dispose(); }, [reflector]);
  useFrame((_, dt) => { clock.current += Math.min(dt, .06); (reflector.material as ShaderMaterial).uniforms.elapsed.value = clock.current; });
  return <primitive object={reflector} />;
}
