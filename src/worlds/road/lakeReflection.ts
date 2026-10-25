import {Matrix4,Vector4,type WebGLRenderer,type Object3D} from 'three';
export function lakeReflectionTier(quality:string){return quality==='high'?{size:768,hz:6}:quality==='medium'?{size:512,hz:4}:null;}
/** Reflector publishes a matrix for its local plane. Water vertices are world-space. */
export function lakeWorldProjection(out:Matrix4,textureMatrix:Matrix4,mirrorWorld:Matrix4){return out.copy(mirrorWorld).invert().premultiply(textureMatrix);}
/** Restore renderer and visibility even if an asset throws inside the secondary render. */
export function captureLakeReflection(renderer:WebGLRenderer,water:Object3D,mirror:Object3D,capture:()=>void):void{
 const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),level=renderer.getActiveMipmapLevel(),viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest();
 const xr=renderer.xr.enabled,shadow=renderer.shadowMap.autoUpdate,visible=water.visible;
 water.visible=false;
 try{capture();}
 finally{
  water.visible=visible;mirror.visible=false;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadow;
  renderer.setRenderTarget(target,face,level);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
 }
}
