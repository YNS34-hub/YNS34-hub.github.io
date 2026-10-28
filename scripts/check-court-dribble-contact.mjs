import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Box3,Ray,Triangle,Vector3} from 'three';
import {chromium} from 'playwright';

const base=process.env.PALACE_URL||'http://127.0.0.1:5194';
const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/dribble-contact/native');
const sourceRoot=path.resolve(process.env.PALACE_SOURCE_ROOT||'.');
const single=process.env.PALACE_DRIBBLE_CONTACT_SINGLE||'';
const profiles=process.env.PALACE_LOCAL_MEDIA_ROOT?[false,true]:[false];
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
assert.equal(fs.existsSync(out),false,'Retain previous surface evidence');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('scripts/check-basketball-refinement.mjs','utf8');
const block=source.slice(source.indexOf('const sourceFiles='),source.indexOf('const sourceHashes='));
const files=[...new Set([...block.matchAll(/['"]((?:src|public)\/[^'"]+)['"]/g)].map(match=>match[1]))];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,file))).digest('hex')]));
const report={at:new Date().toISOString(),base,sourceHashes:hashes(),acceptanceEligible:!single,cases:[],errors:[],uploads:[],
  scope:'Three dribble packs, both hands, actual receive/push render windows at high quality, and each supplied local profile. Published palm markers independently match the real wrist frame and actual skinned palm pad within1cm. Active-arm surface clearance remains at3mm; all passive-arm measurements are retained. Native pack/profile buttons and wardrobe preview only; its pause button is dispatched on the observed render frame. Read-only posed mesh, bones and physical ball. All core upper-arm/forearm vertices are tested against actual skinned torso triangles; closest interior-face signed distances and independent bidirectional X/Z ray parity are checked; open triangle-edge distances are unsigned; shoulder and wrist joining regions are excluded by a fixed25-85percent limb interval. No pose, visibility, bone, camera or score injection.'};

function clearance(surface){
  const triangles=surface.torso.map(points=>new Triangle(...points.map(point=>new Vector3(...point))));
  const closest=new Vector3(),normal=new Vector3(),point=new Vector3(),offset=new Vector3(),hit=new Vector3(),ray=new Ray();
  const bounds=new Box3();for(const triangle of triangles)for(const vertex of [triangle.a,triangle.b,triangle.c])bounds.expandByPoint(vertex);
  assert.ok(triangles.length>40,'Actual chest/waist surface triangles');
  const result={};
  for(const [part,points] of Object.entries(surface.arms)){
    assert.ok(points.length>12,part+' has real core surface samples');
    let minimum=Infinity,minimumUnsigned=Infinity,boundarySamples=0,confirmedInterior=0,worst;
    for(const value of points){
      point.fromArray(value);let distance=Infinity,signed=Infinity,nearest;
      for(const triangle of triangles){
        triangle.closestPointToPoint(point,closest);const squared=point.distanceToSquared(closest);
        if(squared<distance){distance=squared;triangle.getNormal(normal);signed=offset.subVectors(point,closest).dot(normal);nearest=triangle;}
      }
      const distanceMetres=Math.sqrt(distance);minimumUnsigned=Math.min(minimumUnsigned,distanceMetres);
      // A normal at an open patch edge does not define inside/outside. Its
      // closest distance stays unsigned; interior face projections retain sign.
      if(Math.abs(Math.abs(signed)-distanceMetres)>1e-6){boundarySamples++;signed=distanceMetres;}
      if(bounds.containsPoint(point)){
        let insideAxes=0;
        for(const axis of [[1,0,0],[0,0,1]]){
          const counts=[];
          for(const sign of [-1,1]){
            ray.set(point,new Vector3(...axis).multiplyScalar(sign));const hits=[];
            for(const triangle of triangles)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)){
              const value=point.distanceTo(hit);if(!hits.some(old=>Math.abs(old-value)<1e-6))hits.push(value);
            }
            counts.push(hits.length);
          }
          if(counts.every(n=>n%2===1))insideAxes++;
        }
        if(insideAxes===2)confirmedInterior++;
      }
      if(signed<minimum){minimum=signed;worst={point:value,triangle:[nearest.a.toArray(),nearest.b.toArray(),nearest.c.toArray()],distance:Math.sqrt(distance)};}
    }
    result[part]={samples:points.length,minimumSignedMetres:minimum,minimumUnsignedMetres:minimumUnsigned,boundarySamples,confirmedInterior,worst};
  }
  return {torsoTriangles:triangles.length,limbs:result};
}

async function readSurface(page){
  return page.evaluate(()=>{
    const debug=window.__PALACE_DEBUG__,p=window.__PRESENCE_DEBUG__.presence;
    const root=debug.scene.getObjectByName('visitor-athlete'),v=p.ball.clone(),a=v.clone(),b=v.clone(),axis=v.clone();
    const arms=Object.fromEntries(['L_UpperArm','L_Forearm','R_UpperArm','R_Forearm'].map(name=>[name,[]]));
    const torso=[],bones={},palmMarkers={},seen=new Set(),handContact={L:{samples:0,nearest:Infinity,minimumRadial:Infinity},R:{samples:0,nearest:Infinity,minimumRadial:Infinity}};let localHead=false;
    for(const side of ['L','R']){const hand=root.getObjectByName('Bip01_'+side+'_Hand');hand.getWorldPosition(v);a.set(.05,.03,0).applyQuaternion(hand.getWorldQuaternion(p.camera.quaternion.clone())).add(v);const published=side==='L'?p.dribbleLeftPalm:p.dribbleRightPalm;palmMarkers[side]={position:a.toArray(),publishedError:a.distanceTo(published),nearestSkin:Infinity};}
    for(const side of ['L','R'])for(const part of ['UpperArm','Forearm','Hand']){
      root.getObjectByName('Bip01_'+side+'_'+part).getWorldPosition(v);root.worldToLocal(v);bones[side+'_'+part]=v.toArray();
    }
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||mesh.name.startsWith('rider-outline:'))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      for(const material of materials){const image=material.map?.image;if(material.name==='m026_head'&&image?.complete&&image.naturalWidth>0)localHead=new URL(image.currentSrc||image.src,location.href).pathname==='/personal-media/avatar-head.png';}
      if(materials.some(material=>material.name==='m026_hair'))return;
      const geometry=mesh.geometry,indices=geometry.index?.array||Array.from({length:geometry.attributes.position.count},(_,i)=>i);
      const used=new Set(indices),positions=new Map(),weights=new Map();
      for(const i of used){
        const w={torso:0,L_hand:0,R_hand:0};const joints=geometry.attributes.skinIndex,values=geometry.attributes.skinWeight;
        for(let component=0;component<4;component++){
          const bone=mesh.skeleton.bones[joints.getComponent(i,component)]?.name||'',weight=values.getComponent(i,component);
          if(/^Bip01_Spine\d*$/.test(bone))w.torso+=weight;for(const side of ['L','R'])if(bone.startsWith('Bip01_'+side+'_Hand')||bone.startsWith('Bip01_'+side+'_Finger'))w[side+'_hand']+=weight;
          for(const part of Object.keys(arms))if(bone==='Bip01_'+part)w[part]=(w[part]||0)+weight;
        }
        mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);positions.set(i,v.toArray());weights.set(i,w);
        for(const side of ['L','R'])if(w[side+'_hand']>=.65){const radial=v.distanceTo(p.ball)-.12;const contact=handContact[side];contact.samples++;contact.nearest=Math.min(contact.nearest,Math.abs(radial));contact.minimumRadial=Math.min(contact.minimumRadial,radial);palmMarkers[side].nearestSkin=Math.min(palmMarkers[side].nearestSkin,v.distanceTo(a.fromArray(palmMarkers[side].position)));}
        for(const part of Object.keys(arms)){
          if((w[part]||0)<.65)continue;
          root.getObjectByName('Bip01_'+part).getWorldPosition(a);
          // Explicit end names avoid relying on the mesh's bind-space axes.
          root.getObjectByName('Bip01_'+part.slice(0,2)+(part.endsWith('UpperArm')?'Forearm':'Hand')).getWorldPosition(b);
          axis.subVectors(b,a);const ratio=v.clone().sub(a).dot(axis)/axis.lengthSq();
          if(ratio<.25||ratio>.85)continue;
          const key=part+':'+v.toArray().map(n=>Math.round(n*1e6)).join(',');
          if(!seen.has(key)){seen.add(key);arms[part].push(v.toArray());}
        }
      }
      for(let i=0;i<indices.length;i+=3){
        const ids=[indices[i],indices[i+1],indices[i+2]];
        if(ids.every(index=>weights.get(index).torso>=.75))torso.push(ids.map(index=>positions.get(index)));
      }
    });
    return {arms,torso,bones,palmMarkers,localHead,handContact,hand:p.hand,held:p.held,dribbling:p.dribbling,physical:debug.scene.getObjectByName('practice-ball').userData.basketballPhysics.mode,
      wrists:[root.userData.basketballLeftWristError,root.userData.basketballRightWristError],buffer:[debug.renderer.domElement.width,debug.renderer.domElement.height]};
  });
}

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});let page;
try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await context.route('**/personal-media/manifest.json',route=>route.fulfill({json:{wallpapers:[],visuals:[],music:[],projects:[],research:[]}}));
  if(process.env.PALACE_LOCAL_MEDIA_ROOT){
    const media=path.resolve(process.env.PALACE_LOCAL_MEDIA_ROOT);
    for(const [file,type] of [['avatar.json','application/json'],['avatar-head.png','image/png']])
      await context.route('**/personal-media/'+file,route=>route.fulfill({contentType:type,body:fs.readFileSync(path.join(media,file))}));
  }
  await context.addInitScript(()=>localStorage.setItem('memory-palace:v3',JSON.stringify({state:{quality:'high',tutorialDone:true,roomSoundtracks:false},version:0})));
  page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))report.uploads.push(request.method()+' '+request.url());});
  await page.goto(base+'/basketball?view=third');
  await page.waitForFunction(()=>window.__PRESENCE_DEBUG__&&!window.__PRESENCE_DEBUG__.activity.getState().warming&&document.querySelector('.world-ready'));
  await page.getByRole('button',{name:'R · Recall ball',exact:true}).click();
  await page.getByRole('button',{name:'E · Pick up nearby ball',exact:true}).click();
  const wardrobe=page.getByRole('dialog',{name:'人物与穿搭',exact:true});
  for(const personal of profiles)for(const [pack,title] of [['balanced','均衡运球'],['low','低重心控球'],['wide','横向变向']])for(const hand of[1,-1])for(const timing of ['receive','push']){
    const name=(personal?'photo':'base')+'-'+pack+'-'+(hand<0?'left':'right')+'-'+timing;
    if(single&&single!==name)continue;
    await page.getByRole('button',{name:'人物 / 穿搭',exact:true}).click();
    const basic=wardrobe.getByRole('button',{name:'基础角色',exact:true});
    if(personal)await wardrobe.getByRole('button',{name:'照片参考角色 · 仅本机',exact:true}).click();else if(await basic.count())await basic.click();
    await wardrobe.locator('fieldset[data-package-category="dribble"]').getByRole('button',{name:new RegExp(title)}).click();
    await wardrobe.locator('.court-hand-choice').getByRole('button',{name:hand<0?'左手':'右手',exact:true}).click();
    await wardrobe.getByRole('button',{name:'全身',exact:true}).click();
    await wardrobe.getByRole('button',{name:'应用并返回场景',exact:true}).click();
    if(!await page.evaluate(()=>window.__PRESENCE_DEBUG__.presence.dribbling))await page.getByRole('button',{name:'E · Dribble',exact:true}).click();
    await page.waitForFunction(h=>{const p=window.__PRESENCE_DEBUG__.presence,r=window.__PALACE_DEBUG__.scene.getObjectByName('visitor-athlete');return p.hand===h&&p.dribbleBlend===1&&r.userData.basketballDribbleArmBlend===1;},hand);
    await page.waitForTimeout(1400);
    // Click the native wardrobe button on the observed render frame. Waiting for
    // a separate driver round trip previously advanced beyond the catch.
    await page.getByRole('button',{name:'人物 / 穿搭',exact:true}).evaluate((button,timing)=>new Promise((resolve,reject)=>{const started=performance.now();function tick(){if(performance.now()-started>15000){reject(Error('No active catch frame in15s'));return;}const p=window.__PRESENCE_DEBUG__.presence;if(p.dribbling&&(timing==='receive'?p.dribblePhase>.985:p.dribblePhase<.012)){button.click();resolve();}else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),timing);
    await wardrobe.waitFor();
    const phase=await page.evaluate(()=>window.__PRESENCE_DEBUG__.presence.dribblePhase);
    const surface=await readSurface(page),metrics=clearance(surface),active=hand<0?'L':'R';
    fs.writeFileSync(path.join(out,name+'-surface.json.gz'),gzipSync(JSON.stringify(surface),{level:1}));
    assert.equal(surface.localHead,personal,'Actual chosen profile head map');
    const marker=surface.palmMarkers[active];
    const contactPass=surface.handContact[active].nearest<=.01&&surface.handContact[active].minimumRadial>=-.01&&marker.publishedError<1e-5&&marker.nearestSkin<=.01;
    const armPass=Object.entries(metrics.limbs).filter(([k])=>k.startsWith(active)).every(([,v])=>v.minimumSignedMetres>=-.001&&v.minimumUnsignedMetres>=.003&&v.confirmedInterior===0);
    report.cases.push({name,personal,pack,timing,hand,phase,marker,localHead:surface.localHead,contact:surface.handContact[active],metrics,contactPass,armPass});
    await page.screenshot({path:path.join(out,name+'-front.png')});
    await wardrobe.getByRole('button',{name:'转向 ↷',exact:true}).click();await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name+'-quarter.png')});
    await wardrobe.getByRole('button',{name:'↶ 转向',exact:true}).click();
    await wardrobe.getByRole('button',{name:'应用并返回场景',exact:true}).click();
  }
  assert.equal(report.cases.length,single?1:12*profiles.length);assert.ok(report.cases.every(c=>c.timing==='receive'?c.phase>.98:c.phase<.015),'Actual observed catch phases');assert.ok(report.cases.every(c=>c.contactPass&&c.armPass),'Real hand contact and active arm 3mm clearance');assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);assert.deepEqual(hashes(),report.sourceHashes);
  report.captured=true;report.passed=true;await context.close();
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({captured:report.captured,cases:report.cases.map(r=>({name:r.name,phase:r.phase,contact:r.contact,contactPass:r.contactPass,armPass:r.armPass})),failure:report.failure}));}
