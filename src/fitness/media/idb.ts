import {isGymMedia,type GymMedia,type PreparedGymMedia} from './types';
export const GYM_DATABASE='memory-palace-private-gym';
let opening:Promise<IDBDatabase>|null=null;
function open():Promise<IDBDatabase>{
 return opening??=new Promise<IDBDatabase>((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('本机存储不可用。'));return;}
  let failed=false;
  const request=indexedDB.open(GYM_DATABASE,1);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('media',{keyPath:'id'});db.createObjectStore('originals');db.createObjectStore('thumbnails');};
  request.onerror=()=>{failed=true;reject(request.error??Error('无法打开本机存储。'));};
  request.onblocked=()=>{failed=true;reject(Error('请关闭其他健身房页面后重试保存。'));};
  request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
 }).catch(error=>{opening=null;throw error;});
}
const requestValue=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const committed=(transaction:IDBTransaction)=>new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error??Error('本机保存失败。'));});
export async function readGymMedia():Promise<GymMedia[]>{const db=await open(),tx=db.transaction('media','readonly');return(await requestValue(tx.objectStore('media').getAll())).filter(isGymMedia).sort((a,b)=>b.created-a.created);}
export async function saveGymMedia(media:PreparedGymMedia){const db=await open(),tx=db.transaction(['media','originals','thumbnails'],'readwrite'),done=committed(tx);tx.objectStore('media').put(media.item);tx.objectStore('originals').put(media.original,media.item.id);if(media.thumbnail)tx.objectStore('thumbnails').put(media.thumbnail,media.item.id);await done;}
export async function readGymBlob(id:string,thumbnail=false):Promise<Blob|null>{const db=await open(),tx=db.transaction(thumbnail?'thumbnails':'originals','readonly');const blob=await requestValue(tx.objectStore(thumbnail?'thumbnails':'originals').get(id));return blob instanceof Blob?blob:null;}
export async function removeGymMedia(id:string){const db=await open(),tx=db.transaction(['media','originals','thumbnails'],'readwrite'),done=committed(tx);for(const name of ['media','originals','thumbnails'])tx.objectStore(name).delete(id);await done;}
