import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Box3,Ray,Triangle,Vector3} from 'three';
import {chromium} from 'playwright';

const base=process.env.PALACE_URL||'http://127.0.0.1:5194';
const out=path.resolve(process.env.PALACE_ARTIFACTS||'qa-artifacts/held-arm-20261025/native');
const sourceRoot=path.resolve(process.env.PALACE_SOURCE_ROOT||'.');
const single=process.env.PALACE_HELD_SINGLE||'';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
assert.equal(fs.existsSync(out),false,'Retain previous surface evidence');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('scripts/check-basketball-refinement.mjs','utf8');
const block=source.slice(source.indexOf('const sourceFiles='),source.indexOf('const sourceHashes='));
const files=[...new Set([...block.matchAll(/['"]((?:src|public)\/[^'"]+)['"]/g)].map(match=>match[1]))];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,file))).digest('hex')]));
const report={at:new Date().toISOString(),base,sourceHashes:hashes(),acceptanceEligible:!single,cases:[],errors:[],uploads:[],
  scope:'Native pack/hand/profile/quality controls and wardrobe preview only. Read-only posed mesh, bones and physical ball. All core upper-arm/forearm vertices are tested against actual skinned torso triangles; closest interior-face signed distances and independent bidirectional X/Z ray parity are checked; open triangle-edge distances are unsigned; shoulder and wrist joining regions are excluded by a fixed25-85percent limb interval. No pose, visibility, bone, camera or score injection.'};

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
    const torso=[],bones={},seen=new Set(),handContact={L:{samples:0,nearest:Infinity,minimumRadial:Infinity},R:{samples:0,nearest:Infinity,minimumRadial:Infinity}};let localHead=false;
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
        for(const side of ['L','R'])if(w[side+'_hand']>=.65){const radial=v.distanceTo(p.ball)-.12;const contact=handContact[side];contact.samples++;contact.nearest=Math.min(contact.nearest,Math.abs(radial));contact.minimumRadial=Math.min(contact.minimumRadial,radial);}
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
    return {arms,torso,bones,localHead,handContact,hand:p.hand,held:p.held,dribbling:p.dribbling,physical:debug.scene.getObjectByName('practice-ball').userData.basketballPhysics.mode,
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
  for(const quality of ['high','low'])for(const personal of [true,false])for(const pack of ['natural','protect'])for(const hand of [-1,1]){
    const name=[quality,personal?'photo':'base',pack,hand<0?'left':'right'].join('-');
    if(single&&single!==name)continue;
    await page.getByRole('button',{name:'画质设置',exact:true}).click();const settings=page.getByRole('dialog',{name:'Experience settings',exact:true});
    await settings.locator('#quality').selectOption(quality);await settings.getByRole('button',{name:'Close',exact:true}).click();await settings.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'人物 / 穿搭',exact:true}).click();
    await wardrobe.getByRole('button',{name:personal?'照片参考角色 · 仅本机':'基础角色',exact:true}).click();
    await wardrobe.locator('fieldset[data-package-category="hands"]').getByRole('button',{name:new RegExp(pack==='natural'?'自然双手':'护球收球')}).click();
    await wardrobe.locator('.court-hand-choice').getByRole('button',{name:hand<0?'左手':'右手',exact:true}).click();
    await wardrobe.getByRole('button',{name:'全身',exact:true}).click();await wardrobe.getByRole('button',{name:'应用并返回场景',exact:true}).click();await wardrobe.waitFor({state:'hidden'});
    await page.waitForFunction(hand=>{const p=window.__PRESENCE_DEBUG__.presence;return p.hand===hand&&p.held&&!p.dribbling&&p.holdBlend===1;},hand);await page.waitForTimeout(400);
    await page.getByRole('button',{name:'人物 / 穿搭',exact:true}).click();await page.waitForTimeout(200);
    const surface=await readSurface(page),metrics=clearance(surface);
    fs.writeFileSync(path.join(out,name+'-surface.json.gz'),gzipSync(JSON.stringify(surface),{level:1}));
    report.cases.push({name,quality,personal,pack,hand,bones:surface.bones,localHead:surface.localHead,buffer:surface.buffer,wrists:surface.wrists,handContact:surface.handContact,metrics});
    await page.screenshot({path:path.join(out,name+'-front.png')});
    await wardrobe.getByRole('button',{name:'脸部细节',exact:true}).click();await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'-shoulders.png')});
    await wardrobe.getByRole('button',{name:'转向 ↷',exact:true}).click();await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'-quarter.png')});
    await wardrobe.getByRole('button',{name:'↶ 转向',exact:true}).click();await wardrobe.getByRole('button',{name:'全身',exact:true}).click();
    assert.ok(surface.held&&!surface.dribbling&&surface.physical==='held');assert.equal(surface.localHead,personal);
    assert.ok(surface.wrists.every(error=>Number.isFinite(error)&&error<.035));
    for(const contact of Object.values(surface.handContact)){assert.ok(contact.samples>12);assert.ok(contact.nearest<=.01,'Actual hand surface remains within1cm of the real ball');assert.ok(contact.minimumRadial>=-.01,'Actual hand surface penetrates no deeper than1cm');}
    for(const side of ['L','R']){
      const sign=side==='L'?-1:1;assert.ok(sign*surface.bones[side+'_Forearm'][0]>=sign*surface.bones[side+'_UpperArm'][0]-.035,'Elbow remains outside its own chest edge');
    }
    for(const limb of Object.values(metrics.limbs)){assert.ok(limb.minimumSignedMetres>=-.001,'Interior-face surface clearance retains1mm numerical tolerance');assert.equal(limb.confirmedInterior,0,'Core limb samples stay outside torso in both horizontal ray directions');assert.ok(limb.minimumUnsignedMetres>=.003,'Real core limb and torso surfaces retain3mm clearance');}
    await wardrobe.getByRole('button',{name:'应用并返回场景',exact:true}).click();await wardrobe.waitFor({state:'hidden'});console.log(name+' passed '+JSON.stringify(surface.handContact));
  }
  assert.equal(report.cases.length,single?1:16);assert.deepEqual(report.errors,[]);assert.deepEqual(report.uploads,[]);assert.deepEqual(hashes(),report.sourceHashes);
  report.passed=true;await context.close();
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,failure:report.failure}));}
