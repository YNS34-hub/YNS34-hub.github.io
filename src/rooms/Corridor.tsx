import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";
import {
  corridorSeed,
  residentChunks,
  CORRIDOR_SEGMENT_LENGTH as LENGTH,
} from "../world/roomPlan";
import {
  corridorProfile,
  corridorClearWidth,
  type Vector,
} from "../world/spatialLayout";
import { allContent, rooms } from "../content/catalog";
import { usePalaceStore } from "../systems/store";
import { useLibraryStore } from "../systems/library";
import { Block, Door, Label, Floor } from "../world/primitives";
import { VisualWall } from "./PersonalRooms";
type Part = { position: Vector; scale: Vector };
function Batch({
  parts,
  color,
  emissive = 0,
}: {
  parts: Part[];
  color: string;
  emissive?: number;
}) {
  const ref = useRef<InstancedMesh>(null),
    dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (!ref.current) return;
    parts.forEach((p, i) => {
      dummy.position.set(...p.position);
      dummy.scale.set(...p.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts, dummy]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, parts.length]}
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissive}
        roughness={0.72}
      />
    </instancedMesh>
  );
}
const destinations = rooms.filter(
  (x) => !x.hidden && !["cinema", "corridor"].includes(x.id),
);
const anomalies = [
  "mirror",
  "gravity",
  "floating",
  "compressing",
  "impossible",
  "loop",
];
/** A deterministic sequence of throats, tall bays, lateral reveals and a stateful door. Only five addresses are mounted. */
export default function Corridor() {
  const [center, setCenter] = useState(0);
  const chunks = useMemo(() => residentChunks(center * LENGTH), [center]);
  const library = useLibraryStore();
  const visits = usePalaceStore((s) => s.visits);
  const collection = [
    ...library.personal.projects,
    ...library.wallpapers,
    ...library.personal.visuals,
  ];
  const parts = useMemo(() => {
    const walls: Part[] = [],
      roof: Part[] = [],
      edges: Part[] = [],
      glow: Part[] = [];
    for (const c of chunks) {
      const p = corridorProfile(c);
      for (let j = 0; j < 11; j++) {
        const z = c * LENGTH + j * 2 + 1,
          half = corridorClearWidth(z);
        for (const side of [-1, 1]) {
          // A missing mid-wall opens a lit side-depth, rather than another painted plane.
          if (j !== 5)
            walls.push({
              position: [side * (half + 0.35), p.height / 2, z],
              scale: [0.7, p.height, 2.02],
            });
          else {
            walls.push({
              position: [side * (half + 0.35), p.height - 1.15, z],
              scale: [0.7, 2.3, 2],
            });
          }
          edges.push({
            position: [side * (half - 0.02), 0.16, z],
            scale: [0.04, 0.12, 1.96],
          });
        }
        if (p.phase !== 2 && p.phase !== 5)
          roof.push({
            position: [p.wellX, p.height, z],
            scale: [half * 2 - 1.2, 0.36, 2.02],
          });
      }
      const half = p.halfWidth;
      for (const side of [-1, 1]) {
        walls.push({
          position: [side * (half + 3.3), 3.4, c * LENGTH + 11],
          scale: [0.6, 6.8, 7.4],
        });
        for (const end of [-1, 1])
          walls.push({
            position: [side * (half + 1.5), 3.4, c * LENGTH + 11 + end * 3.8],
            scale: [3.5, 6.8, 0.4],
          });
      }
      // The light well actually moves across the section; tall bays have no low roof.
      glow.push({
        position: [p.wellX, p.height + 0.6, c * LENGTH + 11],
        scale: [p.phase === 3 ? 1.2 : 2.4, 0.04, 17],
      });
      if (p.phase === 2 || p.phase === 5)
        for (const z of [3, 11, 19])
          roof.push({
            position: [0, p.height, c * LENGTH + z],
            scale: [half * 2 + 1, 0.5, 0.55],
          });
    }
    return { walls, roof, edges, glow };
  }, [chunks]);
  useFrame(({ camera }) => {
    const next = Math.floor(camera.position.z / LENGTH);
    if (next !== center) setCenter(next);
  });
  return (
    <group>
      <Batch parts={parts.walls} color="#263e54" />
      <Batch parts={parts.roof} color="#10263b" />
      <Batch parts={parts.edges} color="#728c9b" />
      <Batch parts={parts.glow} color="#b8ddec" emissive={0.46} />
      {chunks.map((c) => {
        const p = corridorProfile(c),
          seed = corridorSeed(c),
          z = c * LENGTH + 11;
        const left = destinations[seed % destinations.length];
        const work = allContent[(seed + 3) % allContent.length];
        const anomaly =
          c <= -3 && c >= -8 ? `anomaly-${anomalies[-c - 3]}` : null;
        const remembered = c === -3 && (visits["anomaly-mirror"] || 0) > 0;
        const rightId = remembered
          ? "anomaly-impossible"
          : anomaly || `exhibit-${work.id}`;
        const chosen = collection.length
          ? collection[(Math.abs(c) * 5 + seed) % collection.length]
          : undefined;
        return (
          <group key={c}>
            <group position={[0, 0, z]}>
              <Floor
                width={p.halfWidth * 2 + 6}
                depth={22}
                color={p.phase === 1 ? "#314152" : "#25394b"}
              />
            </group>
            <group scale={[1, p.phase === 1 ? 0.8 : 1, 1]}>
              <Door
                id={left.id}
                title={left.title}
                position={[-p.halfWidth, 0, z]}
                rotation={[0, Math.PI / 2, 0]}
                dark
              />
              <Door
                id={rightId}
                title={
                  remembered
                    ? "ROOM WITHIN A ROOM"
                    : anomaly
                      ? anomaly.slice(8).toUpperCase() + " STUDY"
                      : work.title
                }
                position={[p.halfWidth, 0, z]}
                rotation={[0, -Math.PI / 2, 0]}
                dark
              />
            </group>
            {chosen && (
              <VisualWall
                item={chosen}
                position={[p.nicheSide * (p.halfWidth - 0.15), 3.2, z - 6]}
                rotation={[0, (-p.nicheSide * Math.PI) / 2, 0]}
                width={p.phase === 1 ? 3.1 : 5.7}
                height={p.phase === 1 ? 2.9 : 4.2}
                atmosphere={false}
                medium={p.phase === 1 ? "print" : "screen"}
              />
            )}
            {/* A real stopping niche and an occluding wall give each work a viewing distance. */}
            {p.phase === 2 && (
              <Block
                position={[-p.halfWidth + 1.1, 0.35, z - 6]}
                scale={[0.8, 0.7, 3]}
                color="#40566a"
              />
            )}
            <Label
              text={`${c < 0 ? "−" : "+"}${String(Math.abs(c)).padStart(3, "0")} / ∞`}
              position={[0, 0.025, z + 4]}
              rotation={[-Math.PI / 2, 0, 0]}
              size={0.2}
              color="#a8c9d8"
            />
            {c === -3 && (
              <Label
                text={
                  remembered
                    ? "REVISITED / THE INNER ROOM IS NOW OPEN"
                    : "A SMALL DOOR / A LARGER INTERIOR"
                }
                position={[p.halfWidth - 0.15, 5.65, z]}
                rotation={[0, -Math.PI / 2, 0]}
                size={0.15}
                color="#d4c3a4"
                maxWidth={6}
              />
            )}
          </group>
        );
      })}
      {/* Two lights follow the visible neighborhood, independent of collection size. */}
      <pointLight
        position={[2.3, 5, center * LENGTH + 5]}
        intensity={72}
        color="#c5dfee"
        distance={28}
      />
      <pointLight
        position={[-2, 6, center * LENGTH - 10]}
        intensity={55}
        color="#e6c8a0"
        distance={30}
      />
    </group>
  );
}
