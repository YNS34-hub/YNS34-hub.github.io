import { allContent, rooms } from "../content/catalog";
import type {
  ContentItem,
  RoomDefinition,
  RoomRule,
  RoomType,
} from "../content/types";

export interface RoomPlan {
  id: string;
  type: RoomType;
  rule?: RoomRule;
  title: string;
  subtitle: string;
  number: string;
  item?: ContentItem;
  definition?: RoomDefinition;
  dark: boolean;
}

/** Content owns a room's architecture. IDs are stable; titles never act as addresses. */
export function resolveRoomPlan(id: string): RoomPlan {
  const baseId = id.split("-page-")[0];
  const definition = rooms.find((room) => room.id === baseId);
  const item = id.startsWith("exhibit-")
    ? allContent.find((work) => `exhibit-${work.id}` === id)
    : undefined;
  const rule =
    item?.roomRule ||
    definition?.rule ||
    (id.startsWith("anomaly-") ? (id.slice(8) as RoomRule) : undefined);
  const type =
    item?.roomType || definition?.type || (rule ? "anomaly" : "white-cube");
  return {
    id,
    type,
    rule,
    definition,
    item,
    title:
      item?.title ||
      definition?.title ||
      (id.startsWith("anomaly-")
        ? `${id.slice(8).toUpperCase()} STUDY`
        : "THE COLLECTION"),
    subtitle:
      item?.subtitle ||
      definition?.subtitle ||
      "A room within the living archive.",
    number: definition?.number || "—",
    dark:
      type === "black-box" ||
      type === "listening" ||
      rule === "mirror" ||
      rule === "floating" ||
      rule === "memory" ||
      id.startsWith("experiments") ||
      id.startsWith("archive") ||
      [
        "projects",
        "research",
        "wallpapers",
        "imagined-worlds",
        "cosmic",
        "glass-life",
        "portraits",
        "unfinished",
        "my-collection",
      ].includes(baseId) ||
      id === "cinema",
  };
}

/** Splitmix-style integer hash, including signed addresses on both sides of the atrium. */
export function corridorSeed(chunk: number): number {
  let value = Math.imul(chunk ^ 0x2f4a7c15, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export const CORRIDOR_SEGMENT_LENGTH = 22;
export function residentChunks(positionZ: number): number[] {
  const center = Math.floor(positionZ / CORRIDOR_SEGMENT_LENGTH);
  return Array.from({ length: 5 }, (_, i) => center + i - 2);
}
