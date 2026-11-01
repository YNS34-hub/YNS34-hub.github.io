import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

export function createMemoryRibbon() {
  const sections = 192, sides = 12, radius = 3.12, halfDepth = .055;
  const vertices: number[] = [], indices: number[] = [];
  const center = new Vector3(), tangent = new Vector3(), radial = new Vector3(), widthAxis = new Vector3();
  for (let i = 0; i <= sections; i++) {
    const t = i / sections, phi = Math.PI * (.06 + .88 * t), theta = Math.PI * 4 * t + .3;
    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
    center.set(sinPhi * cosTheta, cosPhi, sinPhi * sinTheta).multiplyScalar(radius);
    radial.copy(center).normalize();
    tangent.set(.88 * Math.PI * cosPhi * cosTheta - 4 * Math.PI * sinPhi * sinTheta, -.88 * Math.PI * sinPhi, .88 * Math.PI * cosPhi * sinTheta + 4 * Math.PI * sinPhi * cosTheta).normalize();
    widthAxis.crossVectors(tangent, radial).normalize();
    const halfWidth = (.18 + 1.22 * Math.sin(Math.PI * t) ** .8) / 2;
    // 圆滑椭圆截面形成实际玻璃厚边，尖端收束；仍完全落在原台座半径以内。
    for (let corner = 0; corner < sides; corner++) {
      const angle = corner / sides * Math.PI * 2, width = Math.cos(angle) * halfWidth, depth = Math.sin(angle) * halfDepth;
      vertices.push(center.x + widthAxis.x * width + radial.x * depth, center.y + widthAxis.y * width + radial.y * depth, center.z + widthAxis.z * width + radial.z * depth);
    }
    if (i === sections) continue;
    for (let corner = 0; corner < sides; corner++) {
      const a = i * sides + corner, b = i * sides + (corner + 1) % sides, c = a + sides, d = b + sides;
      indices.push(a, c, b, c, d, b);
    }
  }
  const end = sections * sides;
  for (let corner = 1; corner < sides - 1; corner++) indices.push(0, corner, corner + 1, end, end + corner + 1, end + corner);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
