import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { BoxGeometry, Color, Mesh, MeshBasicMaterial, PMREMGenerator, Scene } from "three";

export default function RoomRadiance({ room }: { room: "research" | "music" | "projects" | "wallpapers" }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const previous = scene.environment, probe = new Scene(), geometry = new BoxGeometry(), materials: MeshBasicMaterial[] = [];
    probe.background = new Color("#242d37");
    const panel = (position: [number, number, number], scale: [number, number, number], color: string, energy = 1) => {
      const material = new MeshBasicMaterial({ color, toneMapped: false }); material.color.multiplyScalar(energy); materials.push(material);
      const box = new Mesh(geometry, material); box.position.set(...position); box.scale.set(...scale); probe.add(box);
    };
    panel([0, -3.8, 0], [30, .2, 35], room === "projects" ? "#79634e" : "#6a737c");
    panel([0, 6.5, 0], [30, .2, 35], "#282e35");
    panel([0, 1, -16.5], [28, 12, .2], room === "music" ? "#574435" : "#434e59");
    panel([-13.7, 1, 0], [.2, 12, 34], room === "music" ? "#75604b" : "#606a73");
    panel([13.7, 1, 0], [.2, 12, 34], room === "music" ? "#75604b" : "#606a73");
    if (room === "research") {
      panel([13.4, 2.5, -1.8], [.1, 6.9, 17.2], "#c7e1f6", 3.5);
      panel([7.5, 1, 4], [4.5, .06, .1], "#ffe2b4", 3);
    } else if (room === "music") {
      panel([-4, 5.7, -4], [2.3, .08, 10], "#ffe3ba", 2.8);
      panel([4, 5.7, -4], [2.3, .08, 10], "#f3e3cd", 2.8);
      panel([0, 1, 14], [7, 7, .1], "#b8d2e8", 1.8);
    } else panel([0, 7, -1], [5.1, .08, 30], "#dbeaf7", 3.2);
    const generator = new PMREMGenerator(gl), target = generator.fromScene(probe, .055); target.texture.name = "architectural-radiance:" + room;
    generator.dispose(); geometry.dispose(); materials.forEach(material => material.dispose());
    scene.environment = target.texture;
    return () => { if (scene.environment === target.texture) scene.environment = previous; target.dispose(); };
  }, [gl, scene, room]);
  return null;
}
