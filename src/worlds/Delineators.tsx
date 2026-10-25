import { useEffect, useMemo } from "react";
import { BoxGeometry, type BufferGeometry } from "three";
import Instances, { type Instance } from "./Instances";

// 利用原路标的位置和断面补上黑色识别带、双向反光片，不改变路线、碰撞或路标分布。
export default function Delineators({ items, stem, diamond = false }: { items: Instance[]; stem: BufferGeometry; diamond?: boolean }) {
  const box = useMemo(() => new BoxGeometry(1,1,1), []);
  const detail = useMemo(() => {
    const bands: Instance[] = [], reflectors: Instance[] = [];
    for (const item of items) {
      const yaw = item.rotation?.[1] || 0, height = item.scale[1], bandY = item.position[1] + height * .28;
      bands.push({ position: [item.position[0],bandY,item.position[2]], scale: [item.scale[0]*1.015,.14,item.scale[2]*1.015], rotation: item.rotation });
      for (const side of [0, Math.PI]) {
        const face = side + (diamond ? Math.PI/4 : 0), x = Math.sin(face)*item.scale[0]*(diamond?.35:.5), z = Math.cos(face)*item.scale[2]*(diamond?.35:.5);
        reflectors.push({ position: [item.position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),bandY,item.position[2]-x*Math.sin(yaw)+z*Math.cos(yaw)], scale: [.035,.070,.008], rotation: [0,yaw+face,0], color: side ? "#deded3" : "#c68d4c" });
      }
    }
    return { bands, reflectors };
  }, [items, diamond]);
  useEffect(() => () => box.dispose(), [box]);
  return <group name="metre-scale-road-reflectors">
    <Instances geometry={stem} items={detail.bands} color="#202726" roughness={.88}/>
    <Instances geometry={box} items={detail.reflectors} roughness={.32} metalness={.15}/>
  </group>;
}
