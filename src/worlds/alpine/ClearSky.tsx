import { useEffect, useMemo } from "react";
import { Sky } from "three/addons/objects/Sky.js";

export default function ClearSky({ direction, turbidity, rayleigh }: { direction: [number,number,number]; turbidity: number; rayleigh: number }) {
  const sky = useMemo(() => {
    const object = new Sky(); object.scale.setScalar(8000);
    // 只给天空辐亮度曝光，不抬高场景 / 原图曝光；否则 ACES 会把晴天蓝色压成近白。
    object.material.fragmentShader = object.material.fragmentShader.replace("gl_FragColor = vec4( retColor, 1.0 );", "gl_FragColor = vec4( retColor * vec3(0.144,0.2432,0.352), 1.0 );");
    object.material.uniforms.mieCoefficient.value = .003;
    object.material.uniforms.mieDirectionalG.value = .82;
    return object;
  }, []);
  useEffect(() => {
    sky.material.uniforms.sunPosition.value.set(...direction);
    sky.material.uniforms.turbidity.value = turbidity;
    sky.material.uniforms.rayleigh.value = rayleigh;
  }, [sky,direction,turbidity,rayleigh]);
  useEffect(() => () => { sky.geometry.dispose(); sky.material.dispose(); }, [sky]);
  return <primitive object={sky} dispose={null}/>;
}
