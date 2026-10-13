export type ForestLod=0|1|2;
// 距离以米计，留出回差；镜头在边界徘徊不会反复切几何，低画质首先减少远处而非变更树形。
export function forestLod(distance:number,previous:ForestLod,quality:string):ForestLod{
 const near=quality==='high'?48:quality==='low'?18:34,middle=quality==='high'?150:quality==='low'?70:115;
 if(previous===0&&distance<near+7)return 0;
 if(previous===2&&distance>middle-12)return 2;
 if(distance<near-5)return 0;
 if(distance>middle+12)return 2;
 return 1;
}
