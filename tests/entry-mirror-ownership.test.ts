import {describe,it,expect,vi} from 'vitest';
import {getEntryMirror} from '../src/rooms/atrium/entryMirror';
const owner=()=>({domElement:new EventTarget()});
describe('canvas-owned atrium reflection camera',()=>{
 it('reuses one camera across repeated room visits',()=>{
  const canvas=owner(),first=getEntryMirror(canvas,512),id=first.mirror.camera.id;
  for(let i=0;i<20;i++){const next=getEntryMirror(canvas,512);expect(next).toBe(first);expect(next.mirror.camera.id).toBe(id);}
  first.dispose();
 });
 it('retains camera identity when native quality changes the capture resolution',()=>{
  const canvas=owner(),first=getEntryMirror(canvas,512),camera=first.mirror.camera;
  for(const size of[768,512,768]){const next=getEntryMirror(canvas,size);expect(next.mirror.camera).toBe(camera);expect(next.mirror.getRenderTarget().width).toBe(size);expect(next.mirror.getRenderTarget().height).toBe(size);}
  first.dispose();
 });
 it('does not share reflection state between renderers',()=>{
  const a=getEntryMirror(owner(),512),b=getEntryMirror(owner(),512);expect(a.mirror.camera).not.toBe(b.mirror.camera);expect(a.geometry).not.toBe(b.geometry);a.dispose();b.dispose();
 });
 it('disposes its bounded capture once when the canvas loses context',()=>{
  const canvas=owner(),first=getEntryMirror(canvas,512),mirror=vi.spyOn(first.mirror,'dispose'),geometry=vi.spyOn(first.geometry,'dispose');
  canvas.domElement.dispatchEvent(new Event('webglcontextlost'));canvas.domElement.dispatchEvent(new Event('webglcontextlost'));first.dispose();expect(mirror).toHaveBeenCalledTimes(1);expect(geometry).toHaveBeenCalledTimes(1);
  const fresh=getEntryMirror(canvas,512);expect(fresh.mirror.camera.id).not.toBe(first.mirror.camera.id);fresh.dispose();
 });
});
