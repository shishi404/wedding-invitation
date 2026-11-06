import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {STATIC_PICKING_COLORS,createPickingDecoder,pickStaticRoom,applyPickingPatches} from './static-room-picking.js';
import {LOFT_INTERACTIONS} from './study-loft-mapping.js';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const metadata=JSON.parse(await readFile('assets/static-room/picking-v2.json','utf8')),decode=createPickingDecoder(metadata.colors);
assert.deepEqual(new Set(metadata.colors.map(c=>c.id)),new Set(Object.keys(LOFT_INTERACTIONS)));
for(const {id,rgb}of STATIC_PICKING_COLORS)assert.equal(decode(Uint8Array.from([...rgb,255]),0),id);
// The old antialiased pendant ID (6 * 50% = 3) must never become a notebook ID.
assert.equal(pickStaticRoom({pixels:Uint8Array.from([3,0,0,255]),width:1,height:1,u:.5,v:.5,decode,radius:2}),null);
const base=await sharp(fileURLToPath(new URL(metadata.mask,new URL('./assets/static-room/picking-v2.json',import.meta.url)))).ensureAlpha().raw().toBuffer();
const pendantRegion=metadata.regions.find(r=>r.id==='little-prince-pendant'),pendantCenter=pendantRegion.points.reduce((s,p)=>[s[0]+p[0]/pendantRegion.points.length,s[1]+p[1]/pendantRegion.points.length],[0,0]);
assert.equal(pickStaticRoom({pixels:base,width:metadata.width,height:metadata.height,u:pendantCenter[0],v:pendantCenter[1],decode,regions:metadata.regions}),'little-prince-pendant');
assert.equal(pickStaticRoom({pixels:base,width:metadata.width,height:metadata.height,u:pendantCenter[0],v:pendantCenter[1],decode,regions:metadata.regions,canUse:id=>id!=='little-prince-pendant'}),null);
for(const probe of metadata.probes)assert.equal(pickStaticRoom({pixels:base,width:metadata.width,height:metadata.height,u:probe.point[0],v:probe.point[1],decode}),probe.id,JSON.stringify(probe));
assert.ok(metadata.probes.some(p=>p.regression),'The reported pendant edge must be reproduced by an independent geometry raycast');
const patches={};for(const [key,p]of Object.entries(metadata.patches)){patches[key]={...p,pixels:await sharp(fileURLToPath(new URL(p.url,new URL('./assets/static-room/picking-v2.json',import.meta.url)))).ensureAlpha().raw().toBuffer()};}
for(const [key,id]of [['without-musicbox','octagonal-music-box'],['without-pendant','little-prince-pendant'],['without-windchime','windchime']]){
 const image=applyPickingPatches(base,metadata.width,metadata.height,[patches[key]]),probe=metadata.probes.find(p=>p.id===id);
 assert.notEqual(pickStaticRoom({pixels:image,width:metadata.width,height:metadata.height,u:probe.point[0],v:probe.point[1],decode}),id,'Taken item must disappear from the click map');
}
for(const probe of metadata.stateProbes){
 const image=applyPickingPatches(base,metadata.width,metadata.height,[patches[probe.state.drawerOpen?'box-open':'notebook-open']]);
 assert.equal(pickStaticRoom({pixels:image,width:metadata.width,height:metadata.height,u:probe.point[0],v:probe.point[1],decode}),probe.id);
}
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const reports=[];await mkdir('output/static-room/picking-qa',{recursive:true});
try{for(const [width,height]of [[390,844],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 const tap=point=>width<500?page.touchscreen.tap(point.x,point.y):page.mouse.click(point.x,point.y);
 page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#start-exploration').click();await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
 await page.waitForFunction(()=>document.querySelector('#world').dataset.backgroundState==='complete',null,{timeout:180000});
 // Expose the whole artwork by the existing zoom gesture, then click actual scene positions.
 if(width<height){const rect=await page.locator('.static-room-stage').boundingBox();await page.mouse.move(width/2,height/2);await page.mouse.wheel(0,4000);await page.waitForTimeout(180);}
 const matches=[];
 for(const probe of [...metadata.probes,{id:'little-prince-pendant',point:pendantCenter}]){
  const point=await page.locator('.static-room-stage').evaluate((e,[u,v])=>{const r=e.getBoundingClientRect();return {x:r.left+u*r.width,y:r.top+v*r.height};},probe.point);
  assert.ok(point.x>=0&&point.x<width&&point.y>=0&&point.y<height,JSON.stringify(point));
  await tap(point);
  const art=LOFT_INTERACTIONS[probe.id];
  if(art==='note'){await page.locator('#choose-dialog').waitFor({state:'visible'});await page.evaluate(()=>document.querySelector('#choose-dialog').close());}
  else{await page.locator('#interaction-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#object-art').getAttribute('data-art'),art,JSON.stringify(probe));await page.evaluate(()=>{window.InvitationInspection.closeHandheld();document.querySelector('#interaction-dialog').close();});}
  matches.push({expected:art,regression:!!probe.regression});
 }
 for(const probe of metadata.stateProbes){
  await page.evaluate(state=>window.dispatchEvent(new CustomEvent('study-state',{detail:state})),probe.state);
  const point=await page.locator('.static-room-stage').evaluate((e,[u,v])=>{const r=e.getBoundingClientRect();return {x:r.left+u*r.width,y:r.top+v*r.height};},probe.point);
  await tap(point);await page.locator('#interaction-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#object-art').getAttribute('data-art'),LOFT_INTERACTIONS[probe.id]);await page.evaluate(()=>document.querySelector('#interaction-dialog').close());
 }
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('study-state',{detail:{}})));
 // Zoomed phone composition, horizontal pan, and a resize all use the same image coordinates.
 if(width<height){
  await page.locator('.static-room-stage').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowLeft');
  const probe=metadata.probes.find(p=>p.id==='little-prince-pendant');
  const point=await page.locator('.static-room-stage').evaluate((e,[u,v])=>{const r=e.getBoundingClientRect();return {x:r.left+u*r.width,y:r.top+v*r.height};},probe.point);
  await tap(point);await page.locator('#interaction-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#object-art').getAttribute('data-art'),'pendant');await page.evaluate(()=>document.querySelector('#interaction-dialog').close());
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneZoomEnabled==='false'&&Math.abs(document.querySelector('.static-room-stage').getBoundingClientRect().width-innerWidth)<1);
  const landscapePoint=await page.locator('.static-room-stage').evaluate((e,[u,v])=>{const r=e.getBoundingClientRect();return {x:r.left+u*r.width,y:r.top+v*r.height};},probe.point);
  await tap(landscapePoint);await page.locator('#interaction-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#object-art').getAttribute('data-art'),'pendant');await page.evaluate(()=>document.querySelector('#interaction-dialog').close());
 }
 await page.screenshot({path:`output/static-room/picking-qa/correct-${width}.png`});assert.deepEqual(errors,[]);reports.push({width,height,matches,errors});await context.close();
}
await writeFile('output/static-room/picking-qa/report.json',JSON.stringify(reports,null,2));console.log('Picking regression passed: independently raycast probes for all ten objects, reported pendant edge, removed items, phone zoom/pan and landscape resize.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
