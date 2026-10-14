export interface ShotMotionPack {
  title: string; description: string;
  chargeDuration: number; liftStart: number; liftEnd: number; releaseHeight: number; releaseX: number; releaseZ: number;
  jump: number; crouch: number; guidePeel: number; wristRate: number; torsoPitch: number;
}

export interface HandMotionPack {
  title: string; description: string;
  spread: number; holdX: number; holdY: number; holdZ: number; gatherTime: number;
}
export interface DribbleMotionPack {
  title: string; description: string;
  period: number; sprintPeriod: number; height: number; spread: number; front: number; torso: number; twist: number;
}
export interface FinishMotionPack {
  title: string; description: string;
  releaseAt: number; jump: number; offset: number; originY: number; lateral: number; twist: number; twoHands: boolean;
}

export const motionPacks = {
  shot: {
    quick: { title: "快速出手", description: "紧凑收球与短起跳，提早完成手腕拨球。", chargeDuration: 1.05, liftStart: .08, liftEnd: .48, releaseHeight: 1.94, releaseX: .12, releaseZ: -.29, jump: .24, crouch: .08, guidePeel: .66, wristRate: 15, torsoPitch: -.09 },
    classic: { title: "经典跳投", description: "下蹲蓄力、连贯举球，在起跳高点稳定出手。", chargeDuration: 1.40, liftStart: .06, liftEnd: .56, releaseHeight: 2.03, releaseX: .13, releaseZ: -.27, jump: .30, crouch: .105, guidePeel: .70, wristRate: 12.5, torsoPitch: -.12 },
    "high-release": { title: "高点投篮", description: "将球举过眉线，充分伸展后从更高位置拨球。", chargeDuration: 1.52, liftStart: .08, liftEnd: .61, releaseHeight: 2.12, releaseX: .10, releaseZ: -.24, jump: .34, crouch: .11, guidePeel: .74, wristRate: 10.5, torsoPitch: -.10 },
  } satisfies Record<string, ShotMotionPack>,
  hands: {
    natural: { title: "自然双手", description: "双手接稳球，顺势收球与举球。", spread: .11, holdX: .23, holdY: 1.13, holdZ: -.35, gatherTime: .16 },
    protect: { title: "护球收球", description: "将球收近身体，双手护球后起步。", spread: .10, holdX: .12, holdY: 1.13, holdZ: -.34, gatherTime: .22 },
  } satisfies Record<string, HandMotionPack>,
  dribble: {
    balanced: { title: "均衡运球", description: "平稳的腰侧节奏，适合移动与左右换手。", period: .65, sprintPeriod: .43, height: .95, spread: .31, front: .40, torso: -.08, twist: .025 },
    low: { title: "低重心控球", description: "降低运球高度，收紧节奏与持球空间。", period: .55, sprintPeriod: .39, height: .68, spread: .28, front: .37, torso: -.13, twist: .06 },
    wide: { title: "横向变向", description: "扩大左右落点，配合肩腰转动完成换手。", period: .71, sprintPeriod: .47, height: .90, spread: .41, front: .36, torso: -.09, twist: .10 },
  } satisfies Record<string, DribbleMotionPack>,
  layup: {
    standard: { title: "标准上篮", description: "两步收球，抬膝后单手柔和挑篮。", releaseAt: .74, jump: .72, offset: .20, originY: 2.82, lateral: 0, twist: .17, twoHands: false },
    scoop: { title: "低手挑篮", description: "从较低持球位置延伸手臂，低手送球。", releaseAt: .70, jump: .62, offset: .20, originY: 2.65, lateral: 0, twist: .12, twoHands: false },
    euro: { title: "欧洲步", description: "两步横向错开，身体转向后完成挑篮。", releaseAt: .76, jump: .74, offset: .20, originY: 2.82, lateral: .30, twist: .30, twoHands: false },
  } satisfies Record<string, FinishMotionPack>,
  dunk: {
    "one-hand": { title: "单手扣篮", description: "助跑收球，单臂伸展后将球压入篮筐。", releaseAt: .89, jump: 1.16, offset: 0, originY: 3.20, lateral: 0, twist: .14, twoHands: false },
    "two-hand": { title: "双手扣篮", description: "双手收球与上举，保持两手接触至压筐释放。", releaseAt: .89, jump: 1.17, offset: 0, originY: 3.20, lateral: 0, twist: .04, twoHands: true },
  } satisfies Record<string, FinishMotionPack>,
} as const;

export type MotionPackSelection = { -readonly [Category in keyof typeof motionPacks]: keyof typeof motionPacks[Category] };
export type MotionPackCategory = keyof MotionPackSelection;
export const defaultPacks: MotionPackSelection = { shot: "classic", hands: "natural", dribble: "balanced", layup: "standard", dunk: "two-hand" };

export function normalizePacks(raw: unknown): MotionPackSelection {
  const result = { ...defaultPacks };
  if (!raw || typeof raw !== "object") return result;
  const source = raw as Record<string, unknown>;
  for (const category of Object.keys(defaultPacks) as MotionPackCategory[]) {
    const id = source[category];
    if (typeof id === "string" && Object.hasOwn(motionPacks[category], id)) {
      // 每组只接受自己的目录键，拒绝存档中跨组或过期的动作 ID。
      Object.assign(result, { [category]: id });
    }
  }
  return result;
}
