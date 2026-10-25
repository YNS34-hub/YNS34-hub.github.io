import { lstat, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAvatarProfile } from "../src/worlds/presence/avatarProfile.mjs";

export async function registerPersonalAvatar(root, output, publicBuild) {
  let profile = null, head = null;
  if (!publicBuild) {
    const file = path.join(root, "personal-media/avatar/profile.json");
    try {
      const stat = await lstat(file);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4096) profile = validateAvatarProfile(JSON.parse(await readFile(file, "utf8")));
      if (profile) {
        const atlas = path.join(root,"personal-media/avatar/head-color.png"), info = await lstat(atlas).catch(() => null);
        if (info?.isFile() && !info.isSymbolicLink() && info.size <= 8*1024*1024 && info.size >= 24) {
          const bytes = await readFile(atlas);
          if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.readUInt32BE(16) === bytes.readUInt32BE(20) && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 2048) {
            await writeFile(path.join(output,"avatar-head.png"),bytes); head = "/personal-media/avatar-head.png";
          }
        }
      }
    } catch (error) { if (error.code !== "ENOENT") console.warn("Local avatar profile unavailable; using the default athlete."); }
  }
  // 公共版本明确为空；既不读取原照片，也不把私人人物参数混进公开素材清单。
  if (!head) await rm(path.join(output,"avatar-head.png"),{force:true});
  await writeFile(path.join(output, "avatar.json"), JSON.stringify(head ? { profile, head } : { profile }));
}
