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
  // A held first-frame sound must keep entry blocked; unrelated models/video must not.
  let release;const gate=new Promise(r=>release=r);await p.route('**/assets/sfx/campfire.ogg',async r=>{await gate;await r.continue();});
  const blocked=assetCatalog(width<500?'mobile':'desktop').tableProps.find(a=>a.id==='coffee-cup').url;
  let releaseModel;const modelGate=new Promise(r=>releaseModel=r);await p.route('**/*coffee-cup*.glb*',async r=>{await modelGate;await r.continue();});
  let releaseVideo;const videoGate=new Promise(r=>releaseVideo=r);await p.route('**/assets/handheld-memory.mp4',async r=>{await videoGate;await r.continue();});
  await p.goto(base);assert.equal(requests.some(u=>u.includes('/static-room/')),false);
  const start=Date.now();await p.locator('#start-exploration').click();
  await p.waitForFunction(()=>document.querySelector('#scene-loading-text').textContent==='正在准备音乐与篝火声…',null,{timeout:90000});assert.equal(await p.locator('#scene-loading').isVisible(),true);assert.notEqual(await p.locator('#world').getAttribute('data-scene-loaded'),'true');
  assert.ok(requests.some(u=>u.includes('/static-room/room.webp')));assert.ok(!requests.some(u=>u.includes('handheld-memory.mp4')));
  release();await p.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:90000});entered=true;const firstSeconds=(Date.now()-start)/1000;
  const firstFiles=[...network.values()].filter(r=>!r.entered);const firstMB=firstFiles.reduce((n,r)=>n+(r.finished?r.bytes:r.partial),0)/1e6;
  for(const flag of ['staticRoomReady','windchimeReady','flameReady','roomAudioReady'])assert.equal(await p.locator('#world').evaluate((e,f)=>e.dataset[f],flag),'true');
  assert.equal(await p.locator('#world').getAttribute('data-scene-mode'),'static-hybrid');assert.equal(await p.locator('.static-room-image').first().evaluate(e=>e.naturalWidth),3200);
  await p.waitForRequest(r=>r.url().includes('coffee-cup'),{timeout:10000}).catch(()=>{assert.ok(requests.some(u=>u.includes('coffee-cup')));});
  assert.ok(requests.some(u=>u.includes('handheld-memory.mp4')),'Video downloads automatically without blocking room entry');releaseModel();releaseVideo();
  await p.waitForFunction(()=>document.querySelector('#world').dataset.backgroundState==='complete',null,{timeout:180000});
  await p.screenshot({path:`output/static-room/qa/room-${width}.png`});
  // Actual image-mask picking, with screen coordinates transformed with the picture.
  const note=await p.evaluate(async()=>{const m=await fetch('./assets/static-room/manifest.json').then(r=>r.json());const img=new Image();img.src='./assets/static-room/hits.png';await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,id=m.hitIds.indexOf('single-sticky-note')+1;let x=0,y=0,n=0;for(let yy=0;yy<c.height;yy+=2)for(let xx=0;xx<c.width;xx+=2)if(pixels[(yy*c.width+xx)*4]===id){x+=xx;y+=yy;n++;}const r=document.querySelector('.static-room-stage').getBoundingClientRect();return {x:r.left+x/n/c.width*r.width,y:r.top+y/n/c.height*r.height};});
  assert.ok(note.x>0&&note.x<width&&note.y>0&&note.y<height,JSON.stringify(note));await p.mouse.click(note.x,note.y);await p.locator('#choose-dialog').waitFor({state:'visible'});await p.locator('#note-inspection[data-model-state="ready"]').waitFor({timeout:60000});
  await p.locator('[data-keepsake="strength"]').click();await p.locator('#gain-continue').click();assert.equal(await p.locator('img[src^="blob:"]').count()>0,true);
  for(const art of ['teacup','windchime','handheld','drawer','notebook','record','photo']){
   await p.locator(`[data-object="${art}"]`).focus();await p.keyboard.press('Enter');await p.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor({timeout:60000});
   if(art==='teacup')await p.screenshot({path:`output/static-room/qa/cup-${width}.png`});
   await p.evaluate(()=>{window.InvitationInspection.closeHandheld();document.querySelector('#interaction-dialog').close();});
  }
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('study-state',{detail:{choice:'intelligence',notebookOpen:true,notebookResult:'success',drawerOpen:true,envelope:true,drawerLockBroken:true}})));
  assert.deepEqual((await p.locator('[data-state-layer]:visible').evaluateAll(es=>es.map(e=>e.dataset.stateLayer))).sort(),['box-empty-broken','notebook-success']);
  await p.screenshot({path:`output/static-room/qa/state-${width}.png`});assert.equal(await p.locator('#world').getAttribute('data-box-state'),'empty');
  if(width<500){await p.setViewportSize({width:844,height:390});await p.screenshot({path:'output/static-room/qa/landscape.png'});await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.deepEqual(errors,[]);reports.push({width,height,firstSeconds,firstMB,backgroundRequests:requests.length,errors});console.log(JSON.stringify(reports.at(-1)));await context.close();
 }
 await writeFile('output/static-room/qa/report.json',JSON.stringify(reports,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
