import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{window.uiStarts=[];window.bellStarts=[];window.addEventListener('study-sound-started',event=>{if(event.detail.name==='windchime')window.bellStarts.push(event.detail.src);if(event.detail.name.startsWith('ui-'))window.uiStarts.push(event.detail.src);});document.addEventListener('playing',event=>{if(event.target.id==='ui-click-sound')window.uiStarts.push(event.target.currentSrc||event.target.src);if(event.target.id==='bell-sound')window.bellStarts.push(event.target.currentSrc||event.target.src);},true);});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#start-exploration').click();
 await page.waitForFunction(()=>window.uiStarts.some(src=>/ui-button-[12]\.ogg$/.test(src)));
 await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
 const openingCount=await page.evaluate(()=>window.uiStarts.length);
 await page.locator('[data-object="windchime"]').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(n=>window.uiStarts.length>n,openingCount);
 await page.waitForFunction(()=>window.bellStarts.length===1);
 assert.match(await page.evaluate(()=>window.bellStarts[0]),/windchime-\d\d\.ogg$/);
 await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();
 const before=await page.evaluate(()=>window.uiStarts.length);
 await page.getByRole('button',{name:'摇摇风铃',exact:true}).click();
 await page.waitForFunction(()=>window.bellStarts.length===2);
 await page.waitForFunction(()=>window.bellStarts.length===2);
 assert.equal(await page.evaluate(()=>window.uiStarts.length),before);
 assert.equal(await page.locator('#background-music').evaluate(a=>a.paused),false);
 const closingCount=await page.evaluate(()=>window.uiStarts.length);
 await page.getByRole('button',{name:'铃铛里面怎么看也塞不进请柬',exact:true}).click();
 await page.waitForFunction(n=>window.uiStarts.length>n,closingCount);
 const recordOpeningCount=await page.evaluate(()=>window.uiStarts.length);
 await page.locator('[data-object="record"]').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(n=>window.uiStarts.length>n,recordOpeningCount);
 await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();
 for(const pattern of [/^上一首音乐$/, /^将唱臂(抬起|放下)$/, /^下一首音乐$/]){
   const n=await page.evaluate(()=>window.uiStarts.length);
   await page.getByRole('button',{name:pattern}).click();
   await page.waitForFunction(n=>window.uiStarts.length>n,n);
   assert.ok((await page.evaluate(()=>window.uiStarts.at(-1))).endsWith('record-button.ogg'));
   await page.waitForFunction(()=>[...document.querySelectorAll('#interaction-actions button')].every(b=>!b.disabled));
 }
 assert.deepEqual(errors,[]);console.log('Actual browser audio passed: title click, wind-chime random effect without generic duplicate, and all three record controls.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
