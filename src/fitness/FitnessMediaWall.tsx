import {useEffect,useMemo,useRef,useState} from 'react';
import {SRGBColorSpace,TextureLoader,VideoTexture,type Texture} from 'three';
import {useFrame} from '@react-three/fiber';
import {Block,Label} from '../world/primitives';
import {usePalaceStore} from '../systems/store';
import {useGymMedia} from './media/store';
import {useGymUrl} from './media/useGymUrl';
import {attachGymVideo,useGymVideo,toggleGymVideo} from './media/video';
import type {GymMedia} from './media/types';
function Photo({item,index}:{item:GymMedia;index:number}){
 const url=useGymUrl(item.id,true),[map,setMap]=useState<Texture|null>(null);
 useEffect(()=>{let active=true;if(!url){setMap(null);return;}
  const owned=new TextureLoader().load(url,texture=>{if(active){texture.colorSpace=SRGBColorSpace;setMap(texture);}});return()=>{active=false;owned.dispose();};
 },[url]);
 const x=(index%4-1.5)*3.1,y=2.05+Math.floor(index/4)*2.25,aspect=item.width/item.height,width=Math.min(2.65,1.65*aspect),height=width/aspect;
 return <group position={[x,y,-14.72]}>
  <Block position={[0,0,0]} scale={[2.85,2.02,.10]} color="#baa084" roughness={.8}/><Block position={[0,0,.065]} scale={[2.67,1.84,.03]} color="#e4ddce"/>
  {map&&<mesh position={[0,0,.088]}><planeGeometry args={[width,height]}/><meshBasicMaterial map={map} toneMapped={false}/></mesh>}
  <Label text={item.title} position={[0,-1.17,.08]} size={.10} color="#6b6257" maxWidth={2.7}/>
 </group>;
}
function VideoScreen(){
 const selected=useGymMedia(s=>s.selectedVideo),item=useGymMedia(s=>s.items.find(item=>item.id===s.selectedVideo)),url=useGymUrl(selected),[texture,setTexture]=useState<VideoTexture|null>(null);
 const blocked=usePalaceStore(s=>!!s.overlay||!!s.focus||s.mode==='index');
 const videoRef=useRef<HTMLVideoElement|null>(null);
 useEffect(()=>{setTexture(null);if(!url)return;
  const video=document.createElement('video');video.playsInline=true;video.muted=true;video.loop=true;video.preload='metadata';video.src=url;videoRef.current=video;
  const map=new VideoTexture(video);map.colorSpace=SRGBColorSpace;
  const detach=attachGymVideo(video),ready=()=>useGymVideo.setState({ready:true}),playing=()=>useGymVideo.setState({playing:true,error:''}),paused=()=>useGymVideo.setState({playing:false}),error=()=>useGymVideo.setState({ready:false,playing:false,error:'当前视频无法播放。'});
  video.addEventListener('loadedmetadata',ready);video.addEventListener('play',playing);video.addEventListener('pause',paused);video.addEventListener('error',error);setTexture(map);video.load();
  const hidden=()=>{if(document.hidden)video.pause();};document.addEventListener('visibilitychange',hidden);
  return()=>{video.pause();video.removeEventListener('loadedmetadata',ready);video.removeEventListener('play',playing);video.removeEventListener('pause',paused);video.removeEventListener('error',error);document.removeEventListener('visibilitychange',hidden);video.removeAttribute('src');video.load();map.dispose();if(videoRef.current===video)videoRef.current=null;detach();};
 },[url]);
 useEffect(()=>{if(blocked)videoRef.current?.pause();},[blocked]);
 useFrame(()=>{if(document.hidden)videoRef.current?.pause();});
 const aspect=item?item.width/item.height:16/9,width=Math.min(5.2,3*aspect),height=width/aspect;
 return <group position={[12.25,3.0,-3]} rotation={[0,-Math.PI/2,0]}>
  <Block position={[0,0,0]} scale={[5.5,3.35,.16]} color="#242c29" roughness={.8}/>
  <mesh position={[0,0,.09]} onClick={e=>{e.stopPropagation();toggleGymVideo();}}><planeGeometry args={[width,height]}/><meshBasicMaterial color={texture?'#ffffff':'#101916'} map={texture} toneMapped={false}/></mesh>
  {!texture&&<Label text="YOUR TRAINING FILMS" position={[0,0,.11]} color="#c1b59e" size={.18}/>}
  <Label text={item?.title??'导入训练视频后，在这里播放'} position={[0,-1.92,.10]} color="#c4bbab" size={.12} maxWidth={5}/>
 </group>;
}
export default function FitnessMediaWall(){
 const items=useGymMedia(s=>s.items),photos=useMemo(()=>items.filter(item=>item.kind==='photo').slice(0,8),[items]);
 useEffect(()=>{void useGymMedia.getState().initialize();},[]);
 return <group name="private-gym-local-media"><Label text="YOUR TRAINING ARCHIVE" position={[0,5.4,-14.61]} color="#514c41" size={.24}/>
  {photos.map((item,index)=><Photo key={item.id} item={item} index={index}/>)}
  {!photos.length&&<group position={[0,2.9,-14.65]}><Label text="这里留给你的训练照片" position={[0,0,0]} color="#655c4f" size={.24}/><Label text="从本机导入，慢慢留下变化。" position={[0,-.48,0]} color="#807362" size={.13}/></group>}
  <VideoScreen/>
 </group>;
}
