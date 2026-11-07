import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';
import {deliveryFiles} from './runtime-delivery.mjs';

const helper=await readFile('audio-compat.js','utf8');
for(const supported of [true,false]){
  const window={};
  vm.runInNewContext(helper,{window,document:{createElement:()=>({canPlayType:()=>supported?'probably':''})}});
  assert.equal(window.InvitationAudioSource('assets/windchime-01.ogg'),supported?'assets/windchime-01.ogg':'assets/audio-compat/windchime-01.mp3');
  for(const path of ['assets/example.wav','assets/audio-compat/windchime-01.mp3','https://example.com/music.ogg',undefined])assert.equal(window.InvitationAudioSource(path),path);
}
const files=await deliveryFiles();
for(const path of files)if(path.endsWith('.ogg'))assert.ok(files.has(path.replace(/^assets\//,'assets/audio-compat/').replace(/\.ogg$/,'.mp3')),'Fallback missing from release: '+path);

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const sample='assets/audio-compat/windchime-01.mp3';
const partial=await fetch(`http://127.0.0.1:${server.address().port}/${sample}`,{headers:{Range:'bytes=0-15'}});
assert.equal(partial.status,206);assert.equal(partial.headers.get('content-type'),'audio/mpeg');
assert.deepEqual(Buffer.from(await partial.arrayBuffer()),(await readFile(sample)).subarray(0,16));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[],oggRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*.ogg',route=>{oggRequests.push(route.request().url());return route.abort();});
  await page.addInitScript(()=>{
    const canPlay=HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType=function(type){return type.includes('ogg')?'':canPlay.call(this,type);};
    window.bellStarts=[];window.effectStarts=[];window.recordPlays=[];
    window.addEventListener('study-sound-started',event=>{window.effectStarts.push(event.detail);if(event.detail.name==='windchime')window.bellStarts.push(event.detail.src);});
    document.addEventListener('playing',event=>{if(event.target.id==='bell-sound')window.bellStarts.push(event.target.currentSrc);},true);
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(this.id==='background-music')window.recordPlays.push({src:this.src,gesture:navigator.userActivation.isActive});
      return play.call(this);
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#start-exploration').click();
  await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
  await page.waitForFunction(()=>!document.querySelector('#background-music').paused);
  const open=async art=>{await page.locator(`[data-object="${art}"]`).focus();await page.keyboard.press('Enter');await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();};
  await open('windchime');await page.waitForFunction(()=>window.bellStarts.length===1);
  await page.getByRole('button',{name:'摇摇风铃',exact:true}).click();
  await page.waitForFunction(()=>window.bellStarts.length===2);
  assert.ok((await page.evaluate(()=>window.bellStarts)).every(src=>/windchime-\d\d\.mp3$/.test(src)));
  await page.getByRole('button',{name:'铃铛里面怎么看也塞不进请柬',exact:true}).click();
  await open('record');
  for(const title of ['record-a-familiar-room','record-burning-memory','record-world-on-fire','study-clair-de-lune']){
    const before=await page.evaluate(()=>window.recordPlays.length);
    await page.getByRole('button',{name:'下一首音乐',exact:true}).click();
    await page.waitForFunction(title=>{const a=document.querySelector('#background-music');return a.src.endsWith(title+'.mp3')&&!a.paused&&a.readyState>=3;},title);
    const calls=await page.evaluate(n=>window.recordPlays.slice(n),before);
    assert.ok(calls.length&&calls[0].gesture,'Switch must call play synchronously in the click');
  }
  await page.getByRole('button',{name:'上一首音乐',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#background-music').src.endsWith('record-world-on-fire.mp3')&&!document.querySelector('#background-music').paused);
  assert.ok((await page.evaluate(()=>window.effectStarts)).some(effect=>effect.src.endsWith('record-button.mp3')));
  await page.getByRole('button',{name:'待会儿再来检查唱片机',exact:true}).click();
  await open('musicbox');
  await page.evaluate(()=>{
    window.boxPlays=0;const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(this.id==='musicbox-music'&&++window.boxPlays>1)return Promise.reject(new DOMException('No new gesture for a second source','NotAllowedError'));
      return play.call(this);
    };
  });
  await page.getByRole('button',{name:'转动发条',exact:true}).click();
  await page.waitForFunction(()=>{const a=document.querySelector('#musicbox-music');return a.currentTime>3.1&&!a.paused&&a.src.endsWith('musicbox-sequence.mp3');});
  assert.equal(await page.evaluate(()=>window.boxPlays),1,'Winding and song must play continuously from one click');
  assert.equal(await page.locator('#background-music').evaluate(a=>a.paused),true);
  await page.locator('#musicbox-music').evaluate(a=>{a.currentTime=a.duration-.15;});
  await page.waitForFunction(()=>!document.querySelector('#background-music').paused);
  assert.deepEqual(oggRequests,[],'An unsupported device must never download Ogg');
  assert.deepEqual(errors,[]);
  console.log('Audio compatibility passed: MP3 bell/effects/ambience, four-track next/previous, one-click continuous music-box winding/song, automatic music restore, audio byte ranges and release dependencies.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
