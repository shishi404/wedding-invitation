import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';

// These are Chromium policy/event simulations, not claims of native iOS runs.
const profiles=[
  {name:'iPhone Safari',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',rejectFirstPlay:false},
  {name:'iPhone WeChat',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.60 NetType/WIFI Language/zh_CN',rejectFirstPlay:true},
];
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const report=[];
try{
  for(const profile of profiles){
    const page=await browser.newPage({userAgent:profile.ua,viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(({rejectFirstPlay})=>{
      window.handheldCalls=[];window.handheldLoads=[];window.handheldEvents=[];window.handheldGesture=false;window.handheldHidden=false;
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.handheldHidden});
      for(const type of ['click','touchend','keydown'])window.addEventListener(type,()=>{window.handheldGesture=true;setTimeout(()=>{window.handheldGesture=false;},0);},{capture:true});
      const nativePlay=HTMLMediaElement.prototype.play,nativeLoad=HTMLMediaElement.prototype.load;
      // iPhone volume can be hardware-controlled: the guard must still work
      // when script writes do nothing and volume always reads as 1.
      Object.defineProperty(HTMLMediaElement.prototype,'volume',{configurable:true,get:()=>1,set(){}});
      const canPlay=HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType=function(type){return type.includes('ogg')?'':canPlay.call(this,type);};
      window.forceHandheldAutoplay=()=>{
        const video=document.querySelector('#handheld-video');video.muted=false;video.volume=1;
        // Model a WebView starting playback internally, without an app play().
        nativePlay.call(video).catch(()=>{});
      };
      HTMLMediaElement.prototype.load=function(){
        if(this.id==='handheld-video'){
          window.handheldLoads.push({muted:this.muted,defaultMuted:this.defaultMuted,volume:this.volume,paused:this.paused,autoplay:this.autoplay});
          this.addEventListener('loadedmetadata',()=>{window.forceHandheldAutoplay();window.forcedPreloadAutoplay=true;},{once:true});
          for(const type of ['play','playing'])this.addEventListener(type,()=>window.handheldEvents.push({type,muted:this.muted,volume:this.volume,hidden:document.hidden,room:document.querySelector('#world').dataset.sceneLoaded,dialog:document.querySelector('#interaction-dialog').open}));
        }
        return nativeLoad.call(this);
      };
      let reject=rejectFirstPlay;
      HTMLMediaElement.prototype.play=function(){
        if(this.id==='handheld-video'){
          window.handheldCalls.push({muted:this.muted,volume:this.volume,gesture:window.handheldGesture,room:document.querySelector('#world').dataset.sceneLoaded,loading:!document.querySelector('#scene-loading').hidden});
          if(!window.handheldGesture||reject){reject=false;return Promise.reject(new DOMException('A direct playback gesture is required','NotAllowedError'));}
        }
        return nativePlay.call(this);
      };
    },profile);
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/assets/handheld-memory.mp4',async route=>{await gate;return route.continue();});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#start-exploration').click();
    await page.waitForFunction(()=>document.querySelector('#handheld-video')?.dataset.preloadState==='loading');
    await page.evaluate(()=>document.dispatchEvent(new Event('WeixinJSBridgeReady')));
    assert.equal(await page.locator('#scene-loading').isVisible(),true);
    assert.deepEqual(await page.evaluate(()=>window.handheldCalls),[]);
    release();
    await page.waitForFunction(()=>window.forcedPreloadAutoplay&&document.querySelector('#handheld-video').paused&&document.querySelector('#handheld-video').muted);
    await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
    assert.deepEqual(await page.evaluate(()=>window.handheldCalls),[],'The complete loading sequence must never call video.play()');
    assert.ok((await page.evaluate(()=>window.handheldLoads)).every(sample=>sample.paused&&sample.muted&&sample.defaultMuted&&!sample.autoplay));
    await page.evaluate(()=>document.dispatchEvent(new Event('WeixinJSBridgeReady')));
    await page.locator('[data-object="handheld"]').focus();await page.keyboard.press('Enter');
    await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();
    if(profile.rejectFirstPlay)await page.getByRole('button',{name:'点击播放视频',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#handheld-video').currentTime>.1&&!document.querySelector('#handheld-video').paused);
    await page.evaluate(()=>{window.handheldHidden=true;document.dispatchEvent(new Event('visibilitychange'));window.forceHandheldAutoplay();});
    await page.waitForFunction(()=>document.querySelector('#handheld-video').paused&&document.querySelector('#handheld-video').muted);
    await page.evaluate(()=>{window.handheldHidden=false;document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('WeixinJSBridgeReady'));});
    assert.ok(await page.locator('#handheld-video').evaluate(video=>video.paused&&video.muted));
    await page.getByRole('button',{name:'点击播放视频',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#handheld-video').paused);
    await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));document.dispatchEvent(new Event('WeixinJSBridgeReady'));});
    assert.ok(await page.locator('#handheld-video').evaluate(video=>video.paused&&video.muted));
    await page.getByRole('button',{name:'点击播放视频',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#handheld-video').paused);
    await page.getByRole('button',{name:'继续寻找新的线索',exact:true}).click();
    await page.evaluate(()=>{window.forceHandheldAutoplay();document.dispatchEvent(new Event('WeixinJSBridgeReady'));});
    await page.waitForFunction(()=>document.querySelector('#handheld-video').paused&&document.querySelector('#handheld-video').muted);
    const calls=await page.evaluate(()=>window.handheldCalls),events=await page.evaluate(()=>window.handheldEvents);
    assert.ok(calls.every(call=>call.gesture&&call.room==='true'&&!call.loading));
    assert.ok(events.filter(event=>event.room!=='true'||!event.dialog||event.hidden).every(event=>event.muted),'Unexpected native playback outside visible inspection must be silenced without relying on volume');
    assert.deepEqual(errors,[]);
    report.push({profile:profile.name,engine:'Chromium simulation',scriptedVolumeIgnored:true,loadingCallsPlay:false,preloadPausedAndMuted:true,unexpectedNativeAutoplaySilenced:true,bridgeCannotStartVideo:true,backgroundAndPageCacheResumeRequiresTap:true,playbackCalls:calls,events});
    await page.close();
  }
  await mkdir('output/handheld-ios-audit',{recursive:true});await writeFile('output/handheld-ios-audit/report.json',JSON.stringify(report,null,2));
  console.log('iPhone policy simulations passed for Safari/WeChat: full loading silence, forced native autoplay containment, bridge safety, inline gesture playback, background/BFCache recovery and silent close. Native iPhone verification remains required.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
