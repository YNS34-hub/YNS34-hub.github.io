import { allContent, rooms } from "./catalog";
const anomalyNames: Record<string, [string, string]> = {
  mirror: ["MIRROR STUDY", "An echo, held in architecture."],
  gravity: ["ANOTHER ORIENTATION", "The architecture gently changes its mind."],
  floating: ["FLOATING COLLECTION", "A path between two places."],
  compressing: ["SINGLE THOUGHT", "The world narrows around one idea."],
  impossible: ["ROOM WITHIN A ROOM", "There is more room on the inside."],
  loop: ["AGAIN, WITH A DIFFERENCE", "Return. Some things will have changed."],
};
/** UI labels also resolve the addressable rooms generated from content. */
export function roomInfo(id: string) {
  const known = rooms.find((r) => r.id === id);
  if (known) return known;
  const work = allContent.find((item) => `exhibit-${item.id}` === id);
  if (work)
    return {
      id,
      number: "—",
      title: work.title.toUpperCase(),
      subtitle: work.subtitle,
      type: work.roomType,
    };
  const [name, page] = id.split("-page-");
  const wing = rooms.find((r) => r.id === name);
  if (wing && page)
    return { ...wing, id, subtitle: `${wing.subtitle} / Wing ${page}` };
  const rule = id.slice("anomaly-".length);
  if (id.startsWith("anomaly-") && anomalyNames[rule])
    return {
      id,
      number: "—",
      title: anomalyNames[rule][0],
      subtitle: anomalyNames[rule][1],
      type: "anomaly",
    };
  return {
    id,
    number: "—",
    title: "A SECRET MEMORY",
    subtitle: "Some places appear only after you remember.",
    type: "anomaly",
  };
}
