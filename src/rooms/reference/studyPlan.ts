export const studyDesk = { x: 7.5, z: 4, width: 4.8, depth: 1.7, height: .78 };
export const studyChairs = [{ x: 6.2, z: 5.6 }, { x: 8.8, z: 5.6 }];
export const studyBookcase = { x: -12.8, z: -12, width: 3.2, depth: .5 };

// 家具与碰撞使用同一尺寸源，预留眼位净距，不把中央原数学装置或分页房间改写。
export function studyFurnitureFootprints() {
  return [
    { x: studyDesk.x, z: studyDesk.z, halfWidth: studyDesk.width / 2 + .3, halfDepth: studyDesk.depth / 2 + .3 },
    ...studyChairs.map(chair => ({ ...chair, halfWidth: .65, halfDepth: .65 })),
    { x: studyBookcase.x, z: studyBookcase.z, halfWidth: studyBookcase.depth / 2 + .3, halfDepth: studyBookcase.width / 2 + .3 },
  ];
}
