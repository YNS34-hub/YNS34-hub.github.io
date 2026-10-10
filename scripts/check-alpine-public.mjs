import assert from "node:assert/strict";
import {readFile,readdir,mkdir,writeFile,access} from "node:fs/promises";
import path from "node:path";
import {execFileSync} from "node:child_process";

// 只检查本次 public build 的输出，不遍历本机私人素材目录。
const root=path.resolve("dist"),out=path.resolve(process.env.PALACE_ARTIFACTS||"qa-artifacts/alpine-fidelity");
const manifest=JSON.parse(await readFile(path.join(root,"personal-media/manifest.json"),"utf8"));
const counts=Object.fromEntries(["wallpapers","visuals","music","projects","research"].map(key=>[key,manifest[key].length]));
assert.ok(Object.values(counts).every(count=>count===0),"Public manifest must not contain private library entries");
let privateAudio=0,privateDocuments=0;
async function scan(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    assert.ok(!entry.isSymbolicLink(),"Public output must not link to files outside its build directory");
    if(entry.isDirectory())await scan(file);
    else {
      const personal=path.relative(root,file).replaceAll("\\","/").startsWith("personal-media/");
      if(/\.(mp3|flac|m4a|lrc)$/i.test(entry.name)||personal&&/\.(wav|ogg|aiff)$/i.test(entry.name))privateAudio++;
      if(personal&&(/\.html?$/i.test(entry.name)||entry.name==="collection.json"))privateDocuments++;
    }
  }
}
await scan(root);assert.equal(privateAudio,0);assert.equal(privateDocuments,0);
const routes=Object.fromEntries(await Promise.all(["index.html","alpine-ride/index.html","cycling/index.html","museum/index.html","legacy/index.html"].map(async route=>{await access(path.join(root,route));return [route,true];})));
await mkdir(out,{recursive:true});
await writeFile(path.join(out,"public-privacy.json"),JSON.stringify({sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),manifestCounts:counts,privateAudio,privateDocuments,routes,passed:true},null,2));
console.log("Public build: five empty private collections, no private audio/lyrics/documents, original and new entries retained.");
