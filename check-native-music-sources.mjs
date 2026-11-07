import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code=await readFile('music.js','utf8'),log=[];
const element=id=>({id,src:'',paused:true,ended:false,error:null,readyState:4,currentTime:0,listeners:{},attrs:{},classList:{toggle(){}},
  addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attrs[name]=value;},
  pause(){this.paused=true;this.listeners.pause?.();},load(){this.currentTime=0;this.error=null;this.ended=false;},
  play(){
    log.push({id,src:this.src});
    if(this.src.startsWith('blob:'))return Promise.reject(Object.assign(Error('WebView refused the blob media source'),{name:'NotSupportedError'}));
    this.paused=false;this.listeners.playing?.();return Promise.resolve();
  },
});
const els=Object.fromEntries(['study','music-toggle','music-toggle-label','music-record-icon','background-music','record-music','musicbox-music','music-status'].map(id=>[id,element(id)]));
const window={invitationData:{studyMusic:'assets/study-clair-de-lune.ogg',recordPlaylist:['assets/study-clair-de-lune.ogg','assets/record-a-familiar-room.ogg'],musicBoxSequence:'assets/audio-compat/musicbox-sequence.mp3'},
  // Keep the downloaded byte cache present: music must deliberately avoid it.
  InvitationMediaSource:path=>'blob:preloaded#'+path.split('/').pop(),addEventListener(){},dispatchEvent(){}};
vm.runInNewContext(code,{window,setTimeout:(fn,ms)=>setTimeout(fn,ms===8000?100:ms),clearTimeout,Event:class{},document:{querySelector:selector=>els[selector.slice(1)],addEventListener(){}}});
const api=window.InvitationAudio,bg=els['background-music'];
await api.startBackground();assert.equal(bg.paused,false,'The first HTTP track plays');
await api.nextRecord();assert.equal(bg.paused,false,'Switching to the next track must not introduce a refused blob source');
assert.equal(bg.src,'assets/record-a-familiar-room.ogg');
await api.previousRecord();assert.equal(bg.paused,false);assert.equal(bg.src,'assets/study-clair-de-lune.ogg');
assert.equal(await api.windMusicBox(),true,'Winding and song must use the directly playable continuous file');
assert.equal(els['musicbox-music'].src,'assets/audio-compat/musicbox-sequence.mp3');
assert.ok(log.every(call=>!call.src.startsWith('blob:')));
await api.startInvitation();
const normalPlay=bg.play;
bg.play=function(){
  // Some WebViews deliver the old pause after play() has been requested, while
  // the replacement source is still loading and paused is still true.
  this.paused=true;
  queueMicrotask(()=>this.listeners.pause?.());
  return new Promise(resolve=>setTimeout(()=>{this.paused=false;this.listeners.playing?.();resolve();},5));
};
await api.nextRecord();assert.equal(bg.paused,false,'A queued pause from the previous source must not cancel the new track');
bg.play=normalPlay;
const box=els['musicbox-music'],normalBoxPlay=box.play;
box.play=()=>new Promise(()=>{});
assert.equal(await api.windMusicBox(),false,'A pending native play must time out instead of leaving the controls waiting forever');
assert.equal(box.paused,true);box.play=normalBoxPlay;
assert.equal(await api.windMusicBox(),true,'The user can retry after a pending play timeout');
console.log('Native music source regression passed: first track, next/previous and music-box sequence work when WebView rejects blob audio.');
