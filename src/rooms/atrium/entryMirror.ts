import {PlaneGeometry,ShaderMaterial} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

type ReflectionOwner={domElement:EventTarget};
const mirrors=new WeakMap<ReflectionOwner,ReturnType<typeof createMirror>>();

function createMirror(owner:ReflectionOwner,size:number){
 const geometry=new PlaneGeometry(42,54),mirror=new Reflector(geometry,{textureWidth:size,textureHeight:size,clipBias:.003,multisample:0});
 const mirrorMaterial=mirror.material;
 if(!(mirrorMaterial instanceof ShaderMaterial)){mirror.dispose();geometry.dispose();throw new Error('Expected the built-in Reflector shader');}
 mirror.name='atrium-floor-capture';mirror.position.y=0;mirror.rotation.x=-Math.PI/2;mirror.visible=false;mirror.raycast=()=>{};
 const capture=mirror.onBeforeRender.bind(mirror);mirror.onBeforeRender=()=>{};
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;owner.domElement.removeEventListener('webglcontextlost',dispose);mirror.dispose();geometry.dispose();mirrors.delete(owner);};
 owner.domElement.addEventListener('webglcontextlost',dispose);
 return{geometry,mirror,mirrorMaterial,capture,dispose};
}

/**
 * Keep one public Reflector/virtual camera per canvas. Three retains a transmission
 * target for each camera ID; rebuilding this camera on every room visit grows that
 * internal cache even after Reflector.dispose(). A bounded canvas-owned capture
 * preserves glass transmission and is released when the WebGL context is lost.
 */
export function getEntryMirror(owner:ReflectionOwner,size:number){
 let entry=mirrors.get(owner);
 if(!entry){entry=createMirror(owner,size);mirrors.set(owner,entry);}
 const target=entry.mirror.getRenderTarget();
 if(target.width!==size||target.height!==size){target.setSize(size,size);entry.mirror.forceUpdate=true;}
 return entry;
}
