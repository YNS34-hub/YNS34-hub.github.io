import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const webRoot=process.env.PALACE_WEB_ROOT||[path.resolve(root,'..'),path.resolve(root,'../basketball-work')].find(candidate=>fs.existsSync(path.join(candidate,'public/media/presence/athlete.gltf')));
if(!webRoot)throw Error('Set PALACE_WEB_ROOT to the web project containing the neutral athlete');
const source=path.join(webRoot,'public/media/presence/athlete.gltf');
const sourceDir=path.dirname(source),out=path.join(root,'SourcePNG');
fs.mkdirSync(out,{recursive:true});
const doc=JSON.parse(fs.readFileSync(source,'utf8')),files=[];
const within=name=>{const f=path.resolve(sourceDir,name);if(!f.startsWith(sourceDir+path.sep))throw Error('External source reference');return f;};
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const buffer of doc.buffers??[]){if(!buffer.uri||buffer.uri.startsWith('data:'))continue;const from=within(buffer.uri),to=path.join(out,path.basename(buffer.uri));fs.copyFileSync(from,to);files.push({source:from,sha256:hash(from),copy:to});buffer.uri=path.basename(to);}
for(const image of doc.images??[]){
 if(!image.uri||image.uri.startsWith('data:'))continue;
 const from=within(image.uri),to=path.join(out,path.basename(image.uri).replace(/\.webp$/i,'.png'));
 if(/\.webp$/i.test(from))execFileSync('ffmpeg',['-v','error','-i',from,'-frames:v','1','-y',to],{stdio:'pipe'});
 else fs.copyFileSync(from,to);
 image.uri=path.basename(to);image.mimeType='image/png';files.push({source:from,sha256:hash(from),copy:to});
}
for(const texture of doc.textures??[])if(texture.extensions?.EXT_texture_webp){texture.source=texture.extensions.EXT_texture_webp.source;delete texture.extensions.EXT_texture_webp;if(!Object.keys(texture.extensions).length)delete texture.extensions;}
for(const key of ['extensionsUsed','extensionsRequired'])if(doc[key])doc[key]=doc[key].filter(x=>x!=='EXT_texture_webp');
const gltf=path.join(out,'athlete.gltf');fs.writeFileSync(gltf,JSON.stringify(doc));
fs.mkdirSync(path.join(root,'Reports'),{recursive:true});fs.writeFileSync(path.join(root,'Reports','source-adaptation.json'),JSON.stringify({source,sourceHash:hash(source),adapted:gltf,files,privateMediaRead:false,webProjectModified:false},null,2));
console.log(JSON.stringify({adapted:gltf,files:files.length,originalSourceUnchanged:true}));
