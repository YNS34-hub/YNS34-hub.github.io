import { useLibraryStore } from "../systems/library";
import { projects } from "../content/catalog";
import type { ContentItem, WallpaperItem } from "../content/types";
import { Block, Door, Label } from "../world/primitives";
import { RoomShell } from "./Architecture";
import { ProjectScreen, VisualWall } from "./PersonalRooms";

function asProject(work: WallpaperItem): ContentItem {
  return {
    id: work.id,
    title: work.title,
    subtitle: work.source,
    description: work.description,
    category: "experiment",
    year: work.date,
    status: "VISUAL EXPERIMENT / PRIVATE COLLECTION",
    featured: false,
    roomType: "black-box",
    tags: ["Website study"],
    cover: work.src,
    demo: work.projectUrl,
    github: work.github,
  };
}

/** Real websites form an editorial wall; selected references occupy the adjacent studio. */
export function VisualLab({ roomId }: { roomId: string }) {
  const personal = useLibraryStore((s) => s.personal);
  const base = roomId.split("-page-")[0];
  const page = Math.max(0, (Number(roomId.split("-page-")[1]) || 1) - 1);
  const editorial = base === "editorial";
  const collection = personal.projects.filter(
    (x) => x.category === "liquid-web",
  );
  const works = collection.length
    ? collection.map(asProject)
    : projects.filter((x) => x.cover);
  const references = personal.visuals.filter((x) =>
    ["editorial", "portrait"].includes(x.category),
  );
  const screens = works.slice(page * 5, page * 5 + 5);
  const images = references.slice(page * 5, page * 5 + 5);
  const count = editorial ? references.length : works.length;
  const accent = editorial ? "#e3b34f" : "#67c4d1";
  return (
    <group>
      <RoomShell
        dark
        warm={editorial}
        palette={editorial ? "editorial" : "liquid"}
        width={28}
        depth={34}
        height={12}
      />
      <Label
        text={editorial ? "THE EDITORIAL STUDIO" : "LIQUID WEB / VISUAL LAB"}
        position={[-11, 9.1, -16.5]}
        align="left"
        size={0.62}
        color={editorial ? "#e9c789" : "#aadfe2"}
        maxWidth={24}
      />
      <Label
        text={
          editorial
            ? "JIE TIAN / THINGS THAT CAUGHT MY EYE"
            : "WEBSITES I HAVE KEPT / OPEN A SCREEN TO ENTER"
        }
        position={[-11, 8.2, -16.5]}
        align="left"
        size={0.16}
        color="#a7b7b5"
      />
      {editorial
        ? images.map((work, i) => (
            <VisualWall
              key={work.id}
              item={work}
              position={
                i === 0
                  ? [0, 4.8, -12.5]
                  : [
                      i % 2 ? 11.5 : -11.5,
                      4.7,
                      7 - Math.floor((i - 1) / 2) * 10,
                    ]
              }
              width={i === 0 ? 21 : 9}
              height={i === 0 ? 10 : 7.5}
              rotation={
                i === 0 ? [0, 0, 0] : [0, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0]
              }
            />
          ))
        : screens.map((work, i) => (
            <ProjectScreen
              key={work.id}
              item={work}
              position={
                i === 0
                  ? [0, 5.0, -12.5]
                  : [
                      i % 2 ? 11.5 : -11.5,
                      4.7,
                      7 - Math.floor((i - 1) / 2) * 10,
                    ]
              }
              width={i === 0 ? 21 : 9}
              height={i === 0 ? 10 : 7.5}
              rotation={
                i === 0 ? [0, 0, 0] : [0, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0]
              }
              tint={accent}
            />
          ))}
      <Block
        position={[0, 0.035, -4]}
        scale={[5.2, 0.04, 17]}
        color={editorial ? "#604827" : "#205160"}
        metalness={0.6}
        roughness={0.3}
      />
      {[-7, 7].map((x) => (
        <group key={x}>
          <Block
            position={[x, 1, -1]}
            scale={[0.08, 1.8, 14]}
            color="#416a72"
            opacity={0.38}
            metalness={0.7}
          />
          <Block
            position={[x, 1.95, -1]}
            scale={[0.035, 0.025, 14]}
            color={accent}
            emissive={accent}
            emissiveIntensity={0.65}
          />
        </group>
      ))}
      <pointLight
        position={[0, 7, -7]}
        color={accent}
        intensity={90}
        distance={26}
      />
      <Door
        id={editorial ? "liquid-web" : "editorial"}
        title={editorial ? "The websites" : "The editorial studio"}
        position={[-9, 0, 14.5]}
        rotation={[0, Math.PI, 0]}
        dark
      />
      <Door
        id="atrium"
        title="The Atrium"
        position={[9, 0, 14.5]}
        rotation={[0, Math.PI, 0]}
        dark
      />
      {page > 0 && (
        <Door
          id={page === 1 ? base : `${base}-page-${page}`}
          title="Previous wall"
          position={[-11.5, 0, -10]}
          rotation={[0, Math.PI / 2, 0]}
          dark
        />
      )}
      {(page + 1) * 5 < count && (
        <Door
          id={`${base}-page-${page + 2}`}
          title="More studies"
          position={[0, 0, -16.5]}
          dark
        />
      )}
      {editorial && images.length === 0 && (
        <ProjectScreen
          item={projects.find((x) => x.cover)!}
          position={[0, 5, -12.5]}
          width={21}
          height={10}
          tint={accent}
        />
      )}
    </group>
  );
}
