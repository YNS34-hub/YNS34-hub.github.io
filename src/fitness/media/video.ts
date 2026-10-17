import {create} from 'zustand';
let active:HTMLVideoElement|null=null;
export const useGymVideo=create<{ready:boolean;playing:boolean;muted:boolean;error:string}>(()=>({ready:false,playing:false,muted:true,error:''}));
export function attachGymVideo(video:HTMLVideoElement){active=video;useGymVideo.setState({ready:false,playing:false,muted:true,error:''});return()=>{if(active===video){active=null;useGymVideo.setState({ready:false,playing:false});}};}
export function toggleGymVideo(){if(!active)return;if(active.paused)void active.play().catch(()=>useGymVideo.setState({error:'点击播放重试；浏览器尚未开始播放。'}));else active.pause();}
export function toggleGymVideoMute(){if(active){active.muted=!active.muted;useGymVideo.setState({muted:active.muted});}}
