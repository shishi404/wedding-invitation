import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';

const cues=['ui-click','ui-record','windchime','dice','notebook-open','notebook-tear','notebook-pickup','handheld-pickup','box-pickup','sticky-note','wax','envelope-open','cup','check-success','check-failure','musicbox-place','unlock','photo','box-open','box-break','box-failure','key','necklace','record-break','record-search'];
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const base=`http://127.0.0.1:${server.address().port}/`,report=[];
async function instrument(page,{fallback=false}={}){
  await page.addInitScript(({fallback})=>{
    window.audioGesture=false;window.auditSounds=[];window.auditStarts=[];window.auditMedia=[];
    for(const type of ['click','touchend','keydown'])window.addEventListener(type,()=>{
      window.audioGesture=true;setTimeout(()=>{window.audioGesture=false;},0);
    },{capture:true});
    const unlocked=new WeakSet(),play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      const allowed=window.audioGesture||unlocked.has(this)||this.muted;
      window.auditMedia.push({id:this.id,gesture:window.audioGesture,allowed});
      if(!allowed)return Promise.reject(new DOMException('Unprimed native channel','NotAllowedError'));
      if(window.audioGesture)unlocked.add(this);
      return play.call(this);
    };
    const resume=AudioContext.prototype.resume;
    AudioContext.prototype.resume=function(){
      if(this.auditInterrupted){
        if(!window.audioGesture)return Promise.reject(new DOMException('Interrupted context requires gesture','NotAllowedError'));
        this.auditInterrupted=false;delete this.state;
      }
      return resume.call(this);
    };
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      if(this.context===window.auditContext)window.auditStarts.push({state:this.context.state,duration:this.buffer?.duration});
      return start.apply(this,args);
    };
    if(fallback){const canPlay=HTMLMediaElement.prototype.canPlayType;HTMLMediaElement.prototype.canPlayType=function(type){return type.includes('ogg')?'':canPlay.call(this,type);};}
    window.addEventListener('study-sound-started',event=>window.auditSounds.push(event.detail));
  },{fallback});
}
try{
  for(const fallback of [false,true]){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));await instrument(page,{fallback});
    await page.goto(base);await page.locator('#start-exploration').click();
    await page.waitForFunction(()=>document.querySelector('#world').dataset.sceneLoaded==='true',null,{timeout:120000});
    const tested=await page.evaluate(async cues=>{
      window.auditContext=window.InvitationStudySounds.unlock();
      const results=[];
      for(const name of cues)results.push({name,played:await window.InvitationStudySounds.play(name)});
      const random=Math.random;
      try{
        for(let index=0;index<12;index++){Math.random=()=>index/12;results.push({name:'bell-'+(index+1),played:await window.InvitationAudio.playBell()});}
        for(const value of [0,.99]){Math.random=()=>value;results.push({name:'dice-'+value,played:await window.InvitationAudio.playDice()});}
      }finally{Math.random=random;}
      results.push({name:'notebook-open-then-tear',played:await window.InvitationStudySounds.playSequence(['notebook-open','notebook-tear'])});
      return results;
    },cues);
    assert.ok(tested.every(result=>result.played),'Every decoded cue and delayed sequence must play');
    assert.ok((await page.evaluate(()=>window.auditStarts)).every(node=>node.state==='running'&&node.duration>0));
    assert.equal(await page.evaluate(()=>window.auditMedia.filter(call=>call.id==='dice-sound').length),0,'Dice must not create an unprimed native playback');
    await page.evaluate(async()=>{
      await window.auditContext.suspend();window.auditContext.auditInterrupted=true;
      Object.defineProperty(window.auditContext,'state',{configurable:true,get:()=> 'interrupted'});
    });
    const count=await page.evaluate(()=>window.auditSounds.length);
    assert.equal(await page.evaluate(()=>window.InvitationStudySounds.play('photo')),false);
    assert.equal(await page.evaluate(()=>window.auditSounds.length),count,'No false started notification while blocked');
    await page.evaluate(()=>{
      const button=document.createElement('button');button.id='audio-audit-resume';button.textContent='恢复音效测试';
      button.style.cssText='position:fixed;top:0;left:0;z-index:100000';
      button.onclick=()=>setTimeout(async()=>{window.delayedAudioResult=await window.InvitationStudySounds.play('unlock');},60);
      document.body.append(button);
      document.querySelector('#study-campfire').pause();
    });
    await page.locator('#audio-audit-resume').click();
    await page.waitForFunction(()=>window.delayedAudioResult===true&&!document.querySelector('#study-campfire').paused);
    assert.equal(await page.evaluate(()=>window.auditContext.state),'running');
    assert.deepEqual(errors,[]);
    report.push({format:fallback?'MP3 fallback':'Ogg',cues:tested,interruptedContextRecovered:true,blockedCueNotReplayed:true,campfireRecovered:true,nativeCalls:await page.evaluate(()=>window.auditMedia)});
    await page.close();
  }
  // Open directly from the welcome screen: the child has no room-loading click
  // of its own, so its delayed envelope cue must share the parent's context.
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await instrument(page);
  await page.goto(base);await page.locator('.entry-invitation-button').click();
  await page.waitForFunction(()=>document.querySelector('#invitation-reader-frame')?.contentWindow?.InvitationStudySounds===window.InvitationStudySounds);
  await page.waitForFunction(()=>window.auditSounds.some(sound=>sound.name==='envelope-open'),null,{timeout:60000});
  assert.deepEqual(errors,[]);report.push({mobileReaderSharesUnlockedContext:true,delayedEnvelopeCuePlayed:true});
  await page.close();
  const direct=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await instrument(direct);
  await direct.addInitScript(()=>{
    // DevTools evaluation can itself set Chromium's sticky user-activation flag.
    // Model physical input using trusted DOM events instead.
    window.auditHadGesture=false;
    for(const type of ['click','touchend','keydown'])window.addEventListener(type,event=>{if(event.isTrusted)window.auditHadGesture=true;},{capture:true});
    const NativeAudioContext=window.AudioContext,resume=NativeAudioContext.prototype.resume;
    window.AudioContext=class extends NativeAudioContext{
      constructor(...args){
        super(...args);
        if(!window.auditHadGesture){
          this.suspend();this.auditInitiallyLocked=true;
          Object.defineProperty(this,'state',{configurable:true,get:()=> 'suspended'});
        }
      }
      resume(){
        if(this.auditInitiallyLocked){
          if(!window.auditHadGesture)return Promise.reject(new DOMException('A first interaction is required','NotAllowedError'));
          this.auditInitiallyLocked=false;delete this.state;
        }
        return resume.call(this);
      }
    };
  });
  await direct.goto(base+'invitation.html');
  await direct.waitForFunction(()=>document.body.dataset.invitationPhase==='reading',null,{timeout:60000});
  assert.equal(await direct.evaluate(()=>window.auditSounds.some(sound=>sound.name==='envelope-open')),false,'Direct address entry cannot promise sound without any user gesture');
  await direct.locator('#music-toggle').click();
  await direct.waitForFunction(()=>window.InvitationStudySounds.unlock().state==='running');
  assert.equal(await direct.evaluate(()=>window.auditSounds.some(sound=>sound.name==='envelope-open')),false,'The first click unlocks future cues without replaying the old animation sound');
  report.push({directAddressWithoutGestureRequiresInteraction:true,firstClickUnlocksFutureCues:true});await direct.close();
  await mkdir('output/audio-playback-audit',{recursive:true});
  await writeFile('output/audio-playback-audit/report.json',JSON.stringify(report,null,2));
  console.log(`Audio interruption audit passed: ${cues.length} cues, all 12 bells, both dice, delayed sequence in Ogg/MP3, strict native gesture policy, interrupted-context/campfire recovery and mobile reader audio.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
