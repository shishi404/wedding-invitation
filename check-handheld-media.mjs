import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';

// Model iOS returning no metadata at all before an explicit playback gesture.
class Video extends EventTarget{
  dataset={};style={};paused=true;readyState=0;plays=0;loads=0;currentTime=0;attributes=new Map();
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return name==='src'?this.src??null:this.attributes.get(name)??null;}
  load(){this.loads++;}
  pause(){this.paused=true;}
  play(){
    this.plays++;this.paused=false;
    this.readyState=1;this.videoWidth=660;this.videoHeight=494;this.duration=20;
    this.dispatchEvent(new Event('loadedmetadata'));
    this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));return Promise.resolve();
  }
}
let fetched=0,restored=0,failFetch=false;
const windowEvents=new EventTarget();windowEvents.InvitationAudio={pauseForMedia:()=>()=>restored++};
const source=(await readFile('study-handheld.js','utf8')).replace(/^import[^\n]*\n/,'').replace(/^export /gm,'');
const context=vm.createContext({Event,Promise,Blob,AbortSignal,setTimeout,clearTimeout,
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  fetch:async()=>{fetched++;return {ok:!failFetch,blob:async()=>new Blob(['video'])};},
  Image:class{naturalWidth=640;async decode(){}},
  document:{createElement:()=>new Video(),body:{append(){}}},
  window:windowEvents,
});
vm.runInContext(source,context);
const media=context.createHandheldMedia({requestRender(){}}),video=media.video;
let timeout;
try{
  await Promise.race([Promise.all([media.prepare(),media.prepare()]),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Preparation waited for iOS metadata')),1000);})]);
}finally{clearTimeout(timeout);}
assert.equal(video.readyState,0,'Preparation completes even when iOS emits no metadata');
assert.equal(video.loads,0,'Room loading must not initialize the video decoder');
assert.equal(video.getAttribute('src'),null,'The downloaded video stays detached until inspection');
assert.equal(video.plays,0,'Preloading must never call play');
assert.ok(video.paused&&video.muted&&video.defaultMuted);
assert.equal(fetched,1,'Concurrent preparation shares one download');
video.paused=false;video.dispatchEvent(new Event('playing'));
assert.ok(video.paused&&video.muted,'Unexpected playback before inspection is stopped silently');
const host={dataset:{}};media.begin(host);
assert.equal(video.plays,1);assert.equal(video.muted,false);assert.equal(video.paused,false);
assert.equal(host.dataset.videoState,'playing');
media.end();assert.ok(video.paused&&video.muted);assert.equal(restored,1);
video.paused=false;video.dispatchEvent(new Event('play'));
assert.ok(video.paused&&video.muted,'A late play event after closing cannot leak audio');
video.muted=false;video.dispatchEvent(new Event('volumechange'));
assert.ok(video.paused&&video.muted,'Inactive media cannot be unmuted');
await media.prepare();assert.equal(fetched,1);
media.begin(host);assert.equal(video.currentTime,0);assert.equal(video.muted,false);
windowEvents.dispatchEvent(new Event('study-room-failed'));assert.ok(video.paused&&video.muted);
media.begin(host);windowEvents.dispatchEvent(new Event('study-enter'));assert.ok(video.paused&&video.muted);
failFetch=true;const retryMedia=context.createHandheldMedia({requestRender(){}});
await assert.rejects(retryMedia.prepare(),/下载失败/);
assert.ok(retryMedia.video.paused&&retryMedia.video.muted);assert.equal(retryMedia.video.loads,0);
failFetch=false;await retryMedia.prepare();assert.equal(retryMedia.video.readyState,0);
assert.equal(retryMedia.video.getAttribute('src'),null);assert.equal(retryMedia.video.plays,0);

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let videoRequests=0;
  await page.route('**/assets/handheld-memory.mp4',route=>{
    if(++videoRequests===1)return route.fulfill({status:503,body:'Unavailable'});
    return route.continue();
  });
  await page.addInitScript(()=>{
    window.handheldPlayCalls=[];window.handheldLoadCalls=[];window.handheldInspectionClicked=false;
    const load=HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load=function(){
      if(this.id==='handheld-video'){
        window.handheldLoadCalls.push({beforeInspection:!window.handheldInspectionClicked});
        // Reproduce iPhone's no-metadata-before-interaction behavior.
        if(!window.handheldInspectionClicked)return;
      }
      return load.call(this);
    };
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(this.id==='handheld-video'){
        window.handheldPlayCalls.push({muted:this.muted,loading:!document.querySelector('#scene-loading').hidden});
        if(window.blockNextHandheldPlay){window.blockNextHandheldPlay=false;return Promise.reject(new DOMException('Gesture required','NotAllowedError'));}
      }
      return play.call(this);
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#start-exploration').click();
  await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#handheld-video').dataset.preloadState==='error');
  assert.ok(await page.locator('#handheld-video').evaluate(v=>v.paused&&v.muted&&!v.getAttribute('src')));
  assert.equal(await page.locator('#scene-retry').isVisible(),false,'Background video failure must not block the room');
  await page.evaluate(()=>window.InvitationInspection.prepareHandheld());
  assert.equal(videoRequests,2,'A failed video download can be retried without triggering playback');
  assert.deepEqual(await page.evaluate(()=>window.handheldPlayCalls),[],'Room loading never plays the 3DS video');
  assert.deepEqual(await page.evaluate(()=>window.handheldLoadCalls),[],'Neither initial boot nor room retry waits for decoder events');
  assert.ok(await page.locator('#handheld-video').evaluate(v=>v.paused&&v.muted&&v.defaultMuted&&!v.getAttribute('src')&&v.readyState===0&&v.dataset.preloadState==='ready'));
  await page.evaluate(()=>{window.handheldInspectionClicked=true;});
  await page.locator('[data-object="handheld"]').focus();await page.keyboard.press('Enter');
  await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('#handheld-video').currentTime>.1);
  assert.ok(await page.locator('#handheld-video').evaluate(v=>!v.paused&&!v.muted));
  assert.ok((await page.evaluate(()=>window.handheldPlayCalls)).every(call=>!call.loading));
  await page.locator('#interaction-dialog').getByRole('button',{name:'继续寻找新的线索',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#handheld-video').paused&&document.querySelector('#handheld-video').muted);
  await page.evaluate(()=>{window.blockNextHandheldPlay=true;});
  await page.locator('[data-object="handheld"]').focus();await page.keyboard.press('Enter');
  await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();
  await page.getByRole('button',{name:'点击播放视频',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#handheld-video').currentTime>.1&&!document.querySelector('#handheld-video').paused);
  await page.locator('#interaction-dialog').getByRole('button',{name:'继续寻找新的线索',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#handheld-video').paused&&document.querySelector('#handheld-video').muted);
  assert.deepEqual(errors,[]);
  assert.equal(videoRequests,2,'Inspection reuses the downloaded video');
  console.log('3DS video checks passed: detached automatic background download, non-blocking download failure/retry, no-metadata iOS simulation, user-triggered playback and silent close.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
