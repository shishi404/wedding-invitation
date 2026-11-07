import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';

const profiles=[
  {name:'Safari',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1'},
  {name:'WeChat',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.60 NetType/WIFI Language/zh_CN'},
];
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const report=[];
try{
  for(const profile of profiles){
    const page=await browser.newPage({userAgent:profile.ua,viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.musicGesture=false;window.nativeMusicCalls=[];
      for(const type of ['click','touchend','keydown'])window.addEventListener(type,()=>{window.musicGesture=true;setTimeout(()=>{window.musicGesture=false;},0);},{capture:true});
      const nativePlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){
        if(['background-music','musicbox-music'].includes(this.id)){
          window.nativeMusicCalls.push({id:this.id,url:this.src,gesture:window.musicGesture,muted:this.muted});
          if(this.src.startsWith('blob:'))return Promise.reject(new DOMException('This WebView refuses blob audio','NotSupportedError'));
          if(this.id==='musicbox-music'&&window.stallNextBox){window.stallNextBox=false;return new Promise(()=>{});}
        }
        return nativePlay.call(this);
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#start-exploration').click();
    await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
    await page.waitForFunction(()=>document.querySelector('#background-music').currentTime>.1&&!document.querySelector('#background-music').paused);
    assert.ok(await page.evaluate(()=>window.InvitationMediaSource('assets/record-a-familiar-room.ogg').startsWith('blob:')),'Keep the old cache available so this tests bypassing it, not a cache miss');
    const open=async art=>{await page.locator(`[data-object="${art}"]`).focus();await page.keyboard.press('Enter');await page.locator('#object-art .inspection-stage[data-model-state="ready"]').waitFor();};
    const track=title=>page.waitForFunction(title=>{const audio=document.querySelector('#background-music');return new URL(audio.currentSrc).pathname.endsWith(title+'.ogg')&&!audio.paused&&audio.currentTime>.1;},title);
    await open('record');
    for(const title of ['record-a-familiar-room','record-burning-memory','record-world-on-fire','study-clair-de-lune']){
      await page.getByRole('button',{name:'下一首音乐',exact:true}).click();await track(title);
    }
    await page.getByRole('button',{name:'上一首音乐',exact:true}).click();await track('record-world-on-fire');
    await page.getByRole('button',{name:'下一首音乐',exact:true}).click();await track('study-clair-de-lune');
    assert.ok(await page.locator('#interaction-actions button').evaluateAll(buttons=>buttons.every(button=>!button.disabled)));
    await page.getByRole('button',{name:'待会儿再来检查唱片机',exact:true}).click();await open('musicbox');
    if(profile.name==='WeChat'){
      await page.evaluate(()=>{window.stallNextBox=true;});await page.getByRole('button',{name:'转动发条',exact:true}).click();
      await page.getByText('声音暂时未能开始，请再点一次“转动发条”。',{exact:false}).waitFor({timeout:12000});
      assert.equal(await page.getByRole('button',{name:'转动发条',exact:true}).isEnabled(),true);
    }
    await page.getByRole('button',{name:'转动发条',exact:true}).click();
    await page.waitForFunction(()=>{const audio=document.querySelector('#musicbox-music');return !audio.paused&&audio.currentTime>.1&&audio.currentTime<2.9;});
    const boxSource=await page.locator('#musicbox-music').evaluate(audio=>audio.currentSrc);
    const recordAt=await page.locator('#background-music').evaluate(audio=>audio.currentTime);
    await page.waitForFunction(()=>{const audio=document.querySelector('#musicbox-music');return !audio.paused&&audio.currentTime>3.2;});
    assert.equal(await page.locator('#musicbox-music').evaluate(audio=>audio.currentSrc),boxSource,'Winding to song keeps one HTTP source');
    assert.equal(await page.locator('#background-music').evaluate(audio=>audio.paused),true);
    await page.getByRole('button',{name:'看上去请柬不在八音盒里',exact:true}).click();
    assert.equal(await page.locator('#musicbox-music').evaluate(audio=>audio.paused),false,'Closing the dialog preserves music-box playback');
    await page.locator('#musicbox-music').evaluate(audio=>{audio.currentTime=audio.duration-.2;});
    await page.waitForFunction(()=>!document.querySelector('#background-music').paused&&document.querySelector('#background-music').currentTime>.1);
    assert.ok(await page.locator('#background-music').evaluate((audio,at)=>audio.currentTime>=at&&audio.currentTime<at+3,recordAt),'Restore the paused record position');
    const calls=await page.evaluate(()=>window.nativeMusicCalls);
    assert.ok(calls.every(call=>/^https?:/.test(call.url)),'Native music must never receive blob media');
    assert.ok(calls.filter(call=>call.id==='musicbox-music').every(call=>call.gesture),'Start the music-box sequence in the winding click');
    assert.deepEqual(errors,[]);report.push({profile:profile.name,engine:'Chromium with iPhone UA and blob-refusal simulation',firstTrack:true,nextPreviousWrap:true,realTimeProgress:true,windingAndSong:true,recordPositionRestored:true,pendingPlaybackTimeout:profile.name==='WeChat',calls});
    await page.close();
  }
  await mkdir('output/ios-native-music',{recursive:true});await writeFile('output/ios-native-music/report.json',JSON.stringify(report,null,2));
  console.log('Native music iPhone simulations passed: blob audio refused, HTTP first/next/previous tracks advance, music-box winding/song advances, pending play is retryable and record resumes without restarting.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
