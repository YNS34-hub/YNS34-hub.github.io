import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAvatarProfile } from "../src/worlds/presence/avatarProfile.mjs";

export async function registerPersonalAvatar(root, output, publicBuild) {
  let profile = null;
  if (!publicBuild) {
    const file = path.join(root, "personal-media/avatar/profile.json");
    try {
      const stat = await lstat(file);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4096) profile = validateAvatarProfile(JSON.parse(await readFile(file, "utf8")));
    } catch (error) { if (error.code !== "ENOENT") console.warn("Local avatar profile unavailable; using the default athlete."); }
  }
  // 公共版本明确为空；既不读取原照片，也不把私人人物参数混进公开素材清单。
  await writeFile(path.join(output, "avatar.json"), JSON.stringify({ profile }));
}
