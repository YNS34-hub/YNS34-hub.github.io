// 展屏支脚与轻量碰撞共用尺寸；旋转后的包围盒只覆盖脚架，不占用中庭主通道。
export const entryScreens = [
  { x: -12.2, z: -8.5, yaw: .28, height: 1.95 },
  { x: 12.5, z: -10, yaw: -.28, height: 1.73 },
];
export function entrySupportFootprints() {
  return entryScreens.flatMap(screen => [-2.6, 2.6].map(offset => ({
    x: screen.x + Math.cos(screen.yaw) * offset,
    z: screen.z - Math.sin(screen.yaw) * offset,
    halfWidth: .11 * Math.abs(Math.cos(screen.yaw)) + .165 * Math.abs(Math.sin(screen.yaw)) + .3,
    halfDepth: .11 * Math.abs(Math.sin(screen.yaw)) + .165 * Math.abs(Math.cos(screen.yaw)) + .3,
  })));
}
