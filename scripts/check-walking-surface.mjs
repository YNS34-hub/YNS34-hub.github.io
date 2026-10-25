import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/sports-detail/walking');await mkdir(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),scope:'Native walking, mount and dismount. Read-only actual skinned shoe vertices against the visible road surface; no position or simulation injection.',checks:[],poses:[],errors:[],uploads:[]};
const browser=await chromium.launch({channel:'msedge',headless:process.env.PALACE_HEADED!=='1',args:['--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
await context.addInitScript(()=>{
 localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'high',tutorialDone:true,mute:true,roomSoundtracks:false},version:0}));
 localStorage.setItem('memory-palace:alpine:v1',JSON.stringify({route:1,distance:1220,gear:7,comfort:false}));
});
const page=await context.newPage();page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('request',r=>{if(r.method()!=='GET')report.uploads.push(r.url());});
const ready=room=>page.waitForFunction(room=>window.__PALACE_DEBUG__?.roomId===room&&document.querySelector('.world-ready')&&window.__PRESENCE_DEBUG__&&!window.__PRESENCE_DEBUG__.activity.getState().warming,room);
const read=()=>page.evaluate(async()=>{
 const {getRideMap}=await import('/src/worlds/road/maps.ts'),{walkingSurface}=await import('/src/worlds/road/walkingSurface.ts');
 const d=window.__PALACE_DEBUG__,p=window.__PRESENCE_DEBUG__.presence,avatar=d.scene.getObjectByName('visitor-athlete'),map=getRideMap(d.roomId),v=p.camera.position.clone();let lowest=null;
 // 检查真正经骨骼变形的鞋底顶点，不用人物根节点高度替代实际足部接触。
 avatar.updateWorldMatrix(true,true);avatar.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const count=mesh.geometry.getAttribute('position').count;
  for(let i=0;i<count;i++){mesh.getVertexPosition(i,v);mesh.localToWorld(v);if(!lowest||v.y<lowest.y)lowest={x:v.x,y:v.y,z:v.z};}
 });
 const surface=walkingSurface(map,lowest.x,lowest.z);return{room:d.roomId,mounted:window.__PRESENCE_DEBUG__.ride.getState().mounted,root:avatar.position.toArray(),lowest,surface,shoeGap:lowest.y-surface,dpr:d.renderer.getPixelRatio()};
});
const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});const pose={name,...await read()};report.poses.push(pose);return pose;};
try{
 for(const room of ['cycling','alpine-ride']){
  await page.goto((process.env.PALACE_URL||'http://127.0.0.1:5190')+'/'+room+'?view=third');await ready(room);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__.ride.getState().nearBike);await page.keyboard.up('w');await page.waitForTimeout(700);
  const walking=await shot(room+'-walking');assert.equal(walking.mounted,false);assert.ok(Math.abs(walking.shoeGap)<.025,'Actual walking shoe must stay within 2.5 cm of the visible surface');
  await page.getByRole('button',{name:'Mount / ride · E',exact:true}).click();await page.waitForFunction(()=>window.__ROAD_DEBUG__.view.mountProgress===1);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed>2);await page.keyboard.up('w');await page.keyboard.down('Space');await page.waitForFunction(()=>window.__ROAD_DEBUG__.model.speed===0);await page.keyboard.up('Space');
  await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Dismount',exact:true}).click();await page.waitForTimeout(700);
  const dismounted=await shot(room+'-dismounted');assert.equal(dismounted.mounted,false);assert.ok(Math.abs(dismounted.shoeGap)<.025,'Actual shoe must remain above the road after dismount');
  await page.getByRole('button',{name:'Return to the Palace',exact:true}).click();await page.waitForFunction(()=>window.__PALACE_DEBUG__?.roomId==='worlds'&&document.querySelector('.world-ready'));
  report.checks.push(room+' native walk / actual shoe surface / mount / pedal / brake / dismount / return');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);try{await page.screenshot({path:path.join(out,'failure.png')});report.diagnostic=await read();}catch{}}
finally{await writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,frames:report.poses.length}));
