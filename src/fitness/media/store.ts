import {create} from 'zustand';
import {gymFileKind,gymMediaTitle,inspectGymImage,inspectGymVideo,validateGymSignature} from './validation';
import {readGymMedia,saveGymMedia,readGymBlob,removeGymMedia} from './idb';
import type {GymMedia,PreparedGymMedia} from './types';
const temporary=new Map<string,PreparedGymMedia>();let initializing:Promise<void>|null=null;
type State={items:GymMedia[];loaded:boolean;busy:boolean;notice:string;errors:string[];unsaved:string[];selectedVideo:string|null;initialize:()=>Promise<void>;importFiles:(files:File[])=>Promise<void>;remove:(id:string)=>Promise<void>;selectVideo:(id:string|null)=>void};
export const useGymMedia=create<State>((set,get)=>({items:[],loaded:false,busy:false,notice:'',errors:[],unsaved:[],selectedVideo:null,
 initialize:()=>initializing??=readGymMedia().then(items=>set({items,loaded:true})).catch(()=>set({loaded:true,notice:'浏览器未允许本机保存；新导入内容仍可在本次会话使用。'})),
 importFiles:async files=>{
  if(get().busy)return;set({busy:true,errors:[],notice:''});const errors:string[]=[];
  try{await get().initialize();for(const file of files){try{
   const kind=gymFileKind(file);await validateGymSignature(file);const metadata=kind==='photo'?await inspectGymImage(file):await inspectGymVideo(file),id=crypto.randomUUID();
   const item:GymMedia={id,title:gymMediaTitle(file.name),kind,type:file.type,size:file.size,created:Date.now(),width:metadata.width,height:metadata.height,...('duration'in metadata?{duration:metadata.duration}:{} )};
   const prepared:PreparedGymMedia={item,original:file,...('thumbnail'in metadata?{thumbnail:metadata.thumbnail}:{} )};
   let saved=true;try{await saveGymMedia(prepared);}catch{temporary.set(id,prepared);saved=false;}
   set(s=>({items:[item,...s.items],unsaved:saved?s.unsaved:[...s.unsaved,id],notice:saved?'已保存在当前浏览器，仅本机可见。':'保存未成功；此内容仅保留在本次会话，刷新会丢失。'}));
  }catch(error){errors.push(file.name+'：'+(error instanceof Error?error.message:'导入失败。'));}}}
  finally{set({busy:false,errors});}
 },
 remove:async id=>{if(get().busy)return;try{if(!temporary.has(id))await removeGymMedia(id);temporary.delete(id);set(s=>({items:s.items.filter(item=>item.id!==id),unsaved:s.unsaved.filter(key=>key!==id),selectedVideo:s.selectedVideo===id?null:s.selectedVideo,notice:'已删除此训练记录。'}));}catch{set({notice:'删除未完成，本机记录仍保留，请稍后重试。'});}},
 selectVideo:id=>{if(id===null||get().items.some(item=>item.id===id&&item.kind==='video'))set({selectedVideo:id});},
}));
export async function getGymBlob(id:string,thumbnail=false){const local=temporary.get(id);return local?(thumbnail?local.thumbnail??null:local.original):readGymBlob(id,thumbnail);}
