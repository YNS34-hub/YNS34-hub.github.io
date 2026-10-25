import { useState } from "react";
import { archive, experiments, allContent } from "../content/catalog";
import { ArchiveArchitecture, ResearchArchitecture } from "./Architecture";
import { ProjectScreen, VisualWall } from "./PersonalRooms";
import {
  Block,
  Door,
  Label,
  Picture,
  ContactShadow,
} from "../world/primitives";
import { usePalaceStore } from "../systems/store";
import { useLibraryStore } from "../systems/library";
import { orderedWorks } from "../world/spatialLayout";
import { websiteStudy } from "../content/websiteStudy";
export function ArchiveRoom({ unfinished = false }: { unfinished?: boolean }) {
  const works = unfinished ? experiments : archive;
  return (
    <group>
      <ArchiveArchitecture unfinished={unfinished} />
      {works.slice(0, 5).map((work, i) => (
        <group
          key={work.id}
          position={[i % 2 ? 7.6 : -7.6, 0, 5 - Math.floor(i / 2) * 7]}
          rotation={[0, i % 2 ? -0.3 : 0.3, 0]}
          onClick={(e) => {
            if (e.delta < 5) {
              e.stopPropagation();
              usePalaceStore.getState().focusItem(work);
            }
          }}
        >
          <ContactShadow width={6.6} depth={2.7} opacity={0.35} />
          <Block
            position={[0, 0.9, 0]}
            scale={[5.8, 1.8, 1]}
            color={unfinished ? "#354d62" : "#536458"}
            roughness={0.8}
          />
          <Block
            position={[0, 3.4, 0]}
            scale={[5.8, 3.15, 0.24]}
            color={unfinished ? "#607e93" : "#a5ac91"}
            roughness={0.5}
          />
          {work.cover ? (
            <Picture
              src={work.cover}
              width={5.5}
              height={2.9}
              position={[0, 3.4, 0.15]}
              medium={unfinished ? "screen" : "print"}
            />
          ) : (
            <Label
              text={work.title}
              position={[0, 3.5, 0.18]}
              size={0.26}
              maxWidth={5}
              color="#dae5e5"
            />
          )}
          <Label
            text={work.title}
            position={[0, 1.45, 0.55]}
            size={0.2}
            maxWidth={5}
            color="#ebdfc6"
          />
          <Label
            text={
              work.tags.includes("Fork")
                ? "REFERENCE / UPSTREAM AUTHORSHIP"
                : work.status
            }
            position={[0, 1.1, 0.55]}
            size={0.12}
            maxWidth={5}
            color="#bbc9be"
          />
        </group>
      ))}
      <Label
        text={
          unfinished
            ? "OPEN STUDIES / CURRENT STAGE ON EACH WORK"
            : "SOURCE DOCUMENTS / REFERENCES / SHARED METHODS"
        }
        position={[0, 7.5, unfinished ? -11.6 : -15.6]}
        color="#c9d3c5"
        size={0.24}
        maxWidth={18}
      />
      <pointLight
        position={[-5, 6, 3]}
        intensity={100}
        color={unfinished ? "#b9d6ed" : "#ecd7b1"}
        distance={24}
      />
      <pointLight
        position={[8, 4, -5]}
        intensity={60}
        color={unfinished ? "#759fc4" : "#c4cfc0"}
        distance={20}
      />
      <Door
        id={unfinished ? "archive" : "unfinished"}
        title={unfinished ? "Source archive" : "Open studies"}
        position={[0, 0, unfinished ? -11.4 : -15.5]}
        dark
      />
      <Door
        id="atrium"
        title="The Atrium"
        position={[10, 0, unfinished ? 11.3 : 14.6]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group>
  );
}
export function CollectionRoom() {
  const library = useLibraryStore(),
    bookmarks = usePalaceStore((s) => s.bookmarks);
  const [page, setPage] = useState(0);
  const images = orderedWorks(
    [
      ...library.wallpapers,
      ...library.personal.visuals,
      ...library.personal.projects,
      ...library.personal.research,
    ].filter((x) => x.favorite),
  );
  const unique = images.filter(
    (x, i, all) =>
      all.findIndex((y) => (y.fileName || y.src) === (x.fileName || x.src)) ===
      i,
  );
  const keptProjects = bookmarks
    .slice()
    .reverse()
    .map(
      (id) =>
        allContent.find((x) => x.id === id) ||
        library.personal.projects
          .filter((x) => x.category === "liquid-web")
          .map(websiteStudy)
          .find((x) => x.id === id),
    )
    .filter((x): x is import("../content/types").ContentItem => !!x);
  const pages = Math.max(
    1,
    Math.ceil(unique.length / 5),
    Math.ceil(keptProjects.length / 2),
  );
  const safePage = Math.min(page, pages - 1);
  const works = unique.slice(safePage * 5, safePage * 5 + 5),
    projects = keptProjects.slice(safePage * 2, safePage * 2 + 2),
    tracks = library.music.filter((x) => x.favorite);
  return (
    <group>
      <ResearchArchitecture />
      <Block
        position={[0, 0.7, -1.5]}
        scale={[8, 1.4, 3.2]}
        color="#294652"
        roughness={0.6}
      />
      <ContactShadow
        position={[0, 0.01, -1.5]}
        width={9.7}
        depth={4.5}
        opacity={0.3}
      />
      {works.map((work, i) => (
        <group
          key={work.id}
          position={
            i === 0
              ? [0, 0, -12]
              : [i % 2 ? -9.5 : 9.5, 0, 7 - Math.floor((i - 1) / 2) * 12]
          }
          rotation={[0, i === 0 ? 0 : i % 2 ? 0.4 : -0.4, 0]}
        >
          <Block
            position={[0, 3.6, -0.16]}
            scale={[i === 0 ? 10.5 : 5.8, 7.2, 0.35]}
            color="#293f4d"
          />
          <VisualWall
            item={work}
            position={[0, i === 0 ? 4.3 : 3.5, 0.12]}
            width={i === 0 ? 10 : 5.4}
            height={i === 0 ? 6.5 : 5.8}
            atmosphere={false}
          />
        </group>
      ))}
      {projects.slice(0, 2).map((work, i) => (
        <ProjectScreen
          key={work.id}
          item={work}
          position={[i ? 8 : -8, 4, -7]}
          width={5.4}
          height={3.2}
          rotation={[0, i ? -0.2 : 0.2, 0]}
        />
      ))}
      <group
        onClick={(e) => {
          e.stopPropagation();
          usePalaceStore.getState().setOverlay("player");
        }}
      >
        <Label
          text={
            tracks.length
              ? tracks
                  .slice(0, 3)
                  .map((x) => `${x.artist} — ${x.title}`)
                  .join("\n")
              : "LISTENING PREFERENCES / 梁博"
          }
          position={[0, 1.7, -1.4]}
          size={0.22}
          color="#d9c3a3"
          maxWidth={7}
        />
      </group>
      <Label
        text={
          unique.length
            ? `${unique.length} KEPT WORKS / YOUR ARRANGEMENT`
            : "COLLECT A WORK TO PLACE IT HERE"
        }
        position={[0, 7.3, -15.4]}
        size={0.3}
        color="#c8e0e9"
      />
      {pages > 1 && (
        <group
          position={[0, 0, 5.5]}
          onClick={(e) => {
            e.stopPropagation();
            setPage((p) => (p + 1) % pages);
          }}
        >
          <Block
            position={[0, 0.6, 0]}
            scale={[2.3, 1.2, 0.7]}
            color="#567380"
          />
          <Label
            text="NEXT KEPT WORKS →"
            position={[0, 1.5, 0.4]}
            size={0.15}
            color="#e1f0f4"
          />
        </group>
      )}
      <pointLight
        position={[0, 6, 0]}
        intensity={70}
        color="#c2dfeb"
        distance={24}
      />
      <Door
        id="atrium"
        title="The Atrium"
        position={[10, 0, 14.6]}
        rotation={[0, Math.PI, 0]}
        dark
      />
    </group>
  );
}
