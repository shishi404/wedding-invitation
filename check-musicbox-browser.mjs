import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#start-exploration').click();
  await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
  await page.waitForFunction(()=>!document.querySelector('#background-music').paused);
  await page.evaluate(()=>{window.boxPlayback=[];const box=document.querySelector('#musicbox-music');box.addEventListener('playing',()=>window.boxPlayback.push(box.currentSrc));});
  await page.locator('[data-object="musicbox"]').focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'转动发条',exact:true}).click();
  await page.waitForFunction(()=>{const b=document.querySelector('#musicbox-music');return b.currentSrc.includes('musicbox-sequence.mp3')&&!b.paused&&b.currentTime<2.9;});
  assert.ok(await page.locator('#background-music').evaluate(a=>a.paused));
  const pausedAt=await page.locator('#background-music').evaluate(a=>a.currentTime);
  await page.waitForFunction(()=>{const b=document.querySelector('#musicbox-music');return b.currentSrc.includes('musicbox-sequence.mp3')&&!b.paused&&b.currentTime>3;},null,{timeout:30000});
  assert.ok(await page.locator('#background-music').evaluate(a=>a.paused));
  assert.equal(await page.locator('#music-toggle-label').textContent(),'恢复音乐');
  assert.equal(await page.evaluate(()=>window.InvitationAudio.recordPlaying),false);
  assert.equal(await page.locator('#music-record-icon').evaluate(e=>e.classList.contains('is-playing')),false);
  await page.getByRole('button',{name:'看上去请柬不在八音盒里',exact:true}).click();
  await page.waitForTimeout(350);assert.equal(await page.locator('#musicbox-music').evaluate(a=>a.paused),false);
  await page.locator('#music-toggle').click();
  await page.waitForFunction(()=>!document.querySelector('#background-music').paused);
  assert.ok(await page.locator('#musicbox-music').evaluate(a=>a.paused));
  assert.equal(await page.locator('#music-toggle-label').textContent(),'暂停音乐');
  const manuallyResumedAt=await page.locator('#background-music').evaluate(a=>a.currentTime);assert.ok(manuallyResumedAt>=pausedAt&&manuallyResumedAt<pausedAt+3);
  await page.locator('[data-object="musicbox"]').focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'转动发条',exact:true}).click();
  await page.waitForFunction(()=>{const b=document.querySelector('#musicbox-music');return b.currentSrc.includes('musicbox-sequence.mp3')&&!b.paused&&b.currentTime>3;},null,{timeout:30000});
  await page.getByRole('button',{name:'看上去请柬不在八音盒里',exact:true}).click();
  const sources=await page.evaluate(()=>window.boxPlayback);assert.ok(sources[0].endsWith('musicbox-sequence.mp3'));assert.ok(sources[1].endsWith('musicbox-sequence.mp3'));
  // Decode the complete continuous track duration for accelerated completion.
  // Decode its real duration, then accelerate this isolated QA playback to end.
  const duration=await page.evaluate(async()=>{const ctx=new AudioContext();try{return (await ctx.decodeAudioData(await (await fetch(document.querySelector('#musicbox-music').currentSrc)).arrayBuffer())).duration;}finally{await ctx.close();}});
  assert.ok(Number.isFinite(duration)&&duration>0);
  await page.locator('#musicbox-music').evaluate(a=>{a.playbackRate=16;});
  await page.waitForFunction(()=>!document.querySelector('#background-music').paused,null,{timeout:Math.ceil(duration/16*1000)+15000});
  const resumedAt=await page.locator('#background-music').evaluate(a=>a.currentTime);assert.ok(resumedAt>=manuallyResumedAt&&resumedAt<manuallyResumedAt+3);
  const playlist=['study-clair-de-lune.ogg','record-a-familiar-room.ogg','record-burning-memory.ogg','record-world-on-fire.ogg'];
  for(let i=1;i<=playlist.length;i++){
    await page.evaluate(()=>window.InvitationAudio.nextRecord());
    await page.waitForFunction(expected=>{const a=document.querySelector('#background-music');return a.currentSrc.endsWith(expected)&&!a.paused;},playlist[i%playlist.length]);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({continuousMusicboxSequence:true,musicSeconds:duration,continuesAfterClosing:true,resumeButtonStopsBox:true,recordStopsDuringBox:true,resumedWithoutRestart:true,fourActualTracksPlayableInOrder:true}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
