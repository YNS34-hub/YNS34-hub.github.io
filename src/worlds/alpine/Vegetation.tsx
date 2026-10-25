import {useMemo} from 'react';
import {Vector3} from 'three';
import ForestTrees,{preloadForestTrees,type ForestAssets,type ForestTree} from '../scenery/ForestTrees';
import {alpineGround,alpineLength,alpineSectorLength,nearestAlpine,sampleAlpine} from './route';
import {habitat} from '../scenery/ecology';

export function preloadAlpineVegetation(){preloadForestTrees();}

// 保留原海拔林线、坡度、公路退距和路段种子；替换灰色枝叶卡片，路线 / 地形 / 控制器不变。
export function AlpineVegetation({index,assets,shadows}:{index:number;assets:ForestAssets;shadows:boolean}){
 const trees=useMemo(()=>{
  let seed=8123+index*433;
  const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
  const p=new Vector3(),t=new Vector3(),trees:ForestTree[]=[],start=index*alpineSectorLength,end=Math.min(alpineLength,start+alpineSectorLength);
  for(let d=start+12;d<end;d+=12){
   sampleAlpine(d,p,t);const nx=-t.z,nz=t.x,r=Math.hypot(nx,nz);
   for(const side of[-1,1]){
    const off=side*(10+rand()**1.3*68),along=(rand()-.5)*9,x=p.x+nx/r*off+t.x/r*along,z=p.z+nz/r*off+t.z/r*along,y=alpineGround(x,z);
    if(y>570||rand()>(570-y)/260*(.35+habitat(x,z))||nearestAlpine(x,z).distance<9||Math.hypot(alpineGround(x+2,z)-alpineGround(x-2,z),alpineGround(x,z+2)-alpineGround(x,z-2))>3.5)continue;
    const angle=rand()*Math.PI*2,young=rand()<.18,model=young?1:0,variant=young?Math.floor(rand()*3):angle<Math.PI?0:1;
    const height=young?1.6+rand()*2.2:7+rand()**.6*13,size=height/assets.heights[model][variant];
    trees.push({model,variant,position:[x,y-.06,z],scale:[size*(.78+rand()*.40),size,size*(.8+rand()*.36)],rotation:[0,angle,0]});
   }
  }
  return trees;
 },[index,assets]);
 return <group name={'alpine-treeline:'+index}><ForestTrees trees={trees} assets={assets} shadows={shadows}/></group>;
}
