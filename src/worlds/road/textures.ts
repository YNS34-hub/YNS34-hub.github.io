import { useMemo,useEffect } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping,SRGBColorSpace,NoColorSpace } from "three";

export const roadTextureUrls=["asphalt","asphalt-normal","bark","pine","ground"].map(name=>"/media/road/"+name+".webp");
export function primeRoadTextures(){useTexture.preload(roadTextureUrls);}
// 解码缓存由 drei 管理，各路线挂载只拥有克隆的 sampler。卸载不会销毁另一处仍在用的原纹理。
export function useRoadTextures(){
  const originals=useTexture(roadTextureUrls);
  const copies=useMemo(()=>originals.map((texture,i)=>{
    const t=texture.clone();t.colorSpace=i===1?NoColorSpace:SRGBColorSpace;t.anisotropy=i===0?8:4;
    if(i!==3){t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(1,1);}t.needsUpdate=true;return t;
  }),[originals]);
  useEffect(()=>()=>copies.forEach(t=>t.dispose()),[copies]);
  return{asphalt:copies[0],normal:copies[1],bark:copies[2],pine:copies[3],ground:copies[4]};
}
