import {describe,it,expect} from 'vitest';
import {gymFileKind,gymMediaTitle,validateGymSignature} from '../src/fitness/media/validation';
import {isGymMedia} from '../src/fitness/media/types';
describe('private gym file boundary',()=>{
 it('rejects an SVG/HTML disguised as a photo before creating a browser image source',async()=>{
  await expect(validateGymSignature(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'],{type:'image/png'}))).rejects.toThrow('不符');
  await expect(validateGymSignature(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}))).resolves.toBeUndefined();
  await expect(validateGymSignature(new Blob([new Uint8Array([26,69,223,163])],{type:'video/webm'}))).resolves.toBeUndefined();
 });
 for(const type of ['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])it(`accepts a bounded ${type} local file`,()=>expect(gymFileKind({type,size:1024})).toBe(type.startsWith('image/')?'photo':'video'));
 for(const type of ['image/svg+xml','text/html','application/javascript','application/octet-stream'])it(`rejects executable or unknown ${type} media`,()=>expect(()=>gymFileKind({type,size:1024})).toThrow());
 it('rejects empty, invalid and oversized files without changing another library',()=>{for(const size of [0,-1,NaN,Infinity,31*1024*1024])expect(()=>gymFileKind({type:'image/png',size})).toThrow();expect(()=>gymFileKind({type:'video/webm',size:513*1024*1024})).toThrow();});
 it('keeps titles as plain text and bounds them without interpreting user markup',()=>{expect(gymMediaTitle('<script>alert(1)</script>.png')).toBe('<script>alert(1)</script>');expect(gymMediaTitle('.png')).toBe('未命名训练记录');expect(gymMediaTitle('x'.repeat(300)+'.jpg')).toHaveLength(160);});
 it('ignores malformed saved metadata rather than treating it as a gallery source',()=>{
  const item={id:'12345678-1234-1234-1234-123456789abc',title:'真实训练',kind:'photo',type:'image/png',size:10,created:1,width:100,height:100};
  expect(isGymMedia(item)).toBe(true);for(const change of [{id:'https://example.com/tracker'},{width:NaN},{title:'x'.repeat(161)},{kind:'html'},{size:0}])expect(isGymMedia({...item,...change})).toBe(false);
 });
});
