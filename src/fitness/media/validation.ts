const images=new Set(['image/jpeg','image/png','image/webp','image/avif']),videos=new Set(['video/mp4','video/webm']);
export function gymFileKind(file:{type:string;size:number}):'photo'|'video'{
 const kind=images.has(file.type)?'photo':videos.has(file.type)?'video':null;
 if(!kind)throw Error('支持 JPG、PNG、WebP、AVIF 照片，以及 MP4、WebM 视频。');
 if(!Number.isFinite(file.size)||file.size<=0)throw Error('文件为空或大小无效。');
 if(file.size>(kind==='photo'?30:512)*1024*1024)throw Error(kind==='photo'?'照片需小于30 MB。':'视频需小于512 MB。');
 return kind;
}
export const gymMediaTitle=(name:string)=>name.replace(/\.[^.]+$/,'').trim().slice(0,160)||'未命名训练记录';
export async function validateGymSignature(file:Blob){
 const bytes=new Uint8Array(await file.slice(0,64).arrayBuffer()),text=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
 const valid=file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/webp'?text(0,4)==='RIFF'&&text(8,12)==='WEBP':file.type==='image/avif'?text(4,8)==='ftyp'&&/avif|avis/.test(text(8,64)):file.type==='video/mp4'?text(4,8)==='ftyp':file.type==='video/webm'?bytes.slice(0,4).join(',')==='26,69,223,163':false;
 if(!valid)throw Error('文件内容与图片或视频类型不符。');
}
export async function inspectGymImage(file:Blob){
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{const timeout=window.setTimeout(()=>reject(Error('读取照片超时。')),15000);image.onload=()=>{clearTimeout(timeout);resolve();};image.onerror=()=>{clearTimeout(timeout);reject(Error('照片无法解码。'));};image.src=url;});
  const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height||width*height>32_000_000)throw Error('照片像素过大，请使用3200万像素以内的图片。');
  const scale=Math.min(1,1024/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('浏览器无法准备照片墙。');context.drawImage(image,0,0,canvas.width,canvas.height);
  const thumbnail=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('照片缩略图生成失败。')),'image/webp',.88));
  return{width,height,thumbnail};
 }finally{image.onload=image.onerror=null;image.removeAttribute('src');URL.revokeObjectURL(url);}
}
export async function inspectGymVideo(file:Blob){
 const video=document.createElement('video');if(!video.canPlayType(file.type))throw Error('此浏览器不支持该视频编码。');
 const url=URL.createObjectURL(file);video.preload='metadata';video.muted=true;
 try{return await new Promise<{width:number;height:number;duration:number}>((resolve,reject)=>{
  const timeout=window.setTimeout(()=>reject(Error('读取视频信息超时，请检查文件。')),15000);
  video.onloadedmetadata=()=>{clearTimeout(timeout);if(!video.videoWidth||!video.videoHeight||video.duration===0)reject(Error('视频信息无效。'));else resolve({width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:0});};
  video.onerror=()=>{clearTimeout(timeout);reject(Error('视频无法解码，请使用浏览器可播放的 MP4 或 WebM。'));};video.src=url;
 });}finally{video.onloadedmetadata=video.onerror=null;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
