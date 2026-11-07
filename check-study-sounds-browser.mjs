import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  await p.addInitScript(()=>{window.effectLog=[];window.addEventListener('study-sound-started',e=>window.effectLog.push({...e.detail,animation:document.querySelector('#object-art .inspection-stage')?.dataset.animationPhase,art:document.querySelector('#object-art')?.dataset.art}));});
  const wait=name=>p.waitForFunction(name=>window.effectLog.some(e=>e.name===name),name,{timeout:30000});
  const open=async object=>{await p.locator(`[data-object="${object}"]`).focus();await p.keyboard.press('Enter');};
  const roll=async(id,total)=>{await p.waitForFunction(()=>document.querySelector('#dice-frame').contentDocument?.querySelector('#dice-stage'));await p.locator('#check-roll').click();await p.frameLocator('#dice-frame').locator('body').evaluate((_,v)=>parent.postMessage({type:'dice-result',id:v.id,total:v.total},parent.location.origin),{id,total});};
  await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.locator('#start-exploration').click();await wait('campfire');
  await p.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
  assert.equal(await p.locator('#study-campfire').evaluate(a=>a.loop&&!a.paused),true);
  await p.locator('#music-toggle').click();assert.ok(await p.locator('#background-music').evaluate(a=>a.paused));assert.equal(await p.locator('#study-campfire').evaluate(a=>a.paused),false);await p.locator('#music-toggle').click();
  for(const [object,effect,close]of [['teacup','cup','继续寻找请柬的线索'],['musicbox','musicbox-place','看上去请柬不在八音盒里'],['photo','photo','看上去请柬不在照片里面'],['pendant','necklace','看上去请柬也不在这里'],['handheld','handheld-pickup','继续寻找新的线索'],['drawer','box-pickup','看起来我应该先找一把钥匙']]){
    await open(object);await wait(effect);await p.getByRole('button',{name:close,exact:true}).click();
  }
  await open('note');await wait('sticky-note');await p.locator('[data-keepsake="strength"]').click();await p.locator('#gain-continue').click();
  await open('notebook');await wait('notebook-pickup');await p.getByRole('button',{name:'快速翻阅，寻找线索',exact:true}).click();await roll(1,2);
  await wait('check-success');await wait('notebook-open');
  assert.equal(await p.evaluate(()=>window.effectLog.find(e=>e.name==='notebook-open').animation),'opening-notebook');
  await p.waitForFunction(()=>document.querySelector('#interaction-dialog').dataset.notebookPhase==='complete',null,{timeout:60000});
  await p.getByRole('button',{name:'继续寻找请柬的线索',exact:true}).click();await p.getByRole('button',{name:'查看旧钥匙',exact:true}).click();await wait('key');await p.getByRole('button',{name:'返回',exact:true}).click();
  await open('drawer');await p.getByRole('button',{name:'用钥匙打开',exact:true}).click();await wait('unlock');await wait('box-open');
  assert.equal(await p.evaluate(()=>window.effectLog.find(e=>e.name==='unlock').animation),'unlocking');assert.equal(await p.evaluate(()=>window.effectLog.find(e=>e.name==='box-open').animation),'opening');
  await p.getByRole('button',{name:'拿起信封',exact:true}).waitFor();await p.getByRole('button',{name:'返回',exact:true}).click();
  await open('record');await p.getByRole('button',{name:'敲敲打打寻找请柬线索',exact:true}).click();await roll(2,100);await wait('check-failure');await wait('record-break');
  assert.equal(await p.evaluate(()=>window.effectLog.find(e=>e.name==='record-break').art),'knife');assert.equal(await p.locator('#study-campfire').evaluate(a=>a.paused),false);
  await p.getByRole('button',{name:'返回',exact:true}).click();await open('drawer');await p.getByRole('button',{name:'拿起信封',exact:true}).click();
  await p.getByRole('button',{name:'触碰火漆',exact:true}).click();await roll(3,2);
  await p.getByRole('button',{name:'继续拆信',exact:true}).click();await p.getByRole('button',{name:'用拆信刀小心地拆开',exact:true}).click();await wait('wax');
  assert.equal(await p.evaluate(()=>window.effectLog.find(e=>e.name==='wax').art),'envelope');
  await wait('envelope-open');
  assert.equal(await p.evaluate(()=>window.effectLog.find(e=>e.name==='envelope-open').animation),'opening-envelope');
  await p.getByRole('button',{name:'阅读婚礼请柬',exact:true}).waitFor();
  for(const name of ['record-search','box-break','box-failure'])assert.equal(await p.evaluate(name=>window.InvitationStudySounds.play(name),name),true);
  await p.evaluate(()=>window.InvitationAudio.leaveStudy());assert.equal(await p.locator('#study-campfire').evaluate(a=>a.paused),true);
  assert.deepEqual(errors,[]);console.log('Actual audio passed: pickup and object cues, wax removal result, notebook/unlock/lid animation timing, record damage and independent campfire.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
