import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Object3D, Vector3, Raycaster, Mesh, type Intersection, type Material } from "three";
import { lyricProjection as projection } from "../systems/spatialLyrics";
import { usePalaceStore } from "../systems/store";
import { Block } from "../world/primitives";

const cameraSigns = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];
const surfaceSigns = [0.01, 0.01, 0.01, 1, -0.01, -0.01, -0.01, -1, 0.01, 0.01, 0.01, 1, 1, 1, 1, 1];
function cssMatrix(matrix: Matrix4, signs: number[]) {
  return `matrix3d(${matrix.elements.map((value, i) => Math.abs(value) < 1e-10 ? 0 : value * signs[i]).join(",")})`;
}

/** A physical surface with a camera-matched, perspective-correct DOM projection. */
export default function LyricsWall() {
  const anchor = useRef<Object3D>(null);
  const { camera, size, scene } = useThree();
  const previous = useMemo(() => ({ camera: new Matrix4(), world: new Matrix4(), position: new Vector3(), facing: new Vector3(), view: new Vector3(), ray: new Raycaster(), hits: [] as Intersection[], initialized: false, width: 0, height: 0, root: null as HTMLDivElement | null }), []);
  useFrame(() => {
    const { root, camera: cameraElement, surface } = projection;
    if (!anchor.current || !root || !cameraElement || !surface) return;
    camera.updateMatrixWorld();
    anchor.current.updateWorldMatrix(true, false);
    if (previous.initialized && previous.root === root && previous.width === size.width && previous.height === size.height && previous.camera.equals(camera.matrixWorldInverse) && previous.world.equals(anchor.current.matrixWorld)) return;
    previous.initialized = true; previous.root = root;
    previous.width = size.width; previous.height = size.height;
    previous.camera.copy(camera.matrixWorldInverse); previous.world.copy(anchor.current.matrixWorld);
    anchor.current.getWorldPosition(previous.position);
    previous.facing.set(0, 0, 1).transformDirection(anchor.current.matrixWorld);
    previous.view.copy(camera.position).sub(previous.position);
    const distance = previous.view.length();
    let front = previous.facing.dot(previous.view) > 0 && previous.position.applyMatrix4(camera.matrixWorldInverse).z < -0.1;
    if (front) {
      previous.ray.set(camera.position, previous.view.negate().normalize());
      previous.ray.far = Math.max(0, distance - 0.2);
      previous.hits.length = 0;
      previous.ray.intersectObjects(scene.children, true, previous.hits);
      front = !previous.hits.some(hit => {
        if (!(hit.object instanceof Mesh) || !hit.object.visible) return false;
        const material = (Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material) as Material & { transmission?: number };
        return material && material.opacity >= 0.8 && (material.transmission || 0) < 0.5;
      });
    }
    root.style.visibility = front ? "visible" : "hidden";
    const fov = camera.projectionMatrix.elements[5] * size.height / 2;
    root.style.perspective = `${fov}px`;
    cameraElement.style.transform = `translateZ(${fov}px)${cssMatrix(camera.matrixWorldInverse, cameraSigns)}translate(${size.width / 2}px,${size.height / 2}px)`;
    surface.style.transform = `translate(-50%,-50%)${cssMatrix(anchor.current.matrixWorld, surfaceSigns)}`;
  });
  return (
    <group position={[6.8, 4.4, -10.3]} rotation={[0, -0.45, 0]} name="listening-lyrics-wall" onClick={event => { if (event.delta < 5) { event.stopPropagation(); usePalaceStore.getState().setOverlay("player"); } }}>
      <Block scale={[6.9, 4.15, 0.22]} color="#152537" roughness={0.8} />
      <Block position={[0, -2.08, 0.02]} scale={[6.9, 0.035, 0.25]} color="#a79175" metalness={0.5} />
      <object3D ref={anchor} position={[0, 0, 0.14]} />
    </group>
  );
}
