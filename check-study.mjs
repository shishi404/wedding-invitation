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
console.log('Passed: 600 roll evaluations, three starting choices, all notebook/drawer routes, and six music transitions.');
