import {describe,it,expect,vi} from 'vitest';
import {Texture} from 'three';
import {valleyTerrainMaterial} from '../src/worlds/scenery/terrainFinish';
import {createValleyRidges} from '../src/worlds/scenery/landforms';
import {atlasUV,type ImageAtlas} from '../src/worlds/alpine/projection';
import {readFileSync} from 'node:fs';

describe('active valley surface paths',()=>{
 it('uses the original DEM window coordinates for imagery instead of the rearranged valley coordinates',()=>{
  const samples=JSON.parse(readFileSync('public/media/road/ridge-samples.json','utf8'));
  const meta=JSON.parse(readFileSync('public/media/alpine/geography.json','utf8')).imagery as ImageAtlas;
  const ridges=createValleyRidges(samples,meta);
  for(const [i,g]of ridges.entries()){
   const uv=g.getAttribute('ridgeImageUV'),p=g.getAttribute('position'),s=samples.layers[i],w=s.sourceWindow;
   expect(uv.count).toBe(p.count);
   for(const index of [0,s.cols,Math.floor(s.rows*.5)*(s.cols+1)+Math.floor(s.cols*.5),p.count-1]){
    const u=index%(s.cols+1)/s.cols,v=Math.floor(index/(s.cols+1))/s.rows,expected=atlasUV(meta,w[0]+u*w[2],w[1]+v*w[3]);
    expect(uv.getX(index)).toBeCloseTo(expected[0],5);expect(uv.getY(index)).toBeCloseTo(expected[1],5);
   }
   g.dispose();
  }
  const invalid={layers:samples.layers.map((layer:{sourceWindow?:number[]})=>({...layer,sourceWindow:undefined}))};
  expect(()=>createValleyRidges(invalid,meta)).toThrow('Missing source coordinates');
 });
 it('gives the mountain path photographed surface inputs instead of silently returning a plain colour',()=>{
  const maps={rock:new Texture(),rockNormal:new Texture(),meadow:new Texture(),meadowNormal:new Texture()};
  const mountain=valleyTerrainMaterial(maps,true),floor=valleyTerrainMaterial(maps);
  expect(mountain.map).toBe(maps.meadow);expect(mountain.normalMap).toBe(maps.meadowNormal);
  expect(mountain.vertexColors).toBe(true);expect(floor.map).toBe(maps.meadow);
  const disposed=vi.fn();for(const texture of Object.values(maps))texture.addEventListener('dispose',disposed);
  mountain.dispose();floor.dispose();expect(disposed).not.toHaveBeenCalled();
  expect(maps.meadow.repeat.toArray()).toEqual([1,1]);
 });
});
