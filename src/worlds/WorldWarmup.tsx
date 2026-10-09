import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Group } from "three";
import { useActivity } from "./activity";
import { warmPrograms } from "./warmPrograms";
import { textureStatus } from "../world/textureCache";

// 仅新目的地使用准备层；旧馆室组件、相机、门槛、返回位置与播放状态不归这里所有。
export default function WorldWarmup({ roomId, children }: { roomId: string; children: ReactNode }) {
  const { gl, camera, scene } = useThree(), { active } = useProgress();
  const root = useRef<Group>(null), job = useRef<ReturnType<typeof warmPrograms> | null>(null);
  useLayoutEffect(() => {
    if (root.current) { root.current.visible = false; root.current.userData.prepared = false; }
    useActivity.setState({ warming: true });
    return () => { job.current?.dispose(); job.current = null; useActivity.setState({ warming: false }); };
  }, [roomId]);
  useFrame(() => {
    if (!root.current || root.current.userData.prepared || active || textureStatus().pending || !scene.environment) return;
    if (!job.current) job.current = warmPrograms(gl, root.current, camera, scene);
    if (job.current.ready()) {
      root.current.visible = true; root.current.userData.prepared = true; useActivity.setState({ warming: false });
    }
  });
  return <group ref={root} name={"prepared-world:" + roomId} visible={false}>{children}</group>;
}
