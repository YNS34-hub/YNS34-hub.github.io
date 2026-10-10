import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, Mesh, MeshBasicMaterial } from "three";
import { motionTime, revealProgress } from "./tokens";
import { useQuietMotion } from "./useMotionCue";
import type { ImageTransition } from "./choreography";
import { acquireImage } from "../world/textureCache";
import { usePalaceStore } from "../systems/store";

type Snapshot = { mesh: Mesh; material: MeshBasicMaterial; release: () => void };
function disposeSnapshot(snapshot: Snapshot | undefined) {
  if (!snapshot) return;
  snapshot.mesh.removeFromParent(); snapshot.mesh.geometry.dispose(); snapshot.material.dispose(); snapshot.release();
}

// 原 Picture 与导航保留；只暂存一个离场平面，共用缓存纹理，不增加离屏通道。
export default function ProjectionReveal({ resourceKey, ready, children, variant = "related", source }: {
  resourceKey: string; ready: boolean; children: ReactNode; variant?: ImageTransition; source?: string;
}) {
  const group = useRef<Group>(null);
  const records = useRef<{ material: MeshBasicMaterial; color: Color }[]>([]);
  const age = useRef(1);
  const quiet = useQuietMotion();
  const tier = usePalaceStore(s => s.effectiveQuality);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!source) return;
    const budget = tier === "low" ? 1024 : tier === "medium" ? 1600 : 2560;
    const lease = acquireImage(source, budget, () => setFailed(lease.ready() && !lease.get()));
    setFailed(lease.ready() && !lease.get());
    return lease.release;
  }, [source, tier]);
  const asset = useRef({ source, tier }); asset.current = { source, tier };
  const retained = useRef<Snapshot | undefined>(undefined), outgoing = useRef<Snapshot | undefined>(undefined);
  const shown = useRef("");
  const duration = motionTime.scene / 1000;
  const direction = useRef<ImageTransition>(variant);
  useLayoutEffect(() => {
    records.current = [];
    const root = group.current;
    if (!root) return;
    const picture = root.children.find(object => object.name !== "cinema-outgoing") as Mesh | undefined;
    root.userData.imageFailed = failed;
    if (failed) {
      // 加载失败时不能把上一张图冒充成新作品；恢复原占位，并保留键盘与返回入口。
      disposeSnapshot(outgoing.current); disposeSnapshot(retained.current);
      outgoing.current = undefined; retained.current = undefined; shown.current = "";
      if (picture) picture.visible = true;
      return;
    }
    if (!ready) {
      if (retained.current) {
        disposeSnapshot(outgoing.current); outgoing.current = undefined;
        retained.current.material.opacity = 1;
        root.add(retained.current.mesh);
        if (picture) picture.visible = false;
      }
      return;
    }
    if (picture) picture.visible = true;
    if (shown.current !== resourceKey) {
      disposeSnapshot(outgoing.current); outgoing.current = undefined;
      if (retained.current) {
        if (quiet) disposeSnapshot(retained.current);
        else { outgoing.current = retained.current; root.add(outgoing.current.mesh); }
        retained.current = undefined;
      }
      if (picture?.material instanceof MeshBasicMaterial && picture.material.map && asset.current.source) {
        const material = picture.material.clone();
        material.transparent = true; material.depthWrite = false; material.opacity = 1;
        const mesh = new Mesh(picture.geometry.clone(), material);
        mesh.name = "cinema-outgoing"; mesh.position.copy(picture.position); mesh.position.z += .002;
        mesh.quaternion.copy(picture.quaternion); mesh.scale.copy(picture.scale); mesh.renderOrder = 5;
        mesh.raycast = () => {};
        const budget = asset.current.tier === "low" ? 1024 : asset.current.tier === "medium" ? 1600 : 2560;
        const lease = acquireImage(asset.current.source, budget, () => {});
        retained.current = { mesh, material, release: lease.release };
      }
      shown.current = resourceKey;
    } else retained.current?.mesh.removeFromParent();
    if (quiet) { disposeSnapshot(outgoing.current); outgoing.current = undefined; }
    direction.current = variant;
    group.current?.traverse(object => {
      const material = (object as Mesh).material;
      if (object.name !== "cinema-outgoing" && material instanceof MeshBasicMaterial) records.current.push({ material, color: material.color.clone() });
    });
    age.current = quiet ? duration : 0;
    for (const { material, color } of records.current) material.color.copy(color).multiplyScalar(quiet || outgoing.current ? 1 : 0.82);
    return () => {
      for (const { material, color } of records.current) material.color.copy(color);
      records.current = [];
      group.current?.position.set(0, 0, 0);
    };
  }, [resourceKey, ready, quiet, duration, variant, failed]);
  useLayoutEffect(() => () => {
    disposeSnapshot(outgoing.current); disposeSnapshot(retained.current);
    outgoing.current = undefined; retained.current = undefined;
    shown.current = "";
  }, []);
  useFrame((_, dt) => {
    if (age.current >= duration || !records.current.length) return;
    age.current = document.hidden ? duration : Math.min(duration, age.current + Math.min(dt, 0.1));
    const progress = revealProgress(age.current, duration);
    const value = outgoing.current ? 1 : 0.82 + 0.18 * progress;
    for (const { material, color } of records.current) material.color.copy(color).multiplyScalar(value);
    // 小于画面宽度的千分之三；不改投影平面的比例、UV 或观看位置，结束精确归零。
    const drift = .06 * (1 - revealProgress(age.current, duration));
    if (group.current) group.current.position.set(direction.current === "landscape" || direction.current === "related" ? drift : 0, direction.current === "portrait" ? -drift : 0, 0);
    if (outgoing.current) {
      outgoing.current.material.opacity = 1 - progress;
      if (age.current >= duration) { disposeSnapshot(outgoing.current); outgoing.current = undefined; }
    }
  });
  return <group ref={group} name="cinema-projection">{children}</group>;
}
