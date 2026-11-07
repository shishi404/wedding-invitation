import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code=await readFile('music.js','utf8');
function setup(config={studyMusic:'bg.ogg',recordPlaylist:['record.ogg']}){
  const log=[];
  const element=id=>({listeners:{},paused:true,ended:false,error:null,readyState:4,currentTime:27,textContent:'',src:'',attrs:{},classList:{values:new Set(),toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);}},
    addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(k,v){this.attrs[k]=v;},
    pause(){this.paused=true;this.listeners.pause?.();},
    load(){this.ended=false;this.error=null;},
    play(){this.paused=false;this.ended=false;log.push([id,this.src]);this.listeners.play?.();this.listeners.playing?.();return Promise.resolve();},
  });
  const els=Object.fromEntries(['study','music-toggle','music-toggle-label','music-record-icon','background-music','record-music','music-status','musicbox-music'].map(id=>[id,element(id)]));
  const window={invitationData:config,dispatchEvent(){},addEventListener(){}};
  vm.runInNewContext(code,{window,document:{querySelector:s=>els[s.slice(1)],addEventListener(){}},Event:class{}});
  const box=els['musicbox-music'],bg=els['background-music'];
  const end=()=>{box.ended=true;box.paused=true;return box.listeners.ended();};
  return {els,box,bg,api:window.InvitationAudio,end,log};
}
{
  const {api,bg,box,end,log,els}=setup();await api.startBackground();await api.windMusicBox();
  assert.ok(bg.paused);assert.match(box.src,/winding/);assert.equal(box.loop,false);
  assert.equal(els['music-toggle-label'].textContent,'恢复音乐');assert.equal(els['music-toggle'].attrs['aria-pressed'],'false');assert.equal(api.recordPlaying,false);assert.ok(!els['music-record-icon'].classList.values.has('is-playing'));
  await end();assert.match(box.src,/musicbox-nop/);assert.ok(bg.paused);assert.equal(box.paused,false);
  await end();assert.equal(bg.paused,false);assert.equal(bg.currentTime,27);
  assert.deepEqual(log.map(x=>x[0]),['background-music','musicbox-music','musicbox-music','background-music']);
}
{
  const {api,bg,end}=setup();await api.windMusicBox();await end();await end();assert.ok(bg.paused,'Initially muted background must stay muted');
}
{
  const {api,bg,box,end,els}=setup();await api.startBackground();await api.windMusicBox();await end();await els['music-toggle'].listeners.click();assert.ok(box.paused);assert.equal(bg.paused,false);assert.equal(bg.currentTime,27);assert.equal(els['music-toggle-label'].textContent,'暂停音乐');await end();assert.equal(bg.paused,false);
}
{
  const {api,bg,box,end}=setup();await api.windMusicBox();await api.toggleRecord();assert.equal(bg.paused,false);assert.ok(box.paused);await api.toggleRecord();await end();assert.ok(bg.paused,'Muting after manual restoration must remain muted');
}
{
  const {api,bg,box,end}=setup();await api.startBackground();await api.windMusicBox();await end();await api.windMusicBox();assert.match(box.src,/winding/);assert.ok(bg.paused);await end();await end();assert.equal(bg.paused,false);
}
{
  const {api,bg,box,end}=setup();await api.startBackground();
  let reject;box.play=()=>new Promise((_,no)=>{reject=no;});const old=api.windMusicBox();
  box.play=()=>Promise.resolve();await api.windMusicBox();reject(Error('AbortError'));assert.equal(await old,false);assert.ok(bg.paused);
  await end();await end();assert.equal(bg.paused,false);
}
{
  const {api,bg,box,els}=setup();await api.startBackground();box.play=()=>Promise.reject(Error('No audio'));
  assert.equal(await api.windMusicBox(),false);assert.equal(bg.paused,false);assert.match(els['music-status'].textContent,/八音盒/);
}
{
  const {api,bg,box,end}=setup();await api.startBackground();await api.windMusicBox();box.play=()=>Promise.reject(Error('No song'));await end();assert.equal(bg.paused,false);
}
{
  const {api,bg,box,end}=setup();await api.startBackground();await api.windMusicBox();api.leaveStudy();await end();assert.ok(bg.paused&&box.paused);
}
{
  const {api,bg,box}=setup();await api.startBackground();let resolve;box.play=()=>new Promise(yes=>{resolve=()=>{box.paused=false;yes();};});
  const pending=api.windMusicBox();api.leaveStudy();resolve();assert.equal(await pending,false);assert.ok(bg.paused&&box.paused);
}
{
  const {api,bg,box,end}=setup();await api.startBackground();await api.windMusicBox();await api.nextRecord();assert.equal(bg.paused,false);assert.ok(box.paused);await end();assert.equal(bg.paused,false);assert.equal(bg.src,'record.ogg');
}
{
  const dataWindow={};vm.runInNewContext(await readFile('data.js','utf8'),{window:dataWindow});
  const config=dataWindow.invitationData,expected=['assets/study-clair-de-lune.ogg','assets/record-a-familiar-room.ogg','assets/record-burning-memory.ogg','assets/record-world-on-fire.ogg'];
  assert.deepEqual(Array.from(config.recordPlaylist),expected);
  const {api,bg}=setup(config);assert.equal(bg.loop,false);await api.startBackground();assert.equal(bg.src,expected[0]);
  for(let i=1;i<=expected.length*2;i++){bg.ended=true;bg.paused=true;await bg.listeners.ended();assert.equal(bg.src,expected[i%expected.length]);assert.equal(bg.paused,false);}
  await api.previousRecord();assert.equal(bg.src,expected.at(-1));await api.nextRecord();assert.equal(bg.src,expected[0]);
}
{
  const {api,bg,box,els}=setup();await api.startBackground();await api.windMusicBox();
  box.currentTime=1.2;const restore=api.pauseForMedia();
  box.play=()=>Promise.reject(Object.assign(Error('Gesture required'),{name:'NotAllowedError'}));
  assert.equal(await restore(),false);assert.ok(box.paused&&bg.paused);assert.match(els['music-status'].textContent,/点击页面/);
  box.play=function(){this.paused=false;return Promise.resolve();};
  await api.resumeAfterGesture();assert.equal(box.paused,false);assert.equal(box.currentTime,1.2);
  box.pause();await api.resumeAfterGesture();assert.equal(box.paused,false,'Unexpected music-box pauses recover without resetting the source');
  await api.startBackground();await api.resumeAfterGesture();assert.equal(box.paused,true,'Cancelling the music box must clear automatic recovery');
}
console.log('Music box passed: winding/song, deliberate cancellation, media restore rejected by autoplay policy, recovery without restart, errors, no overlap and playlist wrapping.');
{
  const {api,bg,box,end,log}=setup({studyMusic:'bg.ogg',musicBoxSequence:'assets/audio-compat/musicbox-sequence.mp3',musicBoxWindingSeconds:2.9});
  await api.startBackground();await api.windMusicBox();
  assert.ok(bg.paused);assert.equal(box.src,'assets/audio-compat/musicbox-sequence.mp3');
  const plays=log.length;box.currentTime=3;box.listeners.timeupdate();assert.equal(box.volume,.55);
  assert.equal(log.length,plays,'The song phase requires no second play or source replacement');
  await end();assert.equal(bg.paused,false);
}
