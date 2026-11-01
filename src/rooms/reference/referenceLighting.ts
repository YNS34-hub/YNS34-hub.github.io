type ArchitecturalLight = {
  background: string; sky: string; ground: string; key: string;
  keyIntensity: number; environment: number; hemisphere: number; dark: boolean;
};

// 只用于已复核的主展室；分页、体育和其余房间继续原照明配置。
const themes: Record<string, ArchitecturalLight> = {
  atrium: { background: "#94a3ad", sky: "#dfe8ed", ground: "#62676b", key: "#f5e9d9", keyIntensity: 1.65, environment: .46, hemisphere: .3, dark: false },
  projects: { background: "#1a2027", sky: "#d6dfe5", ground: "#696159", key: "#f4e8d9", keyIntensity: 1.35, environment: .36, hemisphere: .4, dark: true },
  research: { background: "#a4b3be", sky: "#dce7ed", ground: "#7b7770", key: "#fff0da", keyIntensity: 1.15, environment: .38, hemisphere: .48, dark: true },
  music: { background: "#161c23", sky: "#cbd9e3", ground: "#63584e", key: "#f6dfbd", keyIntensity: .3, environment: .32, hemisphere: .44, dark: true },
  wallpapers: { background: "#171e25", sky: "#d5dfe7", ground: "#665f58", key: "#f5e8d5", keyIntensity: .52, environment: .34, hemisphere: .4, dark: true },
};

export function referenceRoomLighting(roomId: string) { return themes[roomId]; }
