import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {initialState,evaluateRoll,recordRoute,drawerRoute} from './study-rules.js';

for(const choice of ['strength','intelligence','will']){
  const s=initialState(choice);assert.equal(s.attributes[choice],60);
  assert.equal(Object.values(s.attributes).reduce((a,b)=>a+b),170);
  assert.equal(recordRoute(s),'unread');assert.equal(drawerRoute(s),'force');
  s.drawerAttempted=true;assert.equal(drawerRoute(s),'locked');
  s.key=true;assert.equal(drawerRoute(s),'key');s.drawerOpen=true;assert.equal(drawerRoute(s),'open');
  for(let value=1;value<=100;value++){
    const normal=evaluateRoll(value,s.attributes.intelligence);
    const extreme=evaluateRoll(value,s.attributes.strength,'extreme');
    assert.equal(normal.passed,value<=s.attributes.intelligence);
    assert.equal(extreme.passed,value<=Math.floor(s.attributes.strength/5));
    s.notebook=normal;assert.equal(recordRoute(s),normal.kind==='critical'?'clue':'force');
  }
  s.knife=true;assert.equal(recordRoute(s),'collected');
}
assert.equal(evaluateRoll(1,55).kind,'critical');assert.equal(evaluateRoll(100,55).kind,'fumble');
assert.equal(evaluateRoll(99,55).kind,'failure');assert.equal(evaluateRoll(96,45).kind,'fumble');
assert.equal(evaluateRoll(12,55,'extreme').passed,false);assert.equal(evaluateRoll(11,55,'extreme').passed,true);
const noKeepsake=initialState();
assert.equal(noKeepsake.choice,null);
assert.deepEqual(noKeepsake.attributes,{strength:55,intelligence:55,will:55});
assert.equal(recordRoute(noKeepsake),'unread');assert.equal(drawerRoute(noKeepsake),'force');

// Exercise actual audio controller using media doubles, including background-off,
// pause/resume position, user cancellation, natural ending, error and rapid stop.
function element(){const listeners={};return {listeners,paused:true,currentTime:9,volume:1,textContent:'',attrs:{},addEventListener(t,f){listeners[t]=f;},setAttribute(k,v){this.attrs[k]=v;},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};}
async function audioContext(){const els=Object.fromEntries(['music-toggle','background-music','record-music','music-status'].map(k=>[k,element()]));const w={invitationData:{music:'bg.wav',recordMusic:'record.wav'},dispatchEvent(){},addEventListener(){}};const context=vm.createContext({window:w,document:{querySelector:s=>els[s.slice(1)]},Event:class{}});vm.runInContext(await readFile('music.js','utf8'),context);return {els,api:w.InvitationAudio};}
{
  const {els,api}=await audioContext();await api.toggleRecord();assert.equal(els['background-music'].paused,true);assert.equal(api.recordPlaying,true);await api.toggleRecord();assert.equal(els['background-music'].paused,true);
  await els['music-toggle'].listeners.click();assert.equal(els['background-music'].paused,false);
  await api.toggleRecord();assert.equal(els['background-music'].paused,true);await api.toggleRecord();assert.equal(els['background-music'].paused,false);assert.equal(els['background-music'].currentTime,9);
  await api.toggleRecord();await els['music-toggle'].listeners.click();await api.toggleRecord();assert.equal(els['background-music'].paused,true);
  await els['music-toggle'].listeners.click();await api.toggleRecord();await els['record-music'].listeners.ended();assert.equal(els['background-music'].paused,false);
  els['record-music'].play=()=>Promise.reject(new Error('Missing track'));await api.toggleRecord();assert.equal(api.recordError,true);assert.equal(api.recordPlaying,false);assert.equal(els['background-music'].paused,false);
}
// In the study, background playback and the 3D turntable share one channel.
async function studyAudioContext(){
  const els=Object.fromEntries(['study','music-toggle','music-toggle-label','music-record-icon','background-music','record-music','music-status'].map(k=>[k,element()]));
  const events=[];
  for(const el of Object.values(els)){
    el.readyState=4;el.ended=false;el.error=null;
    el.classList={toggle(){}};
    el.play=function(){this.paused=false;this.listeners.play?.();this.listeners.playing?.();return Promise.resolve();};
    el.pause=function(){this.paused=true;this.listeners.pause?.();};
  }
  const w={invitationData:{studyMusic:'study.ogg',recordPlaylist:['record.wav']},dispatchEvent(){events.push(w.InvitationAudio?.recordPlaying);},addEventListener(){}};
  vm.runInNewContext(await readFile('music.js','utf8'),{window:w,document:{querySelector:s=>els[s.slice(1)]},Event:class{}});
  return {els,events,api:w.InvitationAudio};
}
{
  const {els,events,api}=await studyAudioContext(),bg=els['background-music'],button=els['music-toggle'];
  await api.startBackground();
  assert.equal(bg.src,'study.ogg');assert.equal(bg.paused,false);assert.equal(api.recordPlaying,true);
  assert.equal(els['record-music'].paused,true);assert.equal(els['music-toggle-label'].textContent,'暂停音乐');
  await button.listeners.click();assert.equal(bg.paused,true);assert.equal(api.recordPlaying,false);
  await button.listeners.click();assert.equal(bg.currentTime,9);assert.equal(api.recordPlaying,true);
  await api.toggleRecord();assert.equal(bg.paused,true);assert.equal(api.recordPlaying,false);
  await api.toggleRecord();assert.equal(bg.paused,false);assert.equal(button.attrs['aria-pressed'],'true');
  await api.nextRecord();assert.equal(bg.src,'record.wav');assert.equal(api.recordPlaying,true);
  await api.previousRecord();assert.equal(bg.src,'study.ogg');assert.equal(api.recordPlaying,true);
  bg.readyState=2;bg.listeners.waiting();assert.equal(api.recordPlaying,false);
  bg.readyState=4;bg.listeners.playing();assert.equal(api.recordPlaying,true);
  await api.breakRecord();assert.equal(bg.paused,true);assert.equal(api.recordPlaying,false);
  assert.equal(button.disabled,true);assert.equal(els['music-toggle-label'].textContent,'唱片已损坏');
  await button.listeners.click();await api.startBackground();await api.toggleRecord();await api.nextRecord();await api.previousRecord();
  assert.equal(bg.paused,true);assert.equal(api.recordPlaying,false);assert.equal(bg.src,'study.ogg');
  assert.ok(events.includes(true)&&events.includes(false));
}
{
  const {els,api}=await studyAudioContext(),bg=els['background-music'];
  bg.play=()=>Promise.reject(new Error('Autoplay denied'));
  await api.startBackground();assert.equal(api.recordPlaying,false);assert.equal(els['music-toggle'].attrs['aria-pressed'],'false');
  assert.equal(api.recordError,true);
}
{
  const {els,api}=await studyAudioContext(),bg=els['background-music'];
  let finish;
  bg.play=()=>new Promise(resolve=>{finish=()=>{bg.paused=false;bg.listeners.playing();resolve();};});
  const pending=api.startBackground();await api.breakRecord();finish();await pending;
  assert.equal(bg.paused,true);assert.equal(api.recordPlaying,false);assert.equal(els['music-toggle'].disabled,true);
}
console.log('Passed: 600 roll evaluations, optional keepsakes, notebook/drawer routes, legacy audio, shared study music, track controls, buffering, autoplay failure and permanent record damage.');
