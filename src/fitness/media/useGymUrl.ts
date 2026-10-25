import {useEffect,useState} from 'react';
import {getGymBlob} from './store';
/** One consumer owns each URL; leaving a room releases video/photo sources. */
export function useGymUrl(id:string|null,thumbnail=false){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let active=true,owned:string|null=null;setUrl(null);
  if(id)void getGymBlob(id,thumbnail).then(blob=>{if(!active||!blob)return;owned=URL.createObjectURL(blob);setUrl(owned);}).catch(()=>{if(active)setUrl(null);});
  return()=>{active=false;if(owned)URL.revokeObjectURL(owned);};
 },[id,thumbnail]);return url;
}
