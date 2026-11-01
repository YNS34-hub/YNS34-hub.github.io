// 展屏支脚与轻量碰撞共用尺寸；旋转后的包围盒只覆盖脚架，不占用中庭主通道。
export const entryScreens = [
  { x: -13.5, z: -11, yaw: .18, height: 1.95 },
  { x: 13.5, z: -12, yaw: -.18, height: 1.95 },
];
export function entrySupportFootprints() {
  return entryScreens.flatMap(screen => [-2.6, 2.6].map(offset => ({
    x: screen.x + Math.cos(screen.yaw) * offset,
    z: screen.z - Math.sin(screen.yaw) * offset,
    halfWidth: .11 * Math.abs(Math.cos(screen.yaw)) + .165 * Math.abs(Math.sin(screen.yaw)) + .3,
    halfDepth: .11 * Math.abs(Math.sin(screen.yaw)) + .165 * Math.abs(Math.cos(screen.yaw)) + .3,
  })));
}
