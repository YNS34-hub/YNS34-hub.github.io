import { Suspense } from "react";
import { useLibraryStore } from "../systems/library";
import { usePalaceStore } from "../systems/store";
import { worksForRoom } from "../systems/mediaPlacement";
import { imageLayout } from "../world/spatialLayout";
import { GlassSculpture } from "../world/GlassSculpture";
import { Block, Door, Label, ContactShadow } from "../world/primitives";
import { ImageArchitecture, ObservatoryArchitecture } from "./Architecture";
import { VisualWall } from "./PersonalRooms";

function RoomLinks({
  base,
  page,
  count,
}: {
  base: string;
  page: number;
  count: number;
}) {
  return (
    <>
      <Door
        id="atrium"
        title="The Atrium"
        position={[10, 0, 14.6]}
        rotation={[0, Math.PI, 0]}
        dark
      />
      {page > 0 && (
        <Door
          id={page === 1 ? base : `${base}-page-${page}`}
          title="Previous works"
          position={[-10, 0, 14.6]}
          rotation={[0, Math.PI, 0]}
          dark
        />
      )}
      {(page + 1) * 5 < count && (
        <Door
          id={`${base}-page-${page + 2}`}
          title="Further works"
          position={[0, 0, -16]}
          dark
        />
      )}
    </>
  );
}
export function WallpaperVault() {
  const room = usePalaceStore((s) => s.roomId),
    library = useLibraryStore();
  const base = room.split("-page-")[0],
    page = Math.max(0, (Number(room.split("-page-")[1]) || 1) - 1);
  const works = worksForRoom(
      [...library.wallpapers, ...library.personal.visuals],
      base,
    ),
    selected = works.slice(page * 5, page * 5 + 5),
    placements = imageLayout(selected);
  return (
    <group>
      <ImageArchitecture placements={placements} />
      {placements.map((p, i) => (
        <VisualWall
          key={p.id}
          item={selected[i]}
          position={p.position}
          rotation={p.rotation}
          width={p.width}
          height={p.height}
        />
      ))}
      <spotLight
        position={[-7, 9, 8]}
        target-position={[0, 3, -10]}
        color="#edf5ff"
        intensity={125}
        angle={0.65}
        penumbra={1}
        distance={28}
      />
      <pointLight
        position={[8, 4, 4]}
        color="#9abdd5"
        intensity={45}
        distance={20}
      />
      <RoomLinks base={base} page={page} count={works.length} />
    </group>
  );
}
export function ImageRoom({ roomId }: { roomId: string }) {
  const library = useLibraryStore();
  const base = roomId.split("-page-")[0],
    page = Math.max(0, (Number(roomId.split("-page-")[1]) || 1) - 1);
  const works = worksForRoom(library.personal.visuals, base),
    selected = works.slice(page * 5, page * 5 + 5);
  const portrait = base === "portraits",
    glass = base === "glass-life",
    cosmic = base === "cosmic" || base === "imagined-worlds";
  const placements = imageLayout(selected, portrait || glass);
  return (
    <group>
      {cosmic ? (
        <ObservatoryArchitecture />
      ) : (
        <ImageArchitecture
          placements={
            glass
              ? placements.slice(0, 2).map((x, i) => ({
                  ...x,
                  position: [i ? 8 : -8, 3.8, -8] as [number, number, number],
                  width: 5,
                  height: 4.2,
                }))
              : placements
          }
          intimate={portrait}
        />
      )}
      {cosmic ? (
        selected.map((work, i) => (
          <VisualWall
            key={work.id}
            item={work}
            position={
              i === 0
                ? [0, 8.2, -36]
                : [i % 2 ? -9 : 9, 3.5, 2 - Math.floor(i / 2) * 10]
            }
            width={i === 0 ? 29 : 5.6}
            height={i === 0 ? 16.3 : 5.2}
            rotation={[0, i === 0 ? 0 : i % 2 ? 0.22 : -0.22, 0]}
            atmosphere={i !== 0}
          />
        ))
      ) : glass ? (
        <>
          <ContactShadow
            position={[0, 0.02, -3]}
            width={7}
            depth={7}
            opacity={0.5}
          />
          <Block
            position={[0, 0.32, -3]}
            scale={[5.4, 0.64, 5.4]}
            color="#bbdce8"
            metalness={0.12}
            roughness={0.2}
          />
          <group position={[0, 2.7, -3]} rotation={[0.15, 1.7, -0.1]}>
            <Suspense fallback={null}>
              <GlassSculpture radius={1.85} />
            </Suspense>
          </group>
          {selected.slice(0, 2).map((work, i) => (
            <VisualWall
              key={work.id}
              item={work}
              position={[i ? 8 : -8, 3.8, -8]}
              width={5}
              height={4.2}
              rotation={[0, i ? -0.3 : 0.3, 0]}
              medium="print"
              atmosphere={false}
            />
          ))}
          <Label
            text="GLASS / VOLUMETRIC STUDY"
            position={[0, 6.5, -15]}
            size={0.32}
            color="#b2dcec"
          />
        </>
      ) : (
        placements.map((p, i) => (
          <VisualWall
            key={p.id}
            item={selected[i]}
            position={p.position}
            rotation={p.rotation}
            width={p.width}
            height={p.height}
            medium="print"
            atmosphere={false}
          />
        ))
      )}
      <spotLight
        position={[-6, 9, 6]}
        target-position={[0, 3, -5]}
        color={cosmic ? "#b8d5ff" : "#f6f9fc"}
        intensity={cosmic ? 95 : 220}
        angle={0.62}
        penumbra={0.7}
        distance={32}
      />
      <pointLight
        position={[8, 4, 0]}
        color={portrait ? "#e9c8a1" : glass ? "#b5e8ef" : "#e6b891"}
        intensity={portrait ? 55 : 45}
        distance={22}
      />
      {base === "imagined-worlds" && (
        <>
          <Door
            id="cosmic"
            title="Distant worlds"
            position={[-10, 0, -12]}
            dark
          />
          <Door
            id="glass-life"
            title="Glass life"
            position={[10, 0, -12]}
            dark
          />
          <Door
            id="portraits"
            title="Portraits"
            position={[-12, 0, 7]}
            rotation={[0, Math.PI / 2, 0]}
            dark
          />
        </>
      )}
      <RoomLinks base={base} page={page} count={works.length} />
    </group>
  );
}
