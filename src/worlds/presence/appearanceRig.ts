import { Color, Matrix3, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from "three";
import { outfits, type OutfitId } from "./appearance";
import type { AvatarProfile } from "./avatarProfile.mjs";

const bell = (v: number, middle: number, spread: number) => Math.exp(-(((v - middle) / spread) ** 2));
export function reshapeAthletePoint(x: number, y: number, z: number, profile: AvatarProfile) {
  // 授权网格的绑定坐标是厘米 / Z 向上；仅改变低幅度外形，不改变骨长、蒙皮权重或 IK 链。
  const h = z / 100, torso = Math.abs(x) < 29 ? 1 : 0;
  x *= 1 + torso * ((profile.chest - 1) * bell(h, 1.34, .15) + (profile.waist - 1) * bell(h, 1.05, .12) + (profile.shoulders - 1) * bell(h, 1.47, .10));
  if (torso && h > .94 && h < 1.53) {
    const front = Math.max(0, Math.min(1, (-y - 1) / 5));
    y *= 1 + (profile.waist - 1) * bell(h, 1.05, .12);
    y -= front * (profile.chest - 1) * 25 * bell(h, 1.36, .075) * bell(Math.abs(x), 10.5, 9);
    y -= front * (profile.chest - 1) * 8 * (bell(h, 1.23, .035) + bell(h, 1.155, .035) + bell(h, 1.09, .035)) * bell(Math.abs(x), 4, 4);
  }
  if (Math.abs(x) > 24 && Math.abs(x) < 56 && h > 1.28 && h < 1.58) { const growth = 1 + (profile.arms - 1) * bell(h, 1.445, .10); y = -3 + (y + 3) * growth; z = 144.5 + (z - 144.5) * growth; }
  if (h > 1.56 && Math.abs(x) < 13) {
    x *= 1 + (profile.jaw - 1) * (bell(h, 1.63, .08) + .6 * bell(h, 1.69, .055));
    if (y < -10 && Math.abs(x) < 3.6) y = -10 + (y + 10) * (1 + (profile.nose - 1) * bell(h, 1.688, .032));
    if (y < -6 && Math.abs(x) > 2 && Math.abs(x) < 6.3) z += (profile.eyeHeight - 1) * (z - 169.2) * bell(h, 1.692, .015);
    if (z > 173.8) z = 173.8 + (z - 173.8) * profile.hairCrop;
  }
  return [x, y, z] as const;
}
export function reshapeAthlete(geometry: BufferGeometry, profile: AvatarProfile) {
  const own = geometry.clone(), position = own.getAttribute("position"), normals = own.getAttribute("normal");
  const jacobian = new Matrix3(), normal = new Vector3(), epsilon = .025;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i), p = reshapeAthletePoint(x, y, z, profile);
    if (normals) {
      // 授权网格包含 UV 接缝及拆开的三角形。保留原平滑法线并用形变雅可比变换，不能逐面重算法线。
      const a = reshapeAthletePoint(x + epsilon, y, z, profile), b = reshapeAthletePoint(x, y + epsilon, z, profile), c = reshapeAthletePoint(x, y, z + epsilon, profile);
      jacobian.set((a[0]-p[0])/epsilon,(b[0]-p[0])/epsilon,(c[0]-p[0])/epsilon,(a[1]-p[1])/epsilon,(b[1]-p[1])/epsilon,(c[1]-p[1])/epsilon,(a[2]-p[2])/epsilon,(b[2]-p[2])/epsilon,(c[2]-p[2])/epsilon).invert().transpose();
      normal.fromBufferAttribute(normals, i).applyMatrix3(jacobian).normalize(); normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    position.setXYZ(i, ...p);
  }
  position.needsUpdate = true; if (normals) normals.needsUpdate = true;
  own.computeBoundingBox(); own.computeBoundingSphere(); return own;
}
export function dressAthlete(mesh: Mesh, profile: AvatarProfile, outfitId: OutfitId) {
  const outfit = outfits[outfitId];
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const value of materials) {
    if (!(value instanceof MeshStandardMaterial)) continue;
    const head = /head/.test(value.name), shirtless = outfit.style === "training" || outfit.style === "denim";
    value.roughness = head ? .70 : outfit.style === "urban" ? .88 : .78;
    value.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { athleteSkin: { value: new Color(profile.skin) }, athleteHair: { value: new Color(profile.hair) }, athleteTop: { value: new Color(outfit.top) }, athleteBottom: { value: new Color(outfit.bottom) }, athleteStyle: { value: shirtless ? 1 : outfit.style === "urban" ? 2 : 0 }, athleteDenim: { value: outfit.style === "denim" ? 1 : 0 } });
      shader.vertexShader = "varying vec3 vAthleteRest;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAthleteRest = position * 0.01;");
      shader.fragmentShader = "varying vec3 vAthleteRest;\nuniform vec3 athleteSkin, athleteHair, athleteTop, athleteBottom;\nuniform float athleteStyle, athleteDenim;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        #ifdef USE_MAP
        vec3 source = diffuseColor.rgb;
        float lum = dot(source, vec3(.2126,.7152,.0722));
        float cloth = clamp(lum / .075, .30, 1.75);
        ${head ? `
          bool hair = vMapUv.y < .70 && lum < .085;
          bool iris = vMapUv.y > .84 && vMapUv.x > .20 && vMapUv.x < .34 && source.g > source.r * 1.02;
          if (hair) diffuseColor.rgb = athleteHair * clamp(lum / .018, .45, 2.5);
          else if (iris) diffuseColor.rgb = vec3(.035,.027,.020) * clamp(lum / .10, .4, 1.8);
          else if (source.r > source.b * 1.15) diffuseColor.rgb = athleteSkin * clamp(lum / .31, .35, 1.45);
        ` : `
          bool jersey = source.b > source.r * 1.18 && source.b > source.g * 1.10;
          bool upperLeg = (vMapUv.x < .31 || vMapUv.x > .69) && vMapUv.y < .194;
          bool trouser = athleteDenim > .5 && vAthleteRest.z < .90 && vAthleteRest.z > .17;
          // 外套跨越原无袖球衣 / 手臂的 UV 岛；用绑定姿态的手臂位置保持肩部连续，手掌仍保留肤色。
          bool sleeve = athleteStyle > 1.5 && abs(vAthleteRest.x) > .18 && abs(vAthleteRest.x) < .58 && vAthleteRest.z > 1.23 && vAthleteRest.z < 1.58;
          bool urbanLeg = athleteStyle > 1.5 && vAthleteRest.z < .90 && vAthleteRest.z > .15;
          bool torso = abs(vAthleteRest.x) < .25 && vAthleteRest.z > .98 && vAthleteRest.z < 1.56;
          if ((jersey || torso) && athleteStyle > .5 && athleteStyle < 1.5) {
            float front = smoothstep(.01,.06,-vAthleteRest.y);
            float chest = exp(-pow((vAthleteRest.z-1.35)/.09,2.0)) * exp(-pow((abs(vAthleteRest.x)-.10)/.074,2.0));
            float seam = exp(-pow(vAthleteRest.x/.012,2.0)) * exp(-pow((vAthleteRest.z-1.30)/.19,2.0));
            float lowerPec = exp(-pow((vAthleteRest.z-1.285)/.016,2.0)) * exp(-pow((abs(vAthleteRest.x)-.09)/.072,2.0));
            float absFold = exp(-pow((vAthleteRest.z-1.19)/.010,2.0)) + exp(-pow((vAthleteRest.z-1.12)/.010,2.0));
            diffuseColor.rgb = athleteSkin * (.94 + front * (chest*.035 - seam*.06 - lowerPec*.045 - absFold*.025));
          } else if (jersey || sleeve) diffuseColor.rgb = athleteTop * (jersey ? cloth : clamp(lum/.24,.6,1.4));
          else if (upperLeg || trouser || urbanLeg) diffuseColor.rgb = athleteBottom * clamp(lum / (upperLeg ? .60 : .24), .6, 1.45);
          else if (source.r > source.b * 1.12 && source.r > source.g * 1.04) diffuseColor.rgb = athleteSkin * clamp(lum / .30,.35,1.45);
        `}
        #endif`);
      if (!head) shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
        #ifdef USE_MAP
        bool bareTorso = athleteStyle > .5 && athleteStyle < 1.5 && abs(vAthleteRest.x) < .25 && vAthleteRest.z > .98 && vAthleteRest.z < 1.56;
        if (!bareTorso) {
        #include <normal_fragment_maps>
        }
        #else
        #include <normal_fragment_maps>
        #endif`);
    };
    value.customProgramCacheKey = () => "athlete-wardrobe-v1-" + Number(head); value.needsUpdate = true;
  }
}
