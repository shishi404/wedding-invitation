import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {LOFT_INTERACTIONS,TAKEN_MODELS,canUseLoftObject} from './study-loft-mapping.js';
import {assetCatalog} from './loft-asset-profile.js';

const html=await readFile('index.html','utf8'),game=await readFile('study.js','utf8');
const layout=JSON.parse(await readFile('assets/study-loft-layout.json','utf8'));
const ids=new Set(assetCatalog('mobile').tableProps.map(a=>a.id));
assert.equal(ids.size,10);
for(const [id,object] of Object.entries(LOFT_INTERACTIONS)){
  assert.ok(ids.has(id),`Missing model: ${id}`);
  assert.ok(layout.tableProps.items[id]?.visible,`Missing approved placement: ${id}`);
  assert.ok(html.includes(`data-object="${object}"`));
  assert.equal(canUseLoftObject(id,{choice:null}),true);
  for(const choice of Object.keys(TAKEN_MODELS))assert.equal(canUseLoftObject(id,{choice}),TAKEN_MODELS[choice]!==id);
}
assert.equal(LOFT_INTERACTIONS['painted-lacquer-jewelry-box'],'drawer');
assert.equal(canUseLoftObject('coffee-cup',{choice:'will'}),true);
assert.equal(canUseLoftObject(null,{choice:'will'}),false);
assert.ok(!html.includes('id="scene-plate"'));
assert.ok(!html.includes('data-outline='));
assert.ok(!game.includes('抽屉'));

// The accessible controls must track the same locks/removals as raycasting.
const listeners={},classes=new Set(),audio={recordPlaying:false};
const buttons=Object.values(LOFT_INTERACTIONS).map(object=>({dataset:{object}}));
vm.runInNewContext(await readFile('study-art.js','utf8'),{
  window:{addEventListener(type,callback){listeners[type]=callback;},InvitationAudio:audio},
  document:{querySelectorAll(){return buttons;},body:{classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}}},
});
listeners['study-state']({detail:{choice:null}});
assert.ok(buttons.every(b=>!b.disabled&&!b.hidden));
for(const [choice,id]of Object.entries(TAKEN_MODELS)){
  listeners['study-state']({detail:{choice}});
  assert.ok(buttons.every(b=>b.hidden===(b.dataset.object===LOFT_INTERACTIONS[id])));
  assert.ok(buttons.every(b=>b.disabled===b.hidden));
}
audio.recordPlaying=true;listeners['record-state']();assert.ok(classes.has('record-playing'));
audio.recordPlaying=false;listeners['record-state']();assert.ok(!classes.has('record-playing'));

// Run actual game handlers: exploring before reading the note never grants a keepsake.
function gameElement(tagName='div'){const element={
  tagName,children:[],listeners:{},attrs:{},
  open:false,hidden:false,inert:false,dataset:{},style:{},textContent:'',
  classList:{toggle(){},add(){},remove(){}},
  append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.textContent='';this.children=nodes;},
  setAttribute(name,value){this.attrs[name]=value;},hasAttribute(name){return this.getAttribute(name)!==null;},getAttribute(name){return this.attrs[name]??this[name]??null;},removeAttribute(name){delete this.attrs[name];},addEventListener(type,fn){this.listeners[type]=fn;},
  querySelectorAll(){return this.children.filter(child=>child.tagName==='button');},showModal(){this.open=true;},close(){this.open=false;},
  decode(){return Promise.resolve();},focus(){},
};
let text='';Object.defineProperty(element,'textContent',{get(){return text+this.children.map(child=>child.textContent||'').join('');},set(value){text=value;this.children=[];}});
Object.defineProperty(element,'childElementCount',{get(){return this.children.filter(child=>child.tagName).length;}});return element;}
const gameEls=new Map(),gameListeners={},gameEvents=[],effectLog=[];let starts=0,bellStarts=0;
const gameButtons=Object.values(LOFT_INTERACTIONS).map(object=>Object.assign(gameElement(),{dataset:{object}}));
const keepsakeButtons=Object.keys(TAKEN_MODELS).map(keepsake=>Object.assign(gameElement(),{dataset:{keepsake}}));
const getGameElement=selector=>{
  const button=gameButtons.find(b=>selector===`[data-object="${b.dataset.object}"]`);
  if(button)return button;
  if(!gameEls.has(selector))gameEls.set(selector,gameElement());
  return gameEls.get(selector);
};
const gameContext=vm.createContext({
  location:{protocol:'http:',origin:'http://study.test'},
  window:{addEventListener(type,fn){gameListeners[type]=fn;},removeEventListener(type){delete gameListeners[type];},dispatchEvent(event){gameEvents.push(event);gameListeners[event.type]?.(event);},InvitationAudio:{startBackground(){starts++;},playBell(){bellStarts++;}},InvitationStudySounds:{play(name){effectLog.push(name);},prepare(){return Promise.resolve(true);}}},
  document:{querySelector:getGameElement,querySelectorAll:s=>s==='[data-object]'?gameButtons:keepsakeButtons,createElement:gameElement,createTextNode:text=>({textContent:text})},
  Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},setTimeout,clearTimeout,
});
const rules=(await readFile('study-rules.js','utf8')).replace(/^export /gm,'');
vm.runInContext(rules+'\n'+game.replace(/^import[^\n]+\n/,''),gameContext);
getGameElement('#start-exploration').onclick();
assert.equal(starts,0,'Starting the loader must not start room music');assert.equal(getGameElement('#choose-dialog').open,false);
assert.ok(getGameElement('#dice-frame').srcdoc.startsWith('<!doctype html>'),'Embedded dice must start loading before the first check');
assert.equal(getGameElement('#dice-frame').dataset.diceState,'loading');
gameListeners.message({source:undefined,origin:'http://study.test',data:{type:'dice-ready'}});
assert.equal(getGameElement('#dice-frame').dataset.diceState,'ready');
for(const object of ['notebook','record','drawer','photo','musicbox','windchime','pendant','teacup','handheld']){
  gameButtons.find(b=>b.dataset.object===object).onclick();
  assert.equal(getGameElement('#interaction-dialog').open,true,`Cannot inspect ${object} without keepsake`);
  assert.equal(getGameElement('#choose-dialog').open,false);
  assert.equal(gameEvents.at(-1).type,'study-inspect');
  assert.equal(gameEvents.at(-1).detail.art,object);
  assert.ok(gameEvents.at(-1).detail.host);
  const expectedEffect={photo:'photo',musicbox:'musicbox-place',pendant:'necklace',teacup:'cup',handheld:'handheld-pickup',notebook:'notebook-pickup',drawer:'box-pickup'}[object];
  if(expectedEffect)assert.equal(effectLog.at(-1),expectedEffect);
  if(object==='windchime'){
    assert.equal(bellStarts,1);let shakes=0;gameContext.window.InvitationInspection={shakeWindchime(){shakes++;}};
    const actions=getGameElement('#interaction-actions').children;
    actions[0].onclick();actions[0].onclick();assert.equal(shakes,2);assert.equal(bellStarts,3);
    assert.equal(vm.runInContext('interactionBusy()',gameContext),false);
    actions[1].onclick();assert.equal(getGameElement('#interaction-dialog').open,false);
  }
  getGameElement('#interaction-dialog').close();
}
gameListeners['study-object']({detail:'photo'});assert.equal(getGameElement('#interaction-dialog').open,true);
getGameElement('#interaction-dialog').close();
assert.equal(vm.runInContext('state.choice',gameContext),null);
assert.equal(getGameElement('#inventory-count').textContent,'0');
gameButtons.find(b=>b.dataset.object==='note').onclick();assert.equal(getGameElement('#choose-dialog').open,true);
assert.equal(effectLog.at(-1),'sticky-note');
assert.equal(gameEvents.at(-1).detail.art,'note');assert.equal(gameEvents.at(-1).detail.host,getGameElement('#note-inspection'));
keepsakeButtons[0].onclick();assert.equal(vm.runInContext('state.choice',gameContext),'strength');
assert.equal(vm.runInContext('state.attributes.strength',gameContext),60);
assert.equal(getGameElement('#inventory-count').textContent,'1');
keepsakeButtons[1].onclick();assert.equal(vm.runInContext('state.choice',gameContext),'strength');

// Key consumption is immediate, opening is exclusive, and pickup is separate.
let finishNotebook,finishPickup;
gameContext.window.InvitationInspection={openNotebook(){return new Promise(resolve=>{finishNotebook=resolve;});},pickupKey(){return new Promise(resolve=>{finishPickup=resolve;});}};
vm.runInContext('gain.close()',gameContext);
const reveal=vm.runInContext("revealNotebookResult({kind:'success'},'找到了钥匙。')",gameContext);
assert.notEqual(effectLog.at(-1),'notebook-pickup','Result pages must not replay the notebook pickup cue');
assert.equal(vm.runInContext('state.key',gameContext),false);
assert.equal(vm.runInContext('notebookOpening',gameContext),true);
assert.equal(gameEvents.at(-1).detail.art,'notebook');
assert.ok(getGameElement('#interaction-actions').children.every(b=>b.disabled));
gameButtons.find(b=>b.dataset.object==='photo').onclick();assert.equal(vm.runInContext('currentObject',gameContext),'notebook');
finishNotebook(true);await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(vm.runInContext('state.key',gameContext),false);
assert.equal(getGameElement('#interaction-dialog').dataset.notebookPhase,'pickup');
finishPickup(true);await reveal;
assert.equal(vm.runInContext('state.key',gameContext),true);
assert.equal(vm.runInContext('notebookOpening',gameContext),false);
assert.equal(getGameElement('#interaction-dialog').dataset.notebookPhase,'complete');
assert.ok(getGameElement('#interaction-actions').children.every(b=>!b.disabled));
gameContext.window.InvitationInspection.openNotebook=async()=>false;
vm.runInContext('state.key=false',gameContext);
const originalError=console.error;console.error=()=>{};
try{await vm.runInContext("revealNotebookResult({kind:'fumble'},'钥匙掉了出来。')",gameContext);}finally{console.error=originalError;}
assert.equal(vm.runInContext('state.key',gameContext),false);
assert.equal(vm.runInContext('notebookOpening',gameContext),false);
assert.equal(getGameElement('#interaction-dialog').dataset.notebookPhase,'error');
assert.equal(vm.runInContext('notebookRewardPending.result.kind',gameContext),'fumble');
vm.runInContext('notebookRewardPending=null',gameContext);
for(const selector of ['#interaction-dialog','#choose-dialog','#gain-dialog','#check-dialog']){let prevented=false;getGameElement(selector).listeners.cancel({preventDefault(){prevented=true;}});assert.ok(prevented);}
let finishBox,openingCalls=0;
gameContext.window.InvitationInspection={openJewelryBox(){openingCalls++;return new Promise(resolve=>{finishBox=resolve;});}};
vm.runInContext("gain.close();state.key=true;refresh();drawer();",gameContext);
const keyOpening=vm.runInContext('useKeyOnBox()',gameContext);
assert.equal(openingCalls,1);assert.equal(vm.runInContext('state.key',gameContext),false);
assert.equal(vm.runInContext('boxOpening',gameContext),true);
assert.equal(vm.runInContext('state.drawerOpen||state.envelope',gameContext),false);
assert.ok(getGameElement('#interaction-actions').children.every(button=>button.disabled));
assert.equal(getGameElement('#interaction-dialog').attrs.closedby,'none');
let canceled=false;getGameElement('#interaction-dialog').listeners.cancel({preventDefault(){canceled=true;}});assert.equal(canceled,true);
gameButtons.find(button=>button.dataset.object==='photo').onclick();
assert.equal(vm.runInContext('currentObject',gameContext),'drawer');
await vm.runInContext('useKeyOnBox()',gameContext);assert.equal(openingCalls,1);
vm.runInContext('pickupEnvelope()',gameContext);assert.equal(vm.runInContext('state.envelope',gameContext),false);
finishBox(true);await keyOpening;
assert.equal(vm.runInContext('boxOpening',gameContext),false);
assert.equal(vm.runInContext('state.drawerOpen',gameContext),true);
assert.equal(vm.runInContext('state.key||state.envelope',gameContext),false);
assert.equal(getGameElement('#interaction-dialog').attrs.closedby,'none');
assert.ok(getGameElement('#interaction-actions').children.every(button=>!button.disabled));
vm.runInContext('interaction.close();drawer()',gameContext);
assert.equal(gameEvents.at(-1).detail.art,'drawer-open');
assert.ok(getGameElement('#interaction-actions').children.some(button=>button.textContent==='拿起信封'));
vm.runInContext('pickupEnvelope()',gameContext);
assert.equal(vm.runInContext('state.envelope',gameContext),true);
assert.equal(gameEvents.filter(event=>event.type==='study-state').at(-1).detail.envelope,true);
vm.runInContext('interaction.close();drawer()',gameContext);
assert.equal(gameEvents.at(-1).detail.art,'drawer-empty');
const rollback=vm.runInContext('state.drawerOpen=false;state.envelope=false;state.key=true;drawer();useKeyOnBox()',gameContext);
finishBox(false);await rollback;
assert.equal(vm.runInContext('state.key',gameContext),true);assert.equal(vm.runInContext('boxOpening',gameContext),false);

for(const kind of ['failure','fumble']){
  let finishShake;
  gameContext.window.InvitationInspection.shakeJewelryBox=()=>new Promise(resolve=>{finishShake=resolve;});
  vm.runInContext('state.drawerOpen=false;state.drawerLockBroken=false;state.drawerAttempted=false;',gameContext);
  const shaking=vm.runInContext(`resolveForceDrawer({kind:'${kind}',passed:false})`,gameContext);
  assert.equal(vm.runInContext('boxOpening',gameContext),true);
  assert.equal(vm.runInContext('state.drawerOpen||state.drawerLockBroken',gameContext),false);
  assert.ok(getGameElement('#interaction-actions').children.every(b=>b.disabled));
  finishShake(true);await shaking;
  assert.equal(vm.runInContext('boxOpening',gameContext),false);
  assert.equal(getGameElement('#interaction-dialog').dataset.forcePhase,'failed');
  assert.equal(effectLog.at(-1),'box-failure');
}
for(const kind of ['success','critical']){
  let finishForce;
  gameContext.window.InvitationInspection.openJewelryBox=options=>{assert.equal(options.withoutLock,true);return new Promise(resolve=>{finishForce=resolve;});};
  vm.runInContext('state.drawerOpen=false;state.drawerLockBroken=false;state.drawerAttempted=false;state.envelope=false;',gameContext);
  const forcing=vm.runInContext(`resolveForceDrawer({kind:'${kind}',passed:true})`,gameContext);
  assert.equal(vm.runInContext('state.drawerLockBroken',gameContext),true);
  assert.equal(vm.runInContext('state.drawerOpen',gameContext),false);
  assert.equal(vm.runInContext('boxOpening',gameContext),true);
  assert.ok(getGameElement('#interaction-actions').children.every(b=>b.disabled));
  vm.runInContext('pickupEnvelope()',gameContext);assert.equal(vm.runInContext('state.envelope',gameContext),false);
  finishForce(true);await forcing;
  assert.equal(vm.runInContext('state.drawerOpen&&state.drawerLockBroken',gameContext),true);
  assert.equal(vm.runInContext('boxOpening',gameContext),false);
  assert.equal(gameEvents.at(-1).detail.art,'drawer-open');
  assert.equal(effectLog.at(-1),'box-break');
}

for(const [value,effect]of [[1,'check-success'],[2,'check-success'],[99,'check-failure'],[100,'check-failure']]){
  vm.runInContext("activeCheck={started:true,result:null,attribute:'intelligence',difficulty:'normal'}",gameContext);
  vm.runInContext(`resolveRoll(${value})`,gameContext);assert.equal(effectLog.at(-1),effect);
  const count=effectLog.length;vm.runInContext(`resolveRoll(${value})`,gameContext);assert.equal(effectLog.length,count);
  vm.runInContext('clearTimeout(resultTimer);activeCheck=null;',gameContext);
}
gameContext.originalCheck=vm.runInContext('performCheck',gameContext);let broken=0;
gameContext.window.InvitationAudio.breakRecord=()=>{broken++;};
for(const kind of ['success','critical','failure','fumble']){
  gameContext.testRecordResult={kind};
  vm.runInContext('state.knife=false;state.recordBroken=false;performCheck=(...args)=>args[4](testRecordResult);forceRecord();',gameContext);
  assert.equal(effectLog.at(-1),kind==='fumble'?'record-break':'record-search');
}
assert.equal(broken,1);vm.runInContext('performCheck=originalCheck;',gameContext);
for(const [choice,art]of [['strength','musicbox'],['intelligence','windchime'],['will','pendant']]){
  vm.runInContext(`state.choice='${choice}';state.key=true;state.knife=true;state.envelope=true;refresh();`,gameContext);
  const images=getGameElement('#inventory').children.map(slot=>slot.children.find(child=>child.tagName==='img').src);
  assert.deepEqual(images,[art,'key','knife','envelope'].map(id=>`assets/item-thumbnails/${id}.webp`));
}
const rollMessages=[],diceWindow={postMessage(message){rollMessages.push(message);}};
getGameElement('#dice-frame').contentWindow=diceWindow;
vm.runInContext('activeCheck=null;diceReady=false;',gameContext);
gameListeners.message({source:diceWindow,origin:'http://study.test',data:{type:'dice-ready',rendererAvailable:true}});
assert.equal(rollMessages.length,0,'Preloading must not start a roll');
vm.runInContext('activeCheck={id:99,started:true,sent:false,result:null};diceReady=false;sendRoll();',gameContext);
assert.equal(rollMessages.length,0);
for(let i=0;i<2;i++)gameListeners.message({source:diceWindow,origin:'http://study.test',data:{type:'dice-ready',rendererAvailable:true}});
assert.equal(rollMessages.length,1,'A click while loading must be delivered once when ready');
assert.equal(rollMessages[0].id,99);assert.equal(getGameElement('#dice-frame').dataset.diceState,'ready');
getGameElement('#check-dialog').open=true;
vm.runInContext('activeCheck={result:{kind:"success"},onResult(){}};finishCheck();',gameContext);
assert.equal(getGameElement('#check-dialog').open,false);
assert.equal(rollMessages.at(-1).type,'study-reset','The completed check must reset dice in the background');
vm.runInContext('activeCheck=null;',gameContext);
gameContext.window.InvitationLocalPreviewRequired=true;
getGameElement('#entry-screen').hidden=false;getGameElement('#study').hidden=true;
getGameElement('#start-exploration').onclick();
assert.equal(starts,0,'Local-preview guidance must not start room music');assert.equal(getGameElement('#study').hidden,false);assert.equal(getGameElement('#hotspots').inert,true);
let envelopeAttempts=0,finishEnvelope;
gameContext.window.InvitationInspection={openEnvelope(){envelopeAttempts++;return new Promise(resolve=>{finishEnvelope=resolve;});}};
vm.runInContext('state.envelope=true;state.seal={kind:"success"};state.opened=false;state.knife=true;openEnvelope();unseal(true);unseal(true);',gameContext);
assert.equal(envelopeAttempts,1,'Repeated clicks must not start overlapping envelope animations');
assert.equal(vm.runInContext('state.opened',gameContext),false,'Do not reveal invitation before the animation finishes');
finishEnvelope(false);await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(getGameElement('#interaction-dialog').dataset.envelopePhase,'error');
assert.equal(vm.runInContext('state.opened',gameContext),false,'Animation failure must permit a retry');
vm.runInContext('unseal(true)',gameContext);finishEnvelope(true);await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(vm.runInContext('state.opened',gameContext),true);
assert.equal(getGameElement('#interaction-dialog').dataset.envelopePhase,'complete');
let readAttempts=0,finishReading;
gameContext.window.InvitationAudio.leaveStudy=()=>{};
gameContext.window.InvitationInspection.readInvitation=()=>{readAttempts++;return new Promise(resolve=>{finishReading=resolve;});};
vm.runInContext('readInvitation();readInvitation();',gameContext);
assert.equal(readAttempts,1,'Do not overlap letter unfolding transitions');
assert.equal(gameContext.location.href,undefined,'Do not navigate while the letter is unfolding');
finishReading(true);await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(gameContext.location.href,undefined,'Reading after completion stays in the room');
console.log('3D game integration passed: optional note, model inspection, exclusive box animation, immediate key consumption, delayed envelope pickup, reopening and failed-animation recovery.');

// Both endings summarize only extreme outcomes, counted once when a roll resolves.
for(const withKnife of [false,true]){
 vm.runInContext('rollCounts.critical=0;rollCounts.fumble=0;showOpenedEnvelope('+withKnife+');',gameContext);
 assert.ok(!/大成功|大失败/.test(getGameElement('#interaction-copy').textContent));
 vm.runInContext("activeCheck={started:true,attribute:'strength',difficulty:'normal'};resolveRoll(1);resolveRoll(1);clearTimeout(resultTimer);activeCheck={started:true,attribute:'will',difficulty:'normal'};resolveRoll(100);clearTimeout(resultTimer);showOpenedEnvelope("+withKnife+");",gameContext);
 assert.ok(getGameElement('#interaction-copy').textContent.includes('大成功x1大失败x1'));
 vm.runInContext('rollCounts.critical=0;showOpenedEnvelope('+withKnife+');',gameContext);
 assert.ok(!getGameElement('#interaction-copy').textContent.includes('大成功x'));
 assert.ok(getGameElement('#interaction-copy').textContent.includes('大失败x1'));
}
console.log('Both endings passed: zero counts omitted, critical/fumble rolls counted once.');
