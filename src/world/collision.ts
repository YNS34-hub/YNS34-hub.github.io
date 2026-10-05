import { MathUtils, Vector3 } from "three";
import { resolveRoomPlan } from "./roomPlan";
import { corridorClearWidth, corridorProfile } from "./spatialLayout";

export type Footprint =
  | { x: number; z: number; radius: number }
  | { x: number; z: number; halfWidth: number; halfDepth: number };
const CLEARANCE = 0.3;

export function roomBounds(roomId: string): [number, number, number, number] {
  const plan = resolveRoomPlan(roomId);
  if (roomId === "atrium") return [-20.7, 20.7, -24.4, 25];
  if (roomId === "corridor") return [-6.1, 6.1, -Infinity, Infinity];
  if (plan.rule === "floating") return [-1.3, 1.3, -15.6, 15.6];
  if (plan.rule === "gravity") return [-8.5, 8.5, -15.6, 15.6];
  if (plan.rule === "impossible") return [-25.5, 25.5, -24.6, 24.6];
  if (roomId === "cinema") return [-12.4, 12.4, -14.8, 16];
  if (roomId === "unfinished") return [-12.4, 12.4, -11.1, 11.5];
  if (["cosmic", "imagined-worlds"].includes(roomId.split("-page-")[0]))
    return [-12.4, 12.4, -25.6, 15.6];
  return [-12.4, 12.4, -15.6, 15.6];
}

export function roomFootprints(roomId: string): Footprint[] {
  const plan = resolveRoomPlan(roomId);
  if (roomId === "atrium") return [{ x: 0, z: 0, radius: 3.8 }];
  if (["cosmic", "imagined-worlds"].includes(roomId.split("-page-")[0]))
    return [-1, 1].flatMap((side) => [
      { x: side * 6.7, z: 1, halfWidth: 0.8, halfDepth: 0.9 },
      { x: side * 8.4, z: -21.5, halfWidth: 4.7, halfDepth: 5 },
    ]);
  if (roomId === "music")
    return [
      { x: 0, z: -5, halfWidth: 4.1, halfDepth: 1.95 },
      { x: -4, z: 6.5, halfWidth: 2.7, halfDepth: 0.95 },
    ];
  if (roomId === "projects")
    return [
      { x: -2.5, z: -8, halfWidth: 8.3, halfDepth: 1.4 },
      { x: 6.8, z: -10, halfWidth: 0.55, halfDepth: 4.8 },
    ];
  if (roomId === "glass-life")
    return [
      { x: 0, z: -3, halfWidth: 3, halfDepth: 3 },
      ...[-8, 8].map((x) => ({ x, z: -8.3, halfWidth: 3.1, halfDepth: 0.75 })),
    ];
  if (roomId === "archive" || roomId === "unfinished")
    return Array.from({ length: roomId === "archive" ? 3 : 5 }, (_, i) => ({
      x: i % 2 ? 7.6 : -7.6,
      z: 5 - Math.floor(i / 2) * 7,
      halfWidth: 3.3,
      halfDepth: 1.7,
    }));
  if (roomId === "research")
    return [{ x: -3.4, z: -4, halfWidth: 3.8, halfDepth: 3.8 }];
  if (roomId === "my-collection")
    return [{ x: 0, z: -2, halfWidth: 4.8, halfDepth: 2 }];
  if (
    ["liquid-web", "editorial", "experiments"].includes(
      roomId.split("-page-")[0],
    )
  )
    return [];
  if (
    [
      "archive",
      "unfinished",
      "imagined-worlds",
      "cosmic",
      "glass-life",
      "portraits",
    ].includes(roomId) ||
    roomId.includes("-page-") ||
    roomId.startsWith("wallpapers")
  )
    return [];
  if (plan.type === "listening")
    return [
      { x: 6.2, z: 4.6, halfWidth: 2.3, halfDepth: 0.85 },
      { x: 0, z: -3.8, halfWidth: 3.05, halfDepth: 1.6 },
      ...[-6.8, 6.8].map((x) => ({
        x,
        z: -10.6,
        halfWidth: 1.15,
        halfDepth: 1.0,
      })),
      { x: -12.25, z: -3.5, halfWidth: 0.6, halfDepth: 3.5 },
    ];
  if (plan.rule === "impossible")
    return [
      { x: -9.5, z: 11, halfWidth: 7.8, halfDepth: 0.68 },
      { x: 9.5, z: 11, halfWidth: 7.8, halfDepth: 0.68 },
    ];
  if (
    plan.rule === "floating" ||
    plan.rule === "gravity" ||
    roomId === "corridor" ||
    roomId === "cinema"
  )
    return [];
  if (plan.rule === "memory")
    return [-4, 0, 4].map((x) => ({ x, z: -6, radius: 0.65 }));
  if (plan.type === "image-gallery" || roomId.startsWith("wallpapers"))
    return [{ x: 0, z: -1, halfWidth: 2.7, halfDepth: 1.05 }];
  if (roomId.startsWith("archive"))
    return Array.from({ length: 6 }, (_, i) => ({
      x: i % 2 ? 8 : -8,
      z: 6.7 - Math.floor(i / 2) * 8.3,
      halfWidth: 2.7,
      halfDepth: 1.95,
    }));
  if (
    roomId.startsWith("projects") ||
    roomId.startsWith("research") ||
    roomId.startsWith("experiments") ||
    plan.type === "installation"
  ) {
    const footprints: Footprint[] = [
      ...(roomId.startsWith("projects")
        ? [{ x: 0, z: -4.8, halfWidth: 4.9, halfDepth: 1.2 }]
        : [
            {
              x: 0,
              z: -3,
              radius: roomId.startsWith("experiments") ? 3.55 : 3.3,
            },
          ]),
    ];
    if (roomId.startsWith("research"))
      footprints.push(
        ...[7, -4].map((z) => ({ x: 0, z, halfWidth: 2.2, halfDepth: 0.65 })),
      );
    if (roomId.startsWith("projects") || roomId.startsWith("experiments"))
      footprints.push(
        ...Array.from({ length: 6 }, (_, i) => ({
          x: i % 2 ? 10 : -10,
          z: 7.1 - Math.floor(i / 2) * 8.7,
          halfWidth: 1.35,
          halfDepth: 3.15,
        })),
      );
    return footprints;
  }
  return plan.item && !plan.rule
    ? [{ x: 0, z: -9, halfWidth: 3.1, halfDepth: 0.7 }]
    : [];
}

/** Furniture footprints are expanded by eye-camera clearance, without rigid-body overhead. */
export function keepClear(
  position: Vector3,
  roomId: string,
  footprints = roomFootprints(roomId),
) {
  for (const obstacle of footprints) {
    const dx = position.x - obstacle.x,
      dz = position.z - obstacle.z;
    if ("radius" in obstacle) {
      const distance = Math.hypot(dx, dz);
      if (distance < obstacle.radius) {
        position.x =
          obstacle.x + (distance > 0.001 ? dx / distance : 1) * obstacle.radius;
        position.z =
          obstacle.z + (distance > 0.001 ? dz / distance : 0) * obstacle.radius;
      }
    } else if (
      Math.abs(dx) < obstacle.halfWidth &&
      Math.abs(dz) < obstacle.halfDepth
    ) {
      if (obstacle.halfWidth - Math.abs(dx) < obstacle.halfDepth - Math.abs(dz))
        position.x = obstacle.x + (dx < 0 ? -1 : 1) * obstacle.halfWidth;
      else position.z = obstacle.z + (dz < 0 ? -1 : 1) * obstacle.halfDepth;
    }
  }
  const [minX, maxX, minZ, maxZ] = roomBounds(roomId);
  position.x = MathUtils.clamp(position.x, minX, maxX);
  position.z = MathUtils.clamp(position.z, minZ, maxZ);
  if (roomId === "corridor") {
    const chunk = Math.floor(position.z / 22),
      local = position.z - chunk * 22,
      wallSample = chunk * 22 + Math.floor(local / 2) * 2 + 1;
    const width =
      Math.min(corridorClearWidth(position.z), corridorClearWidth(wallSample)) -
      0.3;
    position.x = MathUtils.clamp(position.x, -width, width);
    const profile = corridorProfile(chunk),
      benchX = -profile.halfWidth + 1.1,
      benchZ = chunk * 22 + 5;
    if (
      profile.phase === 2 &&
      Math.abs(position.x - benchX) < 0.7 &&
      Math.abs(position.z - benchZ) < 1.8
    )
      position.x = benchX + 0.7;
  }
  if (roomId === "atrium" && position.z > 15)
    position.x = MathUtils.clamp(position.x, -3.24, 3.24);
  if (roomId === "music" && position.z < 7) {
    const dx = position.x,
      dz = position.z + 4,
      r = Math.hypot(dx, dz);
    if (r > 11.4) {
      position.x = (dx / r) * 11.4;
      position.z = (dz / r) * 11.4 - 4;
    }
  }
  if (resolveRoomPlan(roomId).rule === "compressing") {
    const progress = MathUtils.clamp((10 - position.z) / 24, 0, 1);
    const halfWidth = 9.45 - progress * 7.3;
    position.x = MathUtils.clamp(position.x, -halfWidth, halfWidth);
  }
  position.y = 1.65;
}

/** A temporary waypoint leads around a blocking object, then resumes the original destination. */
export function tourWaypoint(
  from: Vector3,
  target: Vector3,
  obstacles: Footprint[],
  result: Vector3,
) {
  const directionX = target.x - from.x,
    directionZ = target.z - from.z;
  const length = Math.hypot(directionX, directionZ);
  result.copy(target);
  if (length < 0.05) return result;
  const nx = directionX / length,
    nz = directionZ / length;
  let nearest = Infinity;
  for (const obstacle of obstacles) {
    const radius =
      "radius" in obstacle
        ? obstacle.radius
        : Math.hypot(obstacle.halfWidth, obstacle.halfDepth);
    const dx = obstacle.x - from.x,
      dz = obstacle.z - from.z;
    const along = dx * nx + dz * nz;
    const lateral = dx * -nz + dz * nx;
    if (
      along < -0.05 ||
      along > length ||
      Math.abs(lateral) > radius + CLEARANCE ||
      along > nearest
    )
      continue;
    nearest = along;
    // Deterministic side choice prevents oscillation when a target is directly behind the core.
    const side = lateral > 0.03 ? -1 : 1;
    result.set(
      obstacle.x - nz * side * (radius + 0.75) - nx * 0.35,
      1.65,
      obstacle.z + nx * side * (radius + 0.75) - nz * 0.35,
    );
  }
  return result;
}
