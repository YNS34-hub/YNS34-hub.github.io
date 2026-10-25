export const exercises={
 'push-up':{title:'俯卧撑',cue:'身体保持一条线，屈肘下放，再推起。',period:3.6,equipment:'mat'},
 squat:{title:'徒手深蹲',cue:'髋部向后坐，膝盖沿脚尖方向，平稳起身。',period:4,equipment:'mat'},
 plank:{title:'平板支撑',cue:'前臂支撑，腹部收紧，保持均匀呼吸。',period:8,equipment:'mat'},
 curl:{title:'哑铃弯举',cue:'肘部靠近身体，控制上举与下放。',period:3.6,equipment:'dumbbells'},
 'shoulder-press':{title:'哑铃肩推',cue:'从肩侧向上推起，缓慢回落。',period:4,equipment:'dumbbells'},
 'bench-press':{title:'卧推',cue:'双脚稳定，杠铃在胸前控制下降与推起。',period:4,equipment:'bench'},
 'weighted-squat':{title:'负重深蹲',cue:'杠铃置于肩背，髋膝同步屈伸。',period:4.4,equipment:'rack'},
} as const;
export type Exercise=keyof typeof exercises;
export const exerciseIds=Object.keys(exercises) as Exercise[];
export const isExercise=(value:unknown):value is Exercise=>typeof value==='string'&&Object.hasOwn(exercises,value);
