import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {forestLod} from '../src/worlds/scenery/forestLod';
import {disposeForestInstances} from '../src/worlds/scenery/forestResources';
import {InstancedMesh,BoxGeometry,MeshStandardMaterial} from 'three';

describe('licensed conifer assets and bounded viewing distance',()=>{
 it('releases streamed instance buffers without disposing shared tree geometry or material',()=>{
  const geometry=new BoxGeometry(),material=new MeshStandardMaterial(),a=new InstancedMesh(geometry,material,2),b=new InstancedMesh(geometry,material,3);
  let instances=0,shared=0;a.addEventListener('dispose',()=>instances++);b.addEventListener('dispose',()=>instances++);
  geometry.addEventListener('dispose',()=>shared++);material.addEventListener('dispose',()=>shared++);
  disposeForestInstances([a,b]);expect(instances).toBe(2);expect(shared).toBe(0);
  geometry.dispose();material.dispose();
 });
 it('keeps a stable level while looking around either distance boundary',()=>{
  expect(forestLod(38,0,'medium')).toBe(0);expect(forestLod(38,1,'medium')).toBe(1);
  expect(forestLod(108,2,'medium')).toBe(2);expect(forestLod(108,1,'medium')).toBe(1);
  expect(forestLod(12,2,'medium')).toBe(0);expect(forestLod(180,0,'medium')).toBe(2);
 });
 for(const id of ['fir_tree_01','pine_sapling_small'])it(id+' retains rooted metric geometry, real UVs and a decreasing LOD budget',()=>{
  const content=readFileSync('public/media/road/forest/'+id+'.json','utf8'),file=JSON.parse(content);
  expect(file.source.license).toBe('CC0');expect(file.source.url).toBe('https://polyhaven.com/a/'+id);
  // 大的来源范围只用于离线加工；验证实际公开 payload，而非把原始来源尺寸混称为运行时预算。
  expect(Buffer.byteLength(content)).toBeLessThan(5e6);
  expect(file.source.slices.map((s:{sliceBytes:number})=>s.sliceBytes)).toEqual(id==='fir_tree_01'?[33249936,156911848]:[17771796]);
  expect(file.variants.length).toBe(id==='fir_tree_01'?2:3);
  for(const variant of file.variants){let previous=Infinity;expect(variant.height).toBeGreaterThan(.5);expect(variant.lods).toHaveLength(3);
   for(const [level,lod]of variant.lods.entries()){let triangles=0,floor=Infinity;
    for(const part of lod){expect(part.position.length/3).toBe(part.normal.length/3);expect(part.uv.length/2).toBe(part.position.length/3);expect(part.index.length%3).toBe(0);
     expect(part.position.every(Number.isFinite)&&part.normal.every(Number.isFinite)&&part.uv.every(Number.isFinite)).toBe(true);
     expect(Math.max(...part.index)).toBeLessThan(part.position.length/3);triangles+=part.index.length/3;
     for(let i=1;i<part.position.length;i+=3)floor=Math.min(floor,part.position[i]);
     if(part.leaf&&level===0){
      // 检查真实几何覆盖，防止断开的针叶被简化成只剩枝干；不能仅因三角形数量少就判为成功。
      let area=0;for(let i=0;i<part.index.length;i+=3){const a=part.index[i]*3,b=part.index[i+1]*3,c=part.index[i+2]*3,ab=[0,1,2].map(j=>part.position[b+j]-part.position[a+j]),ac=[0,1,2].map(j=>part.position[c+j]-part.position[a+j]);area+=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])*.5;}
      expect(area).toBeGreaterThan(variant.height**2*.2);
     }
    }
    expect(floor).toBeLessThan(.1);expect(floor).toBeGreaterThanOrEqual(-.00002);expect(triangles).toBeLessThan(previous);expect(triangles).toBeLessThan(15000);previous=triangles;
   }
  }
 });
});
