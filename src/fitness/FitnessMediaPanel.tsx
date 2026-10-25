import {useRef} from 'react';
import {Dialog} from '../ui/primitives';
import {usePalaceStore} from '../systems/store';
import {useGymMedia} from './media/store';
export default function FitnessMediaPanel(){
 const media=useGymMedia(),input=useRef<HTMLInputElement>(null);
 return <Dialog label="我的训练记录" className="gym-media-panel" onClose={()=>usePalaceStore.getState().setOverlay(null)}>
  <p className="eyebrow">PRIVATE TRAINING ARCHIVE</p><h2>把训练留在这里</h2><p>照片挂上后墙，选中的视频在侧墙屏幕播放。原文件保存在当前浏览器。</p>
  <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" hidden onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';void media.importFiles(files);}}/>
  <button className="gym-import" disabled={media.busy} onClick={()=>input.current?.click()}>{media.busy?'正在整理训练记录…':'导入照片 / 视频'}</button>
  <small>照片不超过30 MB，视频不超过512 MB。照片墙展示最近八张。</small>
  {media.notice&&<p role="status">{media.notice}</p>}{media.errors.length>0&&<ul role="alert">{media.errors.map((error,i)=><li key={i}>{error}</li>)}</ul>}
  <ul className="gym-media-list">{media.items.map(item=><li key={item.id}>
   <span><strong>{item.title}</strong><small>{item.kind==='photo'?'照片':'视频'} · {(item.size/1024/1024).toFixed(1)} MB{media.unsaved.includes(item.id)?' · 本次会话':''}</small></span>
   {item.kind==='video'&&<button disabled={media.busy} aria-pressed={media.selectedVideo===item.id} onClick={()=>media.selectVideo(media.selectedVideo===item.id?null:item.id)}>{media.selectedVideo===item.id?'已选到屏幕':'选到屏幕'}</button>}
   <button disabled={media.busy} aria-label={'删除 '+item.title} onClick={()=>void media.remove(item.id)}>删除</button>
  </li>)}</ul>
  {!media.items.length&&<p className="gym-empty">还没有导入记录。照片与视频会从你选择的真实文件开始。</p>}
 </Dialog>;
}
