import {Matrix4,Quaternion,Vector3} from 'three';
import type {VisitView} from '../world/visitView';

export type FitnessView='detail'|'room';
/** Legal observer positions; the existing player return-view path applies them. */
export function fitnessView(mode:FitnessView,aspect=16/9):VisitView{
 const ratio=Number.isFinite(aspect)&&aspect>0?Math.max(.4,Math.min(3,aspect)):16/9;
 // 竖屏适当退后，给哑铃肩推和杠铃两端保留宽度。
 const scale=Math.max(1,.9/ratio),position=mode==='detail'?new Vector3(2.5*scale,1.65,-4+2*scale):new Vector3(3.6,1.65,2.6);
 const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,new Vector3(0,.9,-4),new Vector3(0,1,0)));
 return{roomId:'private-gym',position:position.toArray() as VisitView['position'],quaternion:rotation.toArray() as VisitView['quaternion']};
}
