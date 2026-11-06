import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPreviewServer} from './preview.mjs';
import {assetCatalog} from './loft-asset-profile.js';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const base=`http://127.0.0.1:${server.address().port}/`,reports=[];await mkdir('output/static-room/qa',{recursive:true});
try{
 for(const [width,height]of [[390,844],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'}),p=await context.newPage(),errors=[],requests=[];let entered=false;
  const cdp=await context.newCDPSession(p),network=new Map();await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent',e=>network.set(e.requestId,{url:e.request.url,bytes:0,partial:0,entered}));
  cdp.on('Network.dataReceived',e=>{const r=network.get(e.requestId);if(r)r.partial+=e.encodedDataLength;});
  cdp.on('Network.loadingFinished',e=>{const r=network.get(e.requestId);if(r){r.bytes=e.encodedDataLength;r.finished=true;}});
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  // Audio, inspection models and video must all complete before room entry.
  let release;const gate=new Promise(r=>release=r);await p.route('**/assets/sfx/campfire.ogg',async r=>{await gate;await r.continue();});
  const blocked=assetCatalog(width<500?'mobile':'desktop').tableProps.find(a=>a.id==='coffee-cup').url;
  let releaseModel;const modelGate=new Promise(r=>releaseModel=r);await p.route('**/*coffee-cup*.glb*',async r=>{await modelGate;await r.continue();});
  let releaseVideo;const videoGate=new Promise(r=>releaseVideo=r);await p.route('**/assets/handheld-memory.mp4',async r=>{await videoGate;await r.continue();});
  await p.addInitScript(()=>{window.firstInspectionPaints=[];window.addEventListener('study-inspect',event=>requestAnimationFrame(()=>window.firstInspectionPaints.push({art:event.detail.art,state:event.detail.host.dataset.modelState})));});
  await p.goto(base);assert.equal(requests.some(u=>u.includes('/static-room/')),false);
  const start=Date.now();await p.locator('#start-exploration').click();
  await p.waitForFunction(()=>document.querySelector('#scene-loading-text').textContent==='正在准备音乐、音效、动画与骰子…',null,{timeout:90000});assert.equal(await p.locator('#scene-loading').isVisible(),true);assert.notEqual(await p.locator('#world').getAttribute('data-scene-loaded'),'true');
  assert.ok(requests.some(u=>u.includes('/static-room/room.webp')));assert.ok(requests.some(u=>u.includes('handheld-memory.mp4')));
  release();await p.waitForTimeout(500);assert.notEqual(await p.locator('#world').getAttribute('data-scene-loaded'),'true');
  releaseModel();await p.waitForTimeout(500);assert.notEqual(await p.locator('#world').getAttribute('data-scene-loaded'),'true');
  releaseVideo();await p.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:90000});entered=true;const firstSeconds=(Date.now()-start)/1000;
  const firstFiles=[...network.values()].filter(r=>!r.entered);const firstMB=firstFiles.reduce((n,r)=>n+(r.finished?r.bytes:r.partial),0)/1e6;
  for(const flag of ['staticRoomReady','windchimeReady','flameReady','roomAudioReady','inspectionReady'])assert.equal(await p.locator('#world').evaluate((e,f)=>e.dataset[f],flag),'true');
  assert.ok(requests.some(url=>url.includes('/assets/check-ornate-frame.svg')),'The first check background must load behind the startup overlay');
  assert.equal(await p.locator('#world').getAttribute('data-scene-mode'),'static-hybrid');assert.equal(await p.locator('.static-room-image:not(.static-room-surround)').first().evaluate(e=>e.naturalWidth),3200);
  await p.waitForRequest(r=>r.url().includes('coffee-cup'),{timeout:10000}).catch(()=>{assert.ok(requests.some(u=>u.includes('coffee-cup')));});
  assert.ok(requests.some(u=>u.includes('handheld-memory.mp4')),'Video is downloaded before entry');releaseModel();releaseVideo();
  await p.waitForFunction(()=>document.querySelector('#world').dataset.backgroundState==='complete',null,{timeout:180000});
  await p.screenshot({path:`output/static-room/qa/room-${width}.png`});
  assert.equal(await p.locator('#dice-frame').getAttribute('data-dice-state'),'ready');
  if(width<500){
   await p.mouse.move(width/2,height/2);await p.mouse.wheel(0,10000);await p.waitForTimeout(400);
   const bounds=await p.locator('.static-room-surround').boundingBox();assert.ok(bounds.y<=0&&bounds.y+bounds.height>=height,'Real ceiling and floor must cover the viewport at minimum zoom');
   const square=await p.locator('.static-room-stage').boundingBox();assert.ok(Math.abs(square.width-width)<1,'Keep approved horizontal minimum bounds');
   await p.screenshot({path:'output/static-room/qa/minimum-390.png'});await p.locator('#scene-reset').click();
  }
  const staticRequests=requests.filter(value=>new URL(value).pathname.includes('/assets/static-room/'));
  assert.ok(staticRequests.length>0);
  assert.ok(staticRequests.every(value=>new URL(value).searchParams.get('v')==='interaction-ready-20261107-4'),'Every baked room asset must carry the same release to bypass old browser caches');
  const before=requests.length;

  // Actual image-mask picking, with screen coordinates transformed with the picture.
  const note=await p.evaluate(async()=>{const m=await fetch('./assets/static-room/picking-v2.json').then(r=>r.json());const [u,v]=m.probes.find(p=>p.id==='single-sticky-note').point;const r=document.querySelector('.static-room-stage').getBoundingClientRect();return {x:r.left+u*r.width,y:r.top+v*r.height};});
  assert.ok(note.x>0&&note.x<width&&note.y>0&&note.y<height,JSON.stringify(note));await p.mouse.click(note.x,note.y);await p.locator('#choose-dialog').waitFor({state:'visible'});await p.locator('#note-inspection[data-model-state="ready"]').waitFor({timeout:60000});
  await p.locator('[data-keepsake="strength"]').click();await p.locator('#gain-continue').click();assert.equal(await p.locator('img[src^="blob:"]').count()>0,true);
  for(const art of ['teacup','windchime','handheld','drawer','notebook','record','photo']){
   await p.locator(`[data-object="${art}"]`).focus();await p.keyboard.press('Enter');await p.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor({timeout:60000});
   if(art==='teacup')await p.screenshot({path:`output/static-room/qa/cup-${width}.png`});
   await p.evaluate(()=>{window.InvitationInspection.closeHandheld();document.querySelector('#interaction-dialog').close();});
  }
  assert.deepEqual(await p.evaluate(()=>window.firstInspectionPaints.filter(value=>value.state!=='ready')),[],'First painted inspection frames must already show their models');
  assert.equal(requests.slice(before).filter(u=>/\.(?:glb|ogg|wav)(?:\?|$)/.test(u)).length,0,'Preloaded interactions must reuse downloaded resources');
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('study-state',{detail:{choice:'intelligence',notebookOpen:true,notebookResult:'success',drawerOpen:true,envelope:true,drawerLockBroken:true}})));
  assert.deepEqual((await p.locator('[data-state-layer]:visible').evaluateAll(es=>es.map(e=>e.dataset.stateLayer))).sort(),['box-empty-broken','notebook-success']);
  await p.screenshot({path:`output/static-room/qa/state-${width}.png`});assert.equal(await p.locator('#world').getAttribute('data-box-state'),'empty');
  if(width<500){await p.setViewportSize({width:844,height:390});await p.screenshot({path:'output/static-room/qa/landscape.png'});await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.deepEqual(errors,[]);reports.push({width,height,firstSeconds,firstMB,backgroundRequests:requests.length,errors});console.log(JSON.stringify(reports.at(-1)));await context.close();
 }
 // Hold initialized dice separately from all media/models.
 const gated=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 let unlockDice;const diceGate=new Promise(r=>unlockDice=r);
 await gated.route('**/dice.js',async route=>{await diceGate;await route.continue();});
 await gated.goto(base);await gated.locator('#start-exploration').click();
 await gated.waitForFunction(()=>{const w=document.querySelector('#world');return w.dataset.startupTotal&&w.dataset.startupLoaded===w.dataset.startupTotal;},null,{timeout:120000});
 assert.notEqual(await gated.locator('#world').getAttribute('data-scene-loaded'),'true');
 assert.equal(await gated.locator('#scene-loading').isVisible(),true);unlockDice();
 await gated.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});await gated.close();
 const card=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 let unlockCard;const cardGate=new Promise(r=>unlockCard=r);
 await card.route('**/assets/check-ornate-frame.svg',async route=>{await cardGate;await route.continue();});
 await card.goto(base);await card.locator('#start-exploration').click();
 await card.waitForFunction(()=>{const w=document.querySelector('#world');return document.querySelector('#dice-frame').dataset.diceState==='ready'&&w.dataset.startupTotal&&w.dataset.startupLoaded===w.dataset.startupTotal;},null,{timeout:120000});
 assert.notEqual(await card.locator('#world').getAttribute('data-scene-loaded'),'true','A ready dice renderer must not bypass an unfinished check-card background');
 unlockCard();await card.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});await card.close();
 const retryPage=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});let fail=true;
 await retryPage.route('**/assets/windchime-12.ogg',route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
 await retryPage.goto(base);await retryPage.locator('#start-exploration').click();
 await retryPage.locator('#scene-retry').waitFor({state:'visible',timeout:120000});
 assert.equal(await retryPage.locator('#world').getAttribute('data-scene-loaded'),'error');
 assert.equal(await retryPage.locator('#scene-loading').isVisible(),true);fail=false;await retryPage.locator('#scene-retry').click();
 await retryPage.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});await retryPage.close();
 console.log('Dice/card readiness gates, first-painted model frames and missing interaction-audio retry passed.');
 await writeFile('output/static-room/qa/report.json',JSON.stringify(reports,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
