import { create } from "zustand";

export const courtSets = {
  park: { title: "公园球场", description: "保留原来的树荫、围网与日夜球场。", indoor: false, surface: "#596158", line: "#e9e5d6", accent: "#31534b", floor: "original" },
  blacktop: { title: "城市黑街", description: "粗粒沥青、钢丝围网与街区楼面，回到城市街球。", indoor: false, surface: "#303438", line: "#eee5cd", accent: "#9a7745", floor: "asphalt" },
  "retro-arena": { title: "复古馆场", description: "拼接木地板、酒红阶梯席与钢架顶棚的经典馆场。", indoor: true, surface: "#ae8457", line: "#f5ead3", accent: "#692c36", floor: "parquet" },
  "practice-gym": { title: "日光训练馆", description: "明亮枫木、高窗与简洁场边，专注每一次训练。", indoor: true, surface: "#c3a377", line: "#fcf9ed", accent: "#305b64", floor: "maple" },
  rooftop: {title:"城市天台",description:"高处围网、城市天际线与夜间窗光。",indoor:false,surface:"#465962",line:"#f0e6d2",accent:"#ad653f",floor:"asphalt"},
} as const;
export type CourtSetId = keyof typeof courtSets;
const KEY = "memory-palace:court-set:v1";
export const normalizeCourtSet = (raw: unknown): CourtSetId => typeof raw === "string" && Object.hasOwn(courtSets, raw) ? raw as CourtSetId : "park";
function read(): CourtSetId { try { return normalizeCourtSet(localStorage.getItem(KEY)); } catch { return "park"; } }
export const useCourtSet = create<{ selected: CourtSetId; setCourt: (id: CourtSetId) => void }>(set => ({
  selected: read(),
  setCourt: id => {
    if (!Object.hasOwn(courtSets, id)) return;
    try { localStorage.setItem(KEY, id); } catch { /* 禁用本机存储时仍可在本次会话切换；不改写球场物理或人物存档。 */ }
    set({ selected: id });
  },
}));

export interface CourtSetBlock {
  position: [number, number, number]; scale: [number, number, number]; color?: string;
  rotation?: [number, number, number]; kind?: "bag" | "bottle";
}
export interface CourtSetLayout {
  floor: CourtSetBlock[]; structure: CourtSetBlock[]; seats: CourtSetBlock[]; windows: CourtSetBlock[];
  lamps: CourtSetBlock[]; facades: CourtSetBlock[]; gear: CourtSetBlock[];
}
function boardTint(arena: boolean, seed: number) {
  const base = arena ? [163, 129, 88] : [185, 159, 119], variation = (seed * 73 % 23 - 11) * .48;
  return "#" + base.map(value => Math.round(value + variation).toString(16).padStart(2, "0")).join("");
}
export function courtSetLayout(id: CourtSetId): CourtSetLayout {
  const layout: CourtSetLayout = { floor: [], structure: [], seats: [], windows: [], lamps: [], facades: [], gear: [] };
  const add = (group: keyof CourtSetLayout, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: string, rotation?: [number, number, number], kind?: "bag" | "bottle") =>
    layout[group].push({ position: [x, y, z], scale: [sx, sy, sz], ...(color ? { color } : {}), ...(rotation ? { rotation } : {}), ...(kind ? { kind } : {}) });
  if (id === "park") return layout;
  if(id==='rooftop'){
    for(const side of[-1,1]){
      add('structure',side*13.65,.25,0,.24,.5,36.8,'#687371');
      for(let z=-18;z<=18;z+=3)add('structure',side*13.3,1.68,z,.08,3.36,.08,'#465759');
      for(const y of[.12,3.32])add('structure',side*13.3,y,0,.075,.055,36,'#71817d');
      if(side<0)add('structure',0,.25,side*18.60,26.8,.5,.22,'#687371');
      else for(const x of[-7.85,7.85])add('structure',x,.25,18.60,11.1,.5,.22,'#687371');
      for(const z of[-9,9]){
        add('structure',side*13.1,4.6,z,.14,9.2,.14,'#405456');
        add('structure',side*11.8,9.2,z,2.7,.16,.22,'#405456');
        add('structure',side*10.5,9.16,z,.94,.18,.63,'#405456');
        add('lamps',side*10.5,9.04,z,.76,.06,.46);
      }
      for(let slat=0;slat<4;slat++){
        add('structure',side*14.4+(slat-1.5)*.135,.51,3,.11,.075,5.8,'#806b51');
        add('structure',side*14.68,.72+slat*.12,3,.075,.095,5.8,'#8e775a');
      }
      for(const z of[.8,5.2])add('structure',side*14.4,.24,z,.55,.48,.075,'#485653');
      for(const z of[-18.8,18.8]){
        add('structure',side*13.8,3.35,z,.28,6.7,.28,'#536b6d');
        for(const y of[.45,2.4,4.4,6.3])add('structure',side*13.8,y,z,.34,.12,.35,'#a6a896');
      }
      for(let building=0;building<6;building++){
        const x=side*(34+(building%2)*13),z=-38+building*16,height=18+(building*13+(side+1)*3)%24,top=height-24;
        add('facades',x,height/2-24,z,10,height,10,['#637578','#76837e','#8b8171'][building%3]);
        add('structure',x,top+.10,z,10.4,.20,10.4,'#a1a99e');
        add('structure',x,top+.65,z,6.6,1.1,6.6,'#5c706e');
        for(let y=-20;y<top-1;y+=3.2){
          add('structure',x-side*5.07,y-1.0,z,.15,.14,10,'#a0a99e');
          for(const dz of[-3,0,3]){add('windows',x-side*5.04,y,z+dz,.055,1.5,1.45,building%2?'#657f88':'#536e7b');add('structure',x-side*5.10,y,z+dz,.06,1.55,.055,'#9ca79f');}
        }
      }
    }
    for(const z of[-18.8,18.8]){
      for(const y of[5.65,6.6])add('structure',0,y,z,27.9,.18,.18,'#536b6d');
      for(let bay=0;bay<10;bay++){const width=2.79,depth=.95;add('structure',-13.95+width*(bay+.5),6.125,z,Math.hypot(width,depth),.09,.09,'#6a8382',[0,0,Math.atan2(depth,width)*(bay%2?1:-1)]);}
    }
    for(let building=0;building<5;building++){
      const x=-28+building*14,z=building%2?-64:-54,height=20+building*7%20,top=height-27;
      add('facades',x,height/2-27,z,8.5,height,9,['#718082','#8c897b','#617579'][building%3]);
      add('structure',x,top+.1,z,8.8,.2,9.3,'#b0b1a2');
      for(let y=-23;y<top-1;y+=3.2){add('structure',x,y-.95,z+4.58,8.5,.13,.14,'#a6aca2');for(const dx of[-2.6,0,2.6]){add('windows',x+dx,y,z+4.55,1.3,1.5,.055,'#66828b');add('structure',x+dx,y,z+4.61,.055,1.55,.05,'#a6aca2');}}
    }
    for(const side of[-1,1]){
      const x=side*44,z=-86,height=side<0?64:57,top=height-28;
      add('facades',x,height/2-28,z,12,height,12,side<0?'#536f7b':'#73858b');
      add('structure',x,top+.6,z,10.8,1.2,10.8,'#a5b5ac');add('structure',x,top+3,z,.12,5,.12,'#7f9d9c');
      for(let y=-24;y<top-1;y+=3.2){add('structure',x,y-.9,z+6.08,12,.1,.1,'#9eb1ad');for(const dx of[-4,-2,0,2,4])add('windows',x+dx,y,z+6.05,1.35,1.55,.05,'#799ba7');}
    }
    add('structure',-16.7,1.5,10,4,3,5,'#78847e');
    add('structure',-16.7,3.08,10,4.25,.16,5.25,'#acafa0');
    add('windows',-14.65,1.55,10,.055,1.7,1.3,'#4c646b');
    for(let vent=0;vent<3;vent++){
      add('structure',16.5,.68,-12+vent*1.6,1.4,1.35,1.2,'#909c93');
      for(let fin=0;fin<4;fin++)add('structure',15.77,.34+fin*.18,-12+vent*1.6,.025,.055,.9,'#586e6b');
    }
    add('gear',14.9,.68,2,.56,.3,.32,'#6b5745',undefined,'bag');
    add('gear',14.8,.68,3,.11,.35,.11,'#809e95',undefined,'bottle');
    return layout;
  }
  if (id !== "blacktop") {
    const arena = id === "retro-arena", columns = arena ? 200 : 240, width = 24 / columns;
    // 真实窄木条；错缝头尾裁切，主体板长 2.1—2.75 m。渲染为单次实例化平面，不画每块的六面。
    for (let column = 0; column < columns; column++) {
      let cursor = -18, part = 0;
      while (cursor < 18 - .0001) {
        const wanted = part === 0 ? .35 + (column * 37 % 23) / 23 * 2.1 : 2.1 + (column * 11 + part * 29) % 17 / 17 * .65;
        const remaining = 18 - cursor;
        const length = remaining > wanted && remaining - wanted < .25 ? remaining : Math.min(wanted, remaining);
        add("floor", -12 + width * (column + .5), .003, cursor + length * .5, width - .0007, .006, length - .0007, boardTint(arena, column * 41 + part * 97));
        cursor += length; part++;
      }
    }
  }
  if (id === "blacktop") {
    for (const side of [-1, 1]) {
      for (let z = -18; z <= 18; z += 3) add("structure", side * 13.3, 1.68, z, .08, 3.36, .08, "#475252");
      for (const y of [.12, 3.32]) add("structure", side * 13.3, y, 0, .075, .055, 36, "#58605d");
      for (let building = 0; building < 5; building++) {
        const z = -24 + building * 12, height = 8 + building * 3 % 7;
        add("facades", side * 23, height / 2, z, 9, height, 10, ["#827460", "#78807c", "#9a8772"][building % 3]);
        add("structure", side * 23, height + .11, z, 9.45, .22, 10.45, "#a19b8d");
        add("structure", side * 18.38, .50, z, .18, 1, 10, "#645e55");
        for (let level = 2; level < height - 1; level += 2.5) {
          add("structure", side * 18.36, level + .88, z, .22, .13, 10, "#a6a292");
          for (const dz of [-3, 0, 3]) {
            add("structure", side * 18.39, level, z + dz, .10, 1.50, 1.58, "#a3a599");
            add("windows", side * 18.32, level, z + dz, .045, 1.25, 1.33, "#344a52");
            add("structure", side * 18.27, level, z + dz, .035, 1.25, .045, "#687978");
            add("structure", side * 18.27, level, z + dz, .035, .045, 1.33, "#687978");
          }
        }
      }
      for (const z of [-9, 9]) {
        add("structure", side * 13.1, 4.6, z, .14, 9.2, .14, "#3d4b4c");
        add("structure", side * 11.8, 9.2, z, 2.7, .16, .22, "#3d4b4c");
        add("structure", side * 10.5, 9.16, z, .94, .18, .63, "#414d4c");
        add("lamps", side * 10.5, 9.04, z, .76, .06, .46);
      }
      for (let slat = 0; slat < 4; slat++) {
        add("structure", side * 14.4 + (slat - 1.5) * .135, .51, 3, .11, .075, 5.8, "#796a53");
        add("structure", side * 14.68, .72 + slat * .12, 3, .075, .095, 5.8, "#87765b");
      }
      for (const z of [.8, 5.2]) add("structure", side * 14.4, .24, z, .55, .48, .075, "#485653");
    }
    for (let building = 0; building < 4; building++) {
      const x = -12 + building * 8, height = 7 + building % 3 * 2;
      add("facades", x, height / 2, -31, 7.4, height, 8, ["#8c7563", "#7c837b"][building % 2]);
      add("structure", x, height + .11, -31, 7.7, .22, 8.3, "#a3a394");
      for (let level = 2; level < height - 1; level += 2.5) for (const dx of [-2.3, 0, 2.3]) {
        add("structure", x + dx, level, -26.92, 1.38, 1.5, .09, "#acaba0");
        add("windows", x + dx, level, -26.85, 1.13, 1.24, .04, "#3b5156");
        add("structure", x + dx, level, -26.81, .045, 1.24, .03, "#70807a");
      }
    }
    return layout;
  }
  const arena = id === "retro-arena", wallX = arena ? 20 : 16.7, roofY = arena ? 12.5 : 10.7;
  for (const side of [-1, 1]) {
    add("structure", side * wallX, roofY / 2, 0, .3, roofY, 43, arena ? "#a39c90" : "#dedfd6");
    add("structure", 0, roofY / 2, side * 21.5, wallX * 2, roofY, .3, arena ? "#aaa294" : "#dcded4");
    add("structure", side * (wallX - .18), .85, 0, .14, 1.7, 42.9, arena ? "#6b303b" : "#477277");
    add("structure", 0, .85, side * 21.30, wallX * 2 - .4, 1.7, .14, arena ? "#6b303b" : "#477277");
    for (const z of [-16, -8, 0, 8, 16]) add("structure", side * (wallX - .35), roofY / 2, z, .22, roofY - .12, .25, arena ? "#655d55" : "#aeb9ae");
    // 门在现有场地外；南侧中心与原返回门户同轴，不增加可操作入口。
    add("structure", 0, 1.42, side * 21.18, 2.30, 2.84, .16, arena ? "#4e5351" : "#a0aaa1");
    add("structure", 0, 1.31, side * 21.06, 1.93, 2.52, .075, arena ? "#748077" : "#789288");
    add("structure", 0, 1.31, side * 20.995, .055, 2.45, .035, "#c5c7ba");
    add("structure", 0, 1.13, side * 20.96, 1.68, .065, .035, "#c5c7ba");
    if (arena) {
      for (let row = 0; row < 4; row++) {
        const x = side * (13.3 + row * .92), height = .48 + row * .65;
        add("structure", x, height / 2, 0, .92, height, 29, "#565957");
        add("structure", x - side * .43, height + .025, 0, .06, .05, 29, "#9e9c8d");
        for (let seat = 0; seat < 30; seat++) {
          const z = (seat - 14.5) * .92;
          add("seats", x, height + .13, z, .61, .14, .63, "#6a3039");
          add("seats", x + side * .25, height + .45, z, .10, .53, .62, "#72353f");
          if (seat % 4 === 0) add("structure", x, height + .24, z - .37, .48, .045, .045, "#3c4748");
        }
      }
      add("structure", side * 12.84, .92, 0, .055, .055, 28.5, "#667472");
      for (const z of [-14, -7, 7, 14]) add("structure", side * 12.84, .70, z, .055, .44, .055, "#667472");
    } else {
      for (let pane = 0; pane < 8; pane++) {
        const z = (pane - 3.5) * 4.5, x = side * (wallX - .18);
        add("windows", x, 7.4, z, .035, 2.45, 3.60, "#c4d6d0");
        for (const dz of [-1.85, 0, 1.85]) add("structure", side * (wallX - .28), 7.4, z + dz, .085, 2.7, .065, "#7c9087");
        for (const y of [6.08, 7.4, 8.72]) add("structure", side * (wallX - .28), y, z, .085, .075, 3.78, "#7c9087");
      }
      for (let pad = 0; pad < 14; pad++) add("structure", side * (wallX - .29), .88, (pad - 6.5) * 2.95, .10, 1.55, 2.85, pad % 2 ? "#507f80" : "#497577");
      for (let slat = 0; slat < 3; slat++) add("structure", side * 14.3 + (slat - 1) * .15, .48, 0, .13, .10, 8, "#9c8a68");
      for (const z of [-3, 3]) add("structure", side * 14.3, .25, z, .50, .5, .075, "#546b68");
      for (const z of [-2.4, 2.4]) add("gear", side * 14.3, .67, z, .55, .28, .36, side < 0 ? "#364953" : "#584948", undefined, "bag");
      for (const z of [-1.1, 1.1]) add("gear", side * 14.2, .70, z, .11, .34, .11, "#789899", undefined, "bottle");
    }
  }
  add("structure", 0, roofY, 0, wallX * 2 + .5, .24, 43.5, arena ? "#8b877d" : "#e2e1d6");
  for (const z of [-16, -8, 0, 8, 16]) {
    const depth = arena ? 1.2 : .85, top = roofY - .35, bottom = top - depth, span = wallX * 2 - .8, bays = 8, width = span / bays;
    const steel = arena ? "#655449" : "#84978f";
    for (const y of [top, bottom]) add("structure", 0, y, z, span, .14, .14, steel);
    for (let bay = 0; bay < bays; bay++) {
      const angle = Math.atan2(depth, width) * (bay % 2 ? -1 : 1);
      add("structure", -span / 2 + width * (bay + .5), (top + bottom) / 2, z, Math.hypot(width, depth), .10, .10, steel, [0, 0, angle]);
    }
  }
  for (const x of [-6, 6]) for (const z of [-8, 8]) {
    add("structure", x, roofY - 1.04, z, 3.05, .23, .46, "#6f7770");
    add("lamps", x, roofY - 1.18, z, 2.84, .045, .29);
    for (const dx of [-1.1, 1.1]) add("structure", x + dx, roofY - .55, z, .035, .85, .035, "#89958d");
  }
  if (arena) {
    add("structure", 0, 8, -21.25, 7, 2.5, .22, "#202a2a");
    for (const x of [-3.5, 3.5]) add("structure", x, 8, -21.10, .10, 2.55, .08, "#737c70");
    for (const y of [6.73, 9.27]) add("structure", 0, y, -21.10, 7, .10, .08, "#737c70");
  }
  return layout;
}
