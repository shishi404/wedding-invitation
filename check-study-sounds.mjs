import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const code=await readFile('study-sounds.js','utf8');
function setup({web=true,deferred=false}={}){
  const handlers={},documentHandlers={},notifications=[],media=[],nodes=[],requests=[],contexts=[];let random=0,release;
  class Context{
    constructor(){this.state='suspended';this.destination={};this.resumes=0;contexts.push(this);}
    resume(){this.resumes++;if(this.pending)return new Promise(()=>{});if(this.blocked)return Promise.reject(Object.assign(Error('Gesture required'),{name:'NotAllowedError'}));if(!this.remainInterrupted)this.state='running';return Promise.resolve();}
    decodeAudioData(bytes){return Promise.resolve(bytes);}
    createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
    createBufferSource(){const node={stopped:false,connect(){},disconnect(){},start(){nodes.push(this);},stop(){this.stopped=true;this.onended?.();}};return node;}
  }
  const window={addEventListener(type,fn){handlers[type]=fn;},dispatchEvent(e){notifications.push(e.detail);},...(web?{AudioContext:Context}:{})};
  const createElement=()=>{const a={src:'',paused:true,currentTime:0,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;this.listeners.pause?.();}};media.push(a);return a;};
  vm.runInNewContext(code,{window,setTimeout,clearTimeout,document:{createElement,body:{append(){}},addEventListener(type,fn){(documentHandlers[type]||=[]).push(fn);}},CustomEvent:class{constructor(type,options){this.detail=options.detail;}},Math:Object.assign(Object.create(Math),{random:()=>random}),fetch:async url=>{requests.push(url);if(deferred)await new Promise(resolve=>{release=resolve;});return {ok:true,arrayBuffer:async()=>({url})};}});
  return {api:window.InvitationStudySounds,handlers,documentHandlers,notifications,media,nodes,requests,contexts,setRandom:v=>random=v,release:()=>release()};
}
{
  const f=setup();await f.handlers['study-enter']();assert.equal(f.media.length,1);assert.equal(f.media[0].muted,true,'Entry primes the ambience silently');await f.handlers['study-room-enter']();assert.equal(f.media[0].muted,false);assert.equal(f.media[0].loop,true);assert.equal(f.media[0].paused,false);
  const expected={'notebook-open':'notebook-open','notebook-tear':'notebook-tear','notebook-pickup':'notebook-pickup','handheld-pickup':'handheld-pickup','box-pickup':'box-pickup','sticky-note':'sticky-note',wax:'wax',cup:'cup-clink','check-failure':'failure','musicbox-place':'musicbox-place',unlock:'unlock',photo:'photo','box-open':'box-open','box-break':'box-break','box-failure':'box-failure',key:'key',necklace:'necklace','record-break':'record-break','record-search':'record-search'};
  expected['envelope-open']='envelope-open';
  for(const [name,stem]of Object.entries(expected)){assert.equal(await f.api.play(name),true);assert.ok(f.nodes.at(-1).buffer.url.endsWith(`/${stem}.ogg`));}
  for(const random of [0,.5,.999]){f.setRandom(random);await f.api.play('check-success');assert.ok(f.nodes.at(-1).buffer.url.endsWith('/check-success.ogg'));}
  assert.equal(f.media[0].paused,false,'Other cues must not interrupt the campfire loop');
  const count=f.media.length;await f.handlers['study-room-enter']();assert.equal(f.media.length,count);
  const before=f.requests.length;await f.api.prepare('notebook-open');await f.api.play('notebook-open');assert.equal(f.requests.length,before,'Decoded effects must be reused');
  for(const random of [0,.5,.999]){f.setRandom(random);await f.api.play('windchime');assert.match(f.nodes.at(-1).buffer.url,/windchime-(01|07|12)\.ogg$/);}
  const previousBell=f.nodes.at(-1);await f.api.play('windchime');assert.equal(previousBell.stopped,true,'A fresh bell replaces only the previous bell');
  assert.equal(f.media[0].paused,false,'Bell playback must preserve ambience');
  f.api.stop();assert.ok(f.media.every(a=>a.paused));assert.ok(f.nodes.every(n=>n.stopped));
}
{
  const f=setup({deferred:true}),pending=f.api.play('cup');f.api.stop();f.release();assert.equal(await pending,false);assert.equal(f.nodes.length,0,'Leaving must cancel a pending decode');
}
{
  const f=setup();await f.api.prepareEffects();const before=f.requests.length;
  for(const name of ['cup','photo','sticky-note','notebook-open','unlock','box-open'])await f.api.play(name);
  await f.api.playUI();await f.api.playUI(true);
  assert.equal(f.requests.length,before,'Ready effects and UI clicks must play without network requests');
  assert.ok(f.nodes.at(-1).buffer.url.endsWith('/record-button.ogg'));
  await f.api.prepareEffects();assert.equal(f.requests.length,before,'Preparation must reuse decoded cues');
}
{
  const f=setup({web:false});await f.handlers['study-enter']();assert.equal(f.media[0].muted,true);await f.handlers['study-room-enter']();await f.api.play('cup');await f.api.play('photo');
  assert.equal(f.media.length,2,'Native fallback must reuse one object channel alongside ambience');assert.ok(f.media[1].src.endsWith('/photo.ogg'));
  f.handlers.pagehide();assert.ok(f.media.every(a=>a.paused));
}
// A follow-up cue must wait for actual playback completion, including on the
// native fallback. Replacing a channel or leaving must cancel the whole chain.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const web of [true,false]){
  const f=setup({web}),sequence=f.api.playSequence(['notebook-open','notebook-tear']);await tick();
  assert.deepEqual(f.notifications.map(e=>e.name),['notebook-open']);
  (web?f.nodes.at(-1):f.media.at(-1)).onended();await tick();
  assert.deepEqual(f.notifications.map(e=>e.name),['notebook-open','notebook-tear']);
  (web?f.nodes.at(-1):f.media.at(-1)).onended();assert.equal(await sequence,true);
  for(const cancel of ['replace','leave']){
    const pending=f.api.playSequence(['notebook-open','notebook-tear']);await tick();
    if(cancel==='replace')await f.api.play('unlock');else f.api.stop();
    assert.equal(await pending,false);await tick();
    assert.equal(f.notifications.filter(e=>e.name==='notebook-tear').length,1);
  }
}
{
  const f=setup();await f.api.prepareEffects();const ctx=f.contexts[0],before=f.nodes.length;
  ctx.state='interrupted';ctx.blocked=true;
  assert.equal(await f.api.play('unlock'),false,'A blocked interruption must not report an inaudible cue as started');
  assert.equal(f.nodes.length,before);
  ctx.blocked=false;
  for(const handler of f.documentHandlers.click)handler({type:'click'});
  assert.equal(ctx.state,'running','The next gesture resumes before delayed animation cues');
  assert.equal(f.nodes.length,before,'Recovery does not replay an old cue');
  assert.equal(await f.api.play('box-open'),true);
  ctx.state='interrupted';ctx.remainInterrupted=true;
  assert.equal(await f.api.play('wax'),false,'A resolved resume promise with no running context is still not playback');
  ctx.remainInterrupted=false;
  for(const handler of f.documentHandlers.keydown)handler({type:'keydown',key:'Enter'});
  assert.equal(ctx.state,'running');
  for(const random of [0,.999]){f.setRandom(random);assert.equal(await f.api.play('dice'),true);assert.match(f.nodes.at(-1).buffer.url,/dice[12]\.ogg$/);}
  ctx.state='interrupted';ctx.pending=true;
  assert.equal(await f.api.playSequence(['notebook-open','notebook-tear']),false,'A pending resume cannot freeze a sequential animation');
}
{
  const f=setup();await f.handlers['study-enter']();await f.handlers['study-room-enter']();
  const ambience=f.media[0];ambience.pause();
  for(const handler of f.documentHandlers.touchend)handler({type:'touchend'});
  await tick();assert.equal(ambience.paused,false,'A browser-paused campfire retries on the next gesture');
  f.api.stop();for(const handler of f.documentHandlers.click)handler({type:'click'});
  assert.equal(ambience.paused,true,'Leaving the room must suppress ambience recovery');
}
{
  const shared={play(){},unlock(){}};
  const window={parent:{InvitationStudySounds:shared},frameElement:{id:'invitation-reader-frame'}};
  vm.runInNewContext(code,{window});
  assert.equal(window.InvitationStudySounds,shared,'The reader shares the parent context instead of creating a locked iframe context');
}
console.log('Study effects passed: all mappings, both audio backends, sequences/cancellation, dice variants, interrupted-context recovery, blocked-resume detection, campfire recovery and shared reader context.');
