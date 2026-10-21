import {useEffect,useState} from 'react';
import {exercises,exerciseIds} from './exercises';
import {fitnessClock,useFitness} from './session';
import {usePalaceStore} from '../systems/store';
import {useGymMedia} from './media/store';
import {useGymVideo,toggleGymVideo,toggleGymVideoMute} from './media/video';
import FitnessMediaPanel from './FitnessMediaPanel';
import {fitnessView,type FitnessView} from './viewpoints';
import './fitness.css';
export default function FitnessHud(){
 const controls=useFitness(),overlay=usePalaceStore(s=>s.overlay),video=useGymVideo(),selected=useGymMedia(s=>s.selectedVideo),[clock,setClock]=useState({reps:0,elapsed:0,transition:1}),[collapsed,setCollapsed]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:680px)').matches);
 useEffect(()=>{const timer=window.setInterval(()=>setClock({reps:fitnessClock.reps,elapsed:fitnessClock.elapsed,transition:fitnessClock.transition}),150);return()=>clearInterval(timer);},[]);
 const exercise=exercises[controls.exercise];
 const observe=(mode:FitnessView)=>{const palace=usePalaceStore.getState();if(palace.roomId!=='private-gym'||!palace.started||palace.overlay||palace.focus||palace.pendingDoor||palace.mode==='index'||document.hidden)return;palace.update({returnView:fitnessView(mode,innerWidth/innerHeight),travelSequence:palace.travelSequence+1});};
 return <><section className={'fitness-hud'+(collapsed?' is-collapsed':'')} aria-label="私人健身房训练控制">
  <p className="gym-eyebrow">JIE TIAN · PRIVATE GYM</p><div className="gym-panel-heading"><h2>在自己的节奏里</h2><button className="gym-collapse" aria-expanded={!collapsed} aria-controls="gym-panel-content" onClick={()=>setCollapsed(value=>!value)}>{collapsed?'展开训练控制':'收起训练控制'}</button></div>
  <div className="gym-view-controls" role="group" aria-label="训练观察位置"><button onClick={event=>{observe('detail');event.currentTarget.blur();}}>看清动作</button><button onClick={event=>{observe('room');event.currentTarget.blur();}}>房间全景</button></div>
  <div id="gym-panel-content" hidden={collapsed}>
  <div className="gym-exercises" role="group" aria-label="训练动作">{exerciseIds.map(id=><button key={id} aria-pressed={controls.exercise===id} onClick={()=>controls.select(id)}>{exercises[id].title}</button>)}</div>
  <p className="gym-cue">{exercise.cue}</p>
  <div className="gym-counter" aria-live="off"><strong>{controls.exercise==='plank'?Math.floor(clock.elapsed):clock.reps}</strong><span>{controls.exercise==='plank'?'模拟持续秒数':'模拟完成次数'}{clock.transition<1?' · 正在调整姿态':''}</span></div>
  <div className="gym-transport"><button onClick={controls.toggle}>{controls.running?'暂停训练':'开始训练'}</button><button onClick={controls.reset}>重置</button></div>
  <label className="gym-speed">训练节奏 <select aria-label="训练节奏" value={controls.speed} onChange={e=>controls.setSpeed(Number(e.currentTarget.value))}><option value={.5}>0.5×</option><option value={.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option></select></label>
  <button className="gym-archive-open" onClick={()=>usePalaceStore.getState().setOverlay('fitness-media')}>我的训练照片 / 视频</button>
  {selected&&<div className="gym-video-controls" role="group" aria-label="训练视频控制"><button disabled={!video.ready} onClick={toggleGymVideo}>{video.playing?'暂停视频':'播放视频'}</button><button disabled={!video.ready} onClick={toggleGymVideoMute}>{video.muted?'打开视频声音':'视频静音'}</button>{video.error&&<p role="status">{video.error}</p>}</div>}
  <small className="gym-simulation-note">这里记录模拟动作；个人训练记录从你导入的文件开始。</small>
  </div>
 </section>{overlay==='fitness-media'&&<FitnessMediaPanel/>}</>;
}
