import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {Quaternion} from 'three';
import path from 'node:path';

const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/sports-detail/clarity');await mkdir(out,{recursive:true});
const report={before:'12671dfb211a3059c870dc7d00bf9d5ed6a8b3df',after:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Actual static wardrobe view at medium, 1920×1080 and controlled DPR1 on both versions. Same existing wardrobe camera / logical start / neutral actor / outfit / daylight. Render resolution is controlled only for this optical comparison; normal gameplay uses its own adaptive DPR.',views:[]};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
try{
 for(const [label,base]of [['before',process.env.PALACE_BASELINE_URL||'http://127.0.0.1:5193'],['after',process.env.PALACE_URL||'http://127.0.0.1:5190']]){
  if(label==='before')assert.equal((await(await fetch(base+'/qa-baseline.json')).json()).sha,report.before);
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
  await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'medium',tutorialDone:true,roomSoundtracks:false},version:0})));
  const page=await context.newPage();page.setDefaultTimeout(90000);
  await page.goto(base+'/basketball?view=third');await page.waitForFunction(()=>window.__PRESENCE_DEBUG__&&!window.__PRESENCE_DEBUG__.activity.getState().warming&&document.querySelector('.world-ready'));
  await page.evaluate(()=>{const c=window.__PRESENCE_DEBUG__.presence.camera,s=window.__PALACE_DEV__.state.getState();c.position.set(0,1.65,3);c.lookAt(0,1.75,-12.1);s.update({travelSequence:s.travelSequence+1,returnView:{roomId:'basketball',position:c.position.toArray(),quaternion:c.quaternion.toArray()}});});
  await page.getByRole('button',{name:'人物 / 穿搭',exact:true}).click();await page.getByRole('dialog',{name:'人物与穿搭'}).waitFor();await page.waitForTimeout(1500);
  // 固定同一输出分辨率来比较真实贴图 / 材质；不注入任何游戏状态，不用镜头拉近冒充清晰度。
  await page.evaluate(()=>window.__PALACE_DEBUG__.renderer.setPixelRatio(1));await page.waitForTimeout(250);
  const view=await page.evaluate(()=>{const d=window.__PALACE_DEBUG__,a=d.scene.getObjectByName('visitor-athlete'),maps=new Map();a.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))if(m.map)maps.set(m.map.uuid,{name:m.name,width:m.map.image.width,height:m.map.image.height});});return{position:d.camera.position.toArray(),quaternion:d.camera.quaternion.toArray(),fov:d.camera.fov,dpr:d.renderer.getPixelRatio(),drawing:[d.renderer.domElement.width,d.renderer.domElement.height],maps:[...maps.values()]};});
  assert.equal(view.dpr,1);assert.deepEqual(view.drawing,[1920,1080]);assert.ok(view.maps.every(m=>m.width===(label==='before'?1024:2048)));
  await page.screenshot({path:path.join(out,label+'.png')});report.views.push({label,...view});await context.close();
 }
 const [a,b]=report.views;report.positionDelta=Math.hypot(...a.position.map((v,i)=>v-b.position[i]));report.angleRadians=new Quaternion(...a.quaternion).angleTo(new Quaternion(...b.quaternion));
 assert.ok(report.positionDelta<.001&&report.angleRadians<.0001);assert.equal(a.fov,b.fov);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e.stack);}finally{await writeFile(path.join(out,'clarity.json'),JSON.stringify(report,null,2));await browser.close();}
