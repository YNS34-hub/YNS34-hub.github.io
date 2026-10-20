import {CanvasTexture,RepeatWrapping,SRGBColorSpace} from 'three';

type SurfaceKind='oak'|'rubber';
const SIZE=512;
const grain=(x:number,y:number,seed:number)=>{
 let h=Math.imul(x+seed,374761393)^Math.imul(y+17,668265263);
 h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;
};

/** Room-owned original surface maps. Height derivatives wrap at the tile edge. */
function surface(kind:SurfaceKind,repeatX:number,repeatY:number){
 const color=new Uint8ClampedArray(SIZE*SIZE*4),rough=new Uint8ClampedArray(color.length),height=new Float32Array(SIZE*SIZE);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const i=y*SIZE+x,k=i*4,n=grain(x,y,31);
  let r:number,g:number,b:number,h:number,roughness:number;
  if(kind==='oak'){
   const board=Math.floor(x/32),shift=(board%4)*64,joint=(y+shift)%256,edge=x%32;
   const seam=edge===0||joint===0,variation=grain(board,Math.floor((y+shift)/256)%2,91)-.5;
   const fiber=Math.sin(x*1.7+Math.sin(y*Math.PI*2/SIZE)*2.4+Math.sin(y*Math.PI*8/SIZE)*.6);
   const tone=variation*13+fiber*2.5+(n-.5)*3;
   r=seam?88:173+tone;g=seam?75:143+tone*.85;b=seam?59:106+tone*.65;
   h=seam?.32:.50+fiber*.009+(n-.5)*.012;roughness=.68+(n-.5)*.08;
  }else{
   const fleck=n>.975?12:n<.045?-7:0,tone=(n-.5)*4+fleck;
   r=37+tone;g=44+tone;b=40+tone;h=.5+(n-.5)*.055;roughness=.92+(n-.5)*.08;
  }
  color.set([r,g,b,255],k);const value=roughness*255;rough.set([value,value,value,255],k);height[i]=h;
 }
 const normal=new Uint8ClampedArray(color.length),at=(x:number,y:number)=>height[((y+SIZE)%SIZE)*SIZE+(x+SIZE)%SIZE];
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const dx=(at(x+1,y)-at(x-1,y))*.8,dy=(at(x,y+1)-at(x,y-1))*.8,length=Math.hypot(dx,dy,1);
  normal.set([(1-dx/length)*127.5,(1-dy/length)*127.5,(1+1/length)*127.5,255],(y*SIZE+x)*4);
 }
 const texture=(data:Uint8ClampedArray,srgb=false)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const context=canvas.getContext('2d')!;const image=context.createImageData(SIZE,SIZE);image.data.set(data);context.putImageData(image,0,0);
  const map=new CanvasTexture(canvas);if(srgb)map.colorSpace=SRGBColorSpace;
  map.wrapS=map.wrapT=RepeatWrapping;map.repeat.set(repeatX,repeatY);map.anisotropy=4;return map;
 };
 return{map:texture(color,true),normalMap:texture(normal),roughnessMap:texture(rough)};
}

export function createGymSurfaces(){
 const oak=surface('oak',25/4,31/4),rubber=surface('rubber',6.4,7.2),textures=[...Object.values(oak),...Object.values(rubber)];
 return{oak,rubber,activate(){textures.forEach(texture=>{texture.needsUpdate=true;});},dispose(){textures.forEach(texture=>texture.dispose());}};
}
