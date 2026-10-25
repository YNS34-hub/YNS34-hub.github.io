import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/museum-entry');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
const report={checks:[],errors:[],uploads:[],base:process.env.PALACE_URL||'http://127.0.0.1:5190',publicBase:process.env.PALACE_PUBLIC_URL||'http://127.0.0.1:5191',passed:false};
const audit=page=>{page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))report.uploads.push(r.method()+' '+r.url());});};
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'low',tutorialDone:true,reducedMotion:true,mute:true,roomSoundtracks:false},version:0})));
 await context.route('**/personal-media/manifest.json',r=>r.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
 await context.route('**/personal-media/avatar.json',r=>r.fulfill({json:{profile:null}}));
 const page=await context.newPage();page.setDefaultTimeout(90000);audit(page);
 await page.goto(report.base+'/');await page.locator('.world-ready canvas').waitFor();
 await page.waitForFunction(()=>window.__PALACE_DEBUG__?.camera.fov===48);
 assert.equal(await page.evaluate(()=>!!window.__PALACE_DEBUG__.scene.getObjectByName('atrium-floor-capture')),false);
 report.checks.push('Low quality preserves original glass silhouette without a reflection render target');
 await page.getByRole('button',{name:'ENTER THE PALACE',exact:true}).click();await page.waitForFunction(()=>window.__PALACE_DEBUG__.camera.fov===60);
 await page.getByRole('button',{name:/GUIDE/}).click();await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 assert.equal(await page.evaluate(()=>window.__PALACE_DEV__.state.getState().started),true);
 report.checks.push('Native enter button, guide, single Escape and reduced-motion camera settling');
 await context.close();
 // 生产版不借助开发调试接口；直接验证字体、按钮和已有非 3D 入口。
 for(const viewport of [{width:1920,height:1080},{width:390,height:844}]){
  const publicContext=await browser.newContext({viewport,deviceScaleFactor:1});
  const p=await publicContext.newPage();p.setDefaultTimeout(90000);audit(p);
  await p.goto(report.publicBase+'/');await p.locator('.world-ready canvas').waitFor();await p.evaluate(()=>document.fonts.ready);
  const type=await p.evaluate(()=>({title:getComputedStyle(document.querySelector('h1')).fontFamily,ui:getComputedStyle(document.body).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.match(type.title,/Cormorant Garamond/);assert.match(type.ui,/Manrope/);assert.equal(type.overflow,false);
  await p.screenshot({path:path.join(out,'public-'+viewport.width+'.png'),animations:'disabled'});
  await p.getByRole('button',{name:'ENTER THE PALACE',exact:true}).click();await p.locator('.hud.is-exploring').waitFor();
  await p.getByRole('button',{name:/GUIDE/}).click();await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');
  await p.goto(report.publicBase+'/?view=index');await p.locator('.index-view').waitFor();
  report.checks.push('Public entry / fonts / guide / index at '+viewport.width+' × '+viewport.height);
  await publicContext.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally{await writeFile(path.join(out,'entry-flows.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(report.checks.join('\n'));
