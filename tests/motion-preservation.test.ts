import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

// 这些摘要来自固定的 6380557；只规范化 Windows 换行，不依赖 CI 的 Git 历史或本地素材。
const locked = {
  "src/App.tsx": "db9f6782834e65072274548e3f1dd1394c09d1cf7a4f1b677a6e11765d0bc92a",
  "src/world/World.tsx": "f886e81c3a1194250334a72f037fd600ac276f0e913596f1f0513a6a0c3a54d5",
  "src/world/Player.tsx": "64524150cb87df0a078475e3eb1e2d96db56746c7df8157d3a1a4ea87910d2a2",
  "src/world/collision.ts": "d603d0c54cbd988d155762d8e8dd841b9986fee13e4b35a0575a643597160411",
  "src/world/roomPlan.ts": "a5f0aee739d9d26ca2471068dbecb433c83da8062e0c4ede4b5d1ebc4d17ebea",
  "src/world/visitView.ts": "74af65a178353c48c3b5d02bc967c382350eb5ef71dfb1296ae3042396b8b569",
  "src/world/GlassSculpture.tsx": "d46c0743d7e360f3cb6bde89e0deb5e981e1e86594d0a019751ef0313d6ccd67",
  "src/world/artDirection.ts": "145cc17a125e18ec6dd2bf1d4f76a54241fb483829a9446ed4f8d86db4799063",
  "src/world/primitives.tsx": "c8bb13449f6b085f9be981a250529b555b505ecc2e5ae775ee703942ac0fb8bd",
  "src/world/pictureFit.ts": "d62cbd77f4790e922c27daae3bde8f1c2c283fa4b097b59cacf2f0efa4f85721",
  "src/world/textureCache.ts": "d50db7db7ea9ea85a1730997fc3dd7cfd1dd4f3dd561281e511c79aa22b365e8",
  "src/world/IdentityContrast.tsx": "1c6846181257b146164856a3131925391c2f345bab980e329d6324ab7b43dede",
  "src/rooms/Atrium.tsx": "9b14dbb1d5e4c5cf2075f49fc1e2a164d5709affe188534ebbbc9e4d42ded0dd",
  "src/rooms/Architecture.tsx": "6b484ba4ceebf35c7ce058e7665e16496452e687c67c0b4068644ecb15d60248",
  "src/rooms/Corridor.tsx": "ad0edc18af39afc886593b10204b25ef9aa0407b572b322beb3e72cb5d330fad",
  "src/rooms/LyricsWall.tsx": "29dfb3a7904cc584e24cf5dc88d2150297498f3861df58d11398a2ae0610b0a5",
  "src/audio/player.ts": "2a709f3ebcff4344f358b2b6fcd0b2579b52a7253e78fca397c229c3bfa4b787",
  "src/audio/AudioSystem.tsx": "018fcf6b08b5c09b60ed21b6b67a20aee5f5daabb05a0d2b1aa050399e6d470c",
  "src/audio/lyrics.mjs": "e2d31441c857e33482944f3ff5d6a905d9a276af87e1ca659d7b053328ad4515",
  "src/audio/signal.ts": "73c765cf27ebdc15a691f1f81f1fb5c385736857361ce34619bbc9f9b90c6b4d",
  "src/audio/persistence.ts": "1a1662fdb5a250c11650974046ee8e92dd7ab928474870745c2eef7b575b1b78",
  "src/audio/playlist.ts": "3a6680de91a094d0fb122b2f7829102cf8b0d461b4f207231c01628369fa0cc9",
  "src/audio/roomMusic.ts": "7e68dcfe33381f4267240aac10aa1bf0ce93c62caebea03abb1550544e8b89f7",
  "src/systems/library.ts": "00c2ec5898d63394c36a915c5aa4773111a6c43efa8e2c6e9b052805c0a6fe6a",
  "src/systems/store.ts": "ecc50e7259a9304179f4d378ae896606074c85948d4576fcf91608f6af08c7cc",
  "src/systems/idb.ts": "f3e5a751b575e671e870767857f6efbdd5c984f9a12d737aa0bd0f5a8014e547",
  "src/systems/spatialLyrics.ts": "1f34b00e69846a60ea12e7785a56098cbe3c36882bb018ff9b5bc56ecb7ced3c",
  "src/systems/mediaPlacement.ts": "73842a95d94a4acf4f2c16bdd4bce575bb76327265fb510c64fb15f9f8ce556e",
  "src/systems/identityTone.ts": "b21b6ac269b251e1ea7d9d30613f3ee7f491e6c7a11f8f471faa62d5004f0d6e",
  "src/ui/primitives.tsx": "70e7bccea03a4680be6fd9780b83ceba1d2b668d64ab2b662b89c2c57f0894b6",
  "src/ui/palace.css": "33b6798411e8dd821bf92b1e642ceb4faa8683e8d0bf26215ac7c508b6d56635",
  "scripts/register-personal-media.mjs": "67fcfa21d7b69fd23de24ca870998105679b4cc9eb5e7ed218c7661158ca09b8",
  "scripts/postbuild.mjs": "9bf28205935c31716deab75b17d5e61fb14f4ba2fe162bcf008c3bfe7bf6597f"
};
const rooms = {
  "src/rooms/ListeningRoom.tsx": "c81150d6a2ba816651c377c44f7f4c08208f747985f0060b5674a5ea8996c813",
  "src/rooms/PersonalRooms.tsx": "627572f050bcefc1b8d544f672e0100734498491af030eccec852d4d563d6acc",
  "src/rooms/Wallpapers.tsx": "cb5b7656f6c5587e681c760b255eaafc6df6868385c912dc4da12ef2c70ea5d0"
};
const digest = (source: string) => createHash("sha256").update(source.replace(/\r\n/g, "\n")).digest("hex");

// 新世界仅准许在白名单插入点追加；删去明确标记的新层后，原源码仍必须逐字匹配固定基线。
// 这保留原有摘要检查，不能通过重新记录新摘要掩盖对旧播放器、建筑或导航的改写。
const additions: Record<string, string[]> = {
  "src/App.tsx": ["app-import", "app-hud"],
  "src/world/World.tsx": ["world-import", "world-interaction", "world-environment-open", "world-environment-close", "world-boundary-open", "world-boundary-close", "world-presence-camera"],
  "src/world/Player.tsx": ["player-import", "player-world-view", "player-cycle-locomotion", "player-presence-init", "player-presence-pause", "player-court-finish", "player-presence-sprint", "player-presence-speed", "player-court-keyboard"],
  "src/world/collision.ts": ["collision-import", "collision-world-bounds", "collision-world-footprints"],
  "scripts/register-personal-media.mjs": ["media-avatar-import", "media-avatar-register"],
};
function withoutAdditions(file: string, source: string) {
  if(file==='src/world/World.tsx'){
    const clarity=JSON.parse(readFileSync('tests/fixtures/sports-clarity-adapters.json','utf8')) as {baseline:string;baselineWorldSha256:string;files:Record<string,{before:string;after:string}[]>};
    expect(clarity.baseline).toBe('56238d5f8e7bb42c6924917c7100e15567521fd8');
    expect(Object.keys(clarity.files)).toEqual(['src/world/World.tsx']);
    expect(clarity.files[file]).toHaveLength(5);
    source=source.replace(/\r\n/g,'\n');
    for(const patch of clarity.files[file]){expect(source.split(patch.after),file+' exact clarity adapter').toHaveLength(2);source=source.replace(patch.after,patch.before);}
    expect(digest(source)).toBe('cd85bf1479a686fafb14d355abd9699a0073fc37aeed00ce94486e24786eab17');
    expect(clarity.baselineWorldSha256).toBe('cd85bf1479a686fafb14d355abd9699a0073fc37aeed00ce94486e24786eab17');
  }

  const gym=JSON.parse(readFileSync('tests/fixtures/private-gym-adapters.json','utf8')) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
  expect(gym.baseline).toBe('5f90eafbe5e329e59bcdef3b9c10b1c2e288ec3d');
  expect(Object.keys(gym.files).every(name=>['src/App.tsx','src/world/World.tsx','src/world/Player.tsx','src/world/collision.ts','src/world/artDirection.ts','src/rooms/Atrium.tsx'].includes(name))).toBe(true);
  source=source.replace(/\r\n/g,'\n');for(const patch of gym.files[file]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
  const refinement=JSON.parse(readFileSync('tests/fixtures/museum-refinement-adapters.json','utf8')) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
  expect(refinement.baseline).toBe('be675d7246d0f8c1ce468f05f5b8c88aad017885');
  expect(Object.keys(refinement.files).every(name=>['src/rooms/Atrium.tsx','src/world/artDirection.ts','src/systems/store.ts'].includes(name))).toBe(true);
  source=source.replace(/\r\n/g,'\n');for(const patch of refinement.files[file]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
  // 仅撤销本轮明确要求的运动键位和像素配置，再继续所有入口 / 旧架构与固定摘要检查。
  if(["src/world/Player.tsx","src/world/World.tsx"].includes(file)){
    const sport=JSON.parse(readFileSync("tests/fixtures/sport-detail-adapters.json","utf8")) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
    expect(sport.baseline).toBe("12671dfb211a3059c870dc7d00bf9d5ed6a8b3df");
    expect(Object.keys(sport.files).every(name=>["src/world/Player.tsx","src/world/World.tsx"].includes(name))).toBe(true);
    source=source.replace(/\r\n/g,"\n");for(const patch of sport.files[file]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
  }
  // 本轮用户明确授权中庭美术与面板呈现：逐段撤销局部 diff 后，仍校验所有旧固定摘要。
  // 不把播放器、导航、素材库或其他房间加入白名单，也不重写任何原摘要。
  if (["src/rooms/Atrium.tsx", "src/ui/primitives.tsx", "src/world/artDirection.ts", "src/world/World.tsx"].includes(file)) {
    const entry = JSON.parse(readFileSync("tests/fixtures/museum-entry-adapters.json", "utf8")) as { baseline: string; files: Record<string, { before: string; after: string }[]> };
    expect(entry.baseline).toBe("4dfaab7044b71286afa6a15cb959949cfdf6271c");
    expect(Object.keys(entry.files).every(name => ["src/rooms/Atrium.tsx", "src/ui/primitives.tsx", "src/world/artDirection.ts", "src/world/World.tsx"].includes(name))).toBe(true);
    source = source.replace(/\r\n/g, "\n");
    for (const patch of entry.files[file] ?? []) {
      if (file === "src/world/artDirection.ts") expect(patch.before).toContain("atrium: {");
      if (file === "src/world/World.tsx") { expect(patch.before).toContain("gl.transmissionResolutionScale"); expect(patch.after).toContain('roomId === "atrium"'); }
      expect(source.split(patch.after)).toHaveLength(2); source = source.replace(patch.after, patch.before);
    }
  }
  if(file==="src/world/World.tsx"){
    // 仅撤销用户本轮授权的高山 DPR 配置；随后继续原 6380557 插入点和固定摘要保护。
    const fixture=JSON.parse(readFileSync("tests/fixtures/alpine-clarity-adapters.json","utf8")) as {baseline:string;files:Record<string,{before:string;after:string}[]>};
    expect(fixture.baseline).toBe("8a66c0083483f5dd9bf33df1903f060401f04cea");source=source.replace(/\r\n/g,"\n");
    for(const patch of fixture.files["World.tsx"]??[]){expect(source.split(patch.after)).toHaveLength(2);source=source.replace(patch.after,patch.before);}
  }
  const seen: string[] = [];
  let clean = source.replace(/^[ \t]*(?:\/\/|\{\/\*) 交互扩展开始 ([\w-]+).*\r?\n[\s\S]*?^[ \t]*(?:\/\/|\{\/\*) 交互扩展结束.*\r?\n/gm, (_, id: string) => {
    seen.push(id);
    return "";
  });
  expect(seen.sort(), file + " insertion points").toEqual((additions[file] || []).slice().sort());
  if (file === "src/world/Player.tsx") {
    // 第三人称仅在户外接入逻辑相机和更新顺序；逐项校验适配表达式后还原，固定原摘要不变。
    const adapters = [
      ['const { camera: renderCamera, gl } = useThree();\n  const camera = actorCamera(renderCamera, roomId);', 'const { camera, gl } = useThree();'],
      ['input.has("ShiftLeft") || input.has("ShiftRight") || roomId === "basketball" && (input.has("Enter") || input.has("NumpadEnter")) ? roomId === "basketball" ? 6.2 : 4.45 : 2.7;', 'input.has("ShiftLeft") || input.has("ShiftRight") ? 4.45 : 2.7;'],
      ['clock.elapsedTime - footstepsAt.current > (roomId === "basketball" && presence.speed > 4 ? .33 : .58)', 'clock.elapsedTime - footstepsAt.current > 0.58'],
      ['}, isAdventureRoom(roomId) ? -4 : 0);', '});'],
    ];
    clean = clean.replace(/\r\n/g, '\n');
    for (const [current, original] of adapters) { expect(clean, "explicit outdoor adapter").toContain(current); clean = clean.replace(current, original); }
  }
  // 用户于 2026-10-09 明确撤下 VOID//ECHO；仅还原两处展品数据表达式作基线比对，建筑其余字节仍严格保护。
  if (file === "src/rooms/Atrium.tsx") {
    expect(clean).toContain('const hero = projects.find((x) => x.id === "giannis-fansite");');
    expect(clean).toContain('text={hero.title.toUpperCase()}');
    return clean
      .replace('const hero = projects.find((x) => x.id === "giannis-fansite");', 'const hero = projects.find((x) => x.id === "void-echo");')
      .replace('text={hero.title.toUpperCase()}', 'text="VOID//ECHO"');
  }
  return clean;
}

// 对可插入 motion 的三处组件，只检查原建筑/材料属性；事件、时间包络和无变换包装层可独立演进。
const physical = new Set(["position","rotation","scale","args","width","height","depth","color","roughness","metalness","transmission","thickness","ior","attenuationColor","attenuationDistance","envMapIntensity","emissive","emissiveIntensity","intensity","distance","angle","penumbra","castShadow","receiveShadow","medium","opacity","transparent","toneMapped"]);
function architecture(source: string) {
  const ast = ts.createSourceFile("room.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result: [string, string[]][] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      // 新标题包装层只接收原尺寸；继续遍历其内部原展品属性，摘要不变。
      if (!["WorkAttention", "ProjectionReveal", "PosterCaption"].includes(tag)) {
        const attrs = node.attributes.properties.filter(a => ts.isJsxAttribute(a) && physical.has(a.name.getText(ast)))
          .map(a => a.getText(ast).replace(/\s+/g, ""));
        if (attrs.length) result.push([tag, attrs]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return JSON.stringify(result);
}
describe("6380557 preservation boundary", () => {
  it("preserves locked architecture, audio, lyrics, navigation, imports, identity and privacy source", () => {
    for (const [file, expected] of Object.entries(locked)) expect(digest(withoutAdditions(file, readFileSync(file, "utf8"))), file).toBe(expected);
  });
  it("preserves room geometry, physical proportions, materials and lights around new motion wrappers", () => {
    for (const [file, expected] of Object.entries(rooms)) expect(digest(architecture(readFileSync(file, "utf8"))), file).toBe(expected);
  });
});
