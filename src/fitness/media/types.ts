export type GymMedia={id:string;title:string;kind:'photo'|'video';type:string;size:number;created:number;width:number;height:number;duration?:number};
export type PreparedGymMedia={item:GymMedia;original:Blob;thumbnail?:Blob};
export function isGymMedia(value:unknown):value is GymMedia{
 if(!value||typeof value!=='object')return false;const v=value as GymMedia;
 return typeof v.id==='string'&&/^[a-f0-9-]{36}$/i.test(v.id)&&typeof v.title==='string'&&v.title.length<=160&&(v.kind==='photo'||v.kind==='video')&&typeof v.type==='string'&&Number.isFinite(v.size)&&v.size>0&&Number.isFinite(v.created)&&Number.isFinite(v.width)&&v.width>0&&Number.isFinite(v.height)&&v.height>0;
}
