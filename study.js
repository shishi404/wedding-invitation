import {keepsakes,initialState,checkThreshold,evaluateRoll,recordRoute,drawerRoute} from './study-rules.js';

const $ = s => document.querySelector(s);
const interaction=$('#interaction-dialog'), choose=$('#choose-dialog'), checkDialog=$('#check-dialog');
const inventory=$('#inventory'), frame=$('#dice-frame');
const entry=$('#entry-screen'), gain=$('#gain-dialog');
const attributeNames={strength:'力量',intelligence:'智力',will:'意志'};
const letterOpenerDescription='是shishi最爱玩的游戏里面的道具，能很方便的把东西取下来';
let state=initialState(), currentObject=null, activeCheck=null, diceReady=false, diceTimer=null, resultTimer=null, sequence=0, opening=false,boxOpening=false;
let notebookOpening=false,notebookRewardPending=null;
let forcedBoxPending=null;
const rollCounts={critical:0,fumble:0};
let dicePreparation,diceAppearanceReady=false;
window.InvitationDice={prepare:()=>{
  if(diceReady&&diceAppearanceReady)return Promise.resolve();
  if(dicePreparation)return dicePreparation;
  if(!dicePreparation)dicePreparation=new Promise((resolve,reject)=>{
    const cleanup=()=>{checkDialog.removeAttribute('open');checkDialog.removeAttribute('data-preparing');};
    const done=()=>{clearTimeout(timeout);window.removeEventListener('study-dice-ready',done);prepareCheckAppearance().then(()=>{diceAppearanceReady=true;cleanup();resolve();},error=>{cleanup();dicePreparation=null;reject(error);});};
    const timeout=setTimeout(()=>{cleanup();window.removeEventListener('study-dice-ready',done);dicePreparation=null;frame.removeAttribute('srcdoc');reject(Error('骰子未能准备好，请重试。'));},60000);
    window.addEventListener('study-dice-ready',done);checkDialog.setAttribute('data-preparing','');checkDialog.setAttribute('open','');prepareDice();if(diceReady)done();
  });
  return dicePreparation;
}};
const interactionBusy=()=>opening||boxOpening||notebookOpening;
const outcomeNames={critical:'大成功',success:'成功',failure:'失败',fumble:'大失败'};
const announce=text=>{$('#game-status').textContent=text;};
const returnAction=()=>({label:'返回',run:()=>interaction.close(),secondary:true});
const continueSearchAction=()=>({label:'继续寻找请柬的线索',run:()=>interaction.close(),secondary:true});
const lookForKeyAction=()=>({label:'看起来我应该先找一把钥匙',clue:'一把钥匙',run:()=>interaction.close(),secondary:true});
const sceneEvent=()=>window.dispatchEvent(new CustomEvent('study-state',{detail:{choice:state.choice,noteRead:state.noteRead,drawerOpen:state.drawerOpen,drawerLockBroken:!!state.drawerLockBroken,key:state.key,knife:state.knife,envelope:state.envelope,notebookOpen:!!state.notebookOpen,notebookResult:state.notebook?.kind||null}}));
const thumbnailAssets={musicbox:'assets/item-thumbnails/musicbox.webp',pendant:'assets/item-thumbnails/pendant.webp',windchime:'assets/item-thumbnails/windchime.webp',envelope:'assets/item-thumbnails/envelope.webp',knife:'assets/item-thumbnails/knife.webp',key:'assets/item-thumbnails/key.webp'};
const keepsakeArt=()=>({strength:'musicbox',will:'pendant',intelligence:'windchime'})[state.choice]||'keepsake';
const canInspectDeskObject=name=>name!==keepsakeArt();
function setClueText(element,copy,clue){
  element.textContent=copy;
  const phrases=(Array.isArray(clue)?clue:[clue]).filter(Boolean),nodes=[];
  let cursor=0;
  while(cursor<copy.length){
    let start=-1,word='';
    for(const phrase of phrases){const at=copy.indexOf(phrase,cursor);if(at!==-1&&(start===-1||at<start||(at===start&&phrase.length>word.length))){start=at;word=phrase;}}
    if(start===-1)break;
    nodes.push(document.createTextNode(copy.slice(cursor,start)));
    const emphasis=document.createElement('strong');emphasis.className='clue-emphasis';emphasis.textContent=word;nodes.push(emphasis);cursor=start+word.length;
  }
  if(nodes.length){nodes.push(document.createTextNode(copy.slice(cursor)));element.replaceChildren(...nodes);}
}
function showObject(title,copy,art,actions) {
  const effect={teacup:'cup',musicbox:'musicbox-place',photo:'photo',key:'key',pendant:'necklace',handheld:'handheld-pickup'}[art];
  if(effect)window.InvitationStudySounds?.play(effect);
  $('#interaction-title').textContent=title;
  const keyClues={success:['钥匙','唱片机'],critical:['请柬','唱片机','拆信刀','钥匙'],fumble:['钥匙'],failure:['打开某个锁']};
  const clue=art==='knife'?'把东西取下来':art==='key'||art==='notebook'&&state.notebook?keyClues[state.notebook?.kind]:art==='drawer'?'一把钥匙':null;
  setClueText($('#interaction-copy'),copy,clue);
  const illustration=$('#object-art');illustration.className=`object-art ${art}`;illustration.dataset.art=art;illustration.replaceChildren();
  const stage=document.createElement('div');stage.className='inspection-stage';illustration.append(stage);
  setInteractionActions(actions);
  if(!interaction.open){interaction.showModal();interaction.scrollTop=0;}
  window.dispatchEvent(new CustomEvent('study-inspect',{detail:{art,host:stage,envelopeWithKnife:!!state.envelopeOpenedWithKnife}}));
}
function setInteractionActions(actions){
  $('#interaction-actions').replaceChildren(...actions.map(action=>{
    const b=document.createElement('button');b.type='button';setClueText(b,action.label,action.clue);if(action.secondary)b.className='secondary';if(action.musicControl)b.classList.add('record-music-control');if(action.clickSound)b.dataset.clickSound=action.clickSound;b.onclick=()=>{if(!interactionBusy())return action.run();};return b;
  }));
}
function items() {
  if(!state)return [];
  const list=state.choice?[{id:'keepsake',...keepsakes[state.choice]}]:[];
  if(state.key)list.push({id:'key',name:'旧钥匙',icon:'⚿',description:'从笔记书脊里找到的钥匙。齿口正好与首饰盒的锁孔吻合。'});
  if(state.knife)list.push({id:'knife',name:'拆信刀',icon:'⚔',description:letterOpenerDescription});
  if(state.envelope)list.push({id:'envelope',name:'火漆信封',icon:'✉',description:'一封封着旧印火漆的信，收件人正是你。'});
  return list;
}
function refresh() {
  const list=items();inventory.replaceChildren();
  for(let i=0;i<4;i++){
    const item=list[i],slot=document.createElement(item?'button':'span');slot.className=`inventory-slot${item?'':' empty'}`;
    const icon=document.createElement('span');icon.className='item-icon';icon.textContent=item?.icon||'·';
    const itemArt=item?.id==='keepsake'?keepsakeArt():item?.id;
    if(item&&thumbnailAssets[itemArt]){const image=document.createElement('img');image.src=thumbnailAssets[itemArt];image.alt='';image.className='inventory-photo';slot.append(image);}else slot.append(icon);
    if(item){slot.type='button';slot.setAttribute('aria-label',`查看${item.name}`);const label=document.createElement('small');label.textContent=item.name;slot.append(label);slot.onclick=()=>{if(interactionBusy())return;currentObject=item.id;if(item.id==='envelope')openEnvelope();else if(itemArt==='musicbox')musicbox();else if(itemArt==='windchime')windchime();else if(itemArt==='pendant')pendant();else showObject(item.name,item.description,itemArt,[returnAction()],'随身物品');};}
    else slot.setAttribute('aria-hidden','true');inventory.append(slot);
  }
  $('#inventory-count').textContent=String(list.length);
  if(state){
    for(const [id,done] of [['notebook',!!state.notebook],['record',state.knife],['drawer',state.drawerOpen]]){const b=$(`[data-object="${id}"]`);b.classList.toggle('done',done);}
    sceneEvent();
  }
}
function acquired(name){announce(`获得${name}，已放入物品栏。`);refresh();}
function musicbox(){
  currentObject='musicbox';
  const copy='这个八音盒是shishi送给之南的生日礼物，之南很喜欢。可以作为首饰盒，发条在里面，转一圈，会播放独特又好听的歌。';
  showObject('中古八音盒',copy,'musicbox',[{label:'转动发条',run:async()=>{
    const started=await window.InvitationAudio?.windMusicBox();
    if(interaction.open&&currentObject==='musicbox')$('#interaction-copy').textContent=copy+(started===false?'\n声音暂时未能开始，请再点一次“转动发条”。':'');
  }},{label:'看上去请柬不在八音盒里',run:()=>interaction.close(),secondary:true}]);
}
function pendant(){
  currentObject='pendant';
  showObject('小王子吊坠','shishi和之南刚认识时，夜市上，之南称赞了shishi戴着还可以，shishi花一百块买下来了。后来shishi发现淘宝只卖五十。','pendant',[{label:'看上去请柬也不在这里',run:()=>interaction.close(),secondary:true}]);
}
function windchime(){
  currentObject='windchime';
  window.InvitationAudio?.playBell();
  showObject('黄铜风铃','之南送给shishi的生日礼物，随风发出悦耳的铃声。但是深圳梅雨季，木制的底座总是长霉。','windchime',[{label:'摇摇风铃',clickSound:'bell',run:()=>{window.InvitationAudio?.playBell();window.InvitationInspection?.shakeWindchime();}},{label:'铃铛里面怎么看也塞不进请柬',run:()=>interaction.close(),secondary:true}]);
}
function note(){
  currentObject='note';
  state.noteRead=true;sceneEvent();
  window.InvitationStudySounds?.play('sticky-note');
  if(state.choice){showObject('留言便签',`“可以从桌子上挑选一件纪念品，寻找婚礼请柬时可能帮得上忙”\n你已经选好了${keepsakes[state.choice].name}。`,'note',[{label:'继续寻找请柬的线索',run:()=>interaction.close(),secondary:true}]);return;}
  choose.showModal();
  window.dispatchEvent(new CustomEvent('study-inspect',{detail:{art:'note',host:$('#note-inspection')}}));
}
function photo(){
  currentObject='photo';
  showObject('新郎新娘的合影','桌面上有一点灰尘，但相框却被擦得很干净，是shishi和之南的结婚纪念照。','photo',[{label:'看上去请柬不在照片里面',run:()=>interaction.close(),secondary:true}]);
}
function teacup(){
  currentObject='teacup';
  showObject('中古茶杯','之南最喜欢收集的中古茶杯之一','teacup',[continueSearchAction()]);
}
function handheld(){
  currentObject='handheld';
  let raised=false,changing=false;
  const actions=()=>[
    {label:raised?'放在桌上':'拿起仔细看',run:async()=>{
      if(changing)return;changing=true;
      try{
        raised=await window.InvitationInspection?.setHandheldRaised(!raised)||false;
        if(interaction.open&&currentObject==='handheld')setInteractionActions(actions());
      }finally{changing=false;}
    }},
    {label:'继续寻找新的线索',run:()=>{window.InvitationInspection?.closeHandheld();interaction.close();},secondary:true},
  ];
  showObject('白色3DS','一台放在桌上的白色游戏机。上屏正在播放一段回忆，下屏是属于他们的图案。','handheld',actions());
}
function notebook(){
  currentObject='notebook';
  window.InvitationStudySounds?.play('notebook-pickup');
  if(notebookRewardPending){revealNotebookResult(notebookRewardPending.result,notebookRewardPending.copy);return;}
  if(state.notebook){
    const summaries={
      success:'日记里反复出现“书脊”和“唱片机”。钥匙已经收好，唱片机里应该还有婚礼请柬相关线索。',
      failure:'希望大家能叮嘱shishi写日记。',
      critical:'两篇有折痕的日记记载得很清楚：请柬在首饰盒，钥匙夹在书脊，拆信刀在唱片机下的暗格。钥匙已经收好，快说谢谢shishi！',
      fumble:'找到了夹在书脊里的钥匙。但笔记的封面不小心被你拽掉了，希望shishi不介意。'
    };
    showObject('旧笔记',summaries[state.notebook.kind],'notebook',[continueSearchAction()]);return;
  }
  showObject('旧笔记','应该是之南叮嘱shishi每天要写的日记，记录了shishi的日常与心情，最近的日期是空的，没有继续写，真是三分钟热度哇。','notebook',[{label:'快速翻阅，寻找线索',run:()=>performCheck('intelligence','normal','智力检定','快速翻阅日记，寻找其中的线索。',result=>{
    const lines={critical:'你清楚的知道，按照shishi草履虫般的记忆力，重要的信息一定会单独记载，你果然在两篇有折痕的日记内找到了相关信息：“担心请柬弄丢，锁在首饰盒里，钥匙夹了书脊里”；“拆信刀放在唱片机底部的暗格里，找不到记得翻翻”。你轻而易举拿到了钥匙，该去唱片机里找拆信刀了，快说谢谢shishi！',success:'日记除了日常琐事，也会写一些辅助记忆的关键词，你注意到频繁出现，“书脊”，“唱片机”两个词。你果然在书脊中找到了钥匙，那么唱片机里肯定还有东西！',failure:'稀稀拉拉的日记，不是今天喝啤酒，就是明天打猎杀对决游戏，丁点有用的线索都没有。\n你没好气地把笔记丢回桌上，一把旧钥匙从松脱的书脊中滑了出来。看起来能打开某个锁。',fumble:'每一页都是琐碎的事项，甚至上班怎么摸鱼都写的一清二楚！越翻越烦躁，不小心将书的封面拽掉了，夹在书脊与书封之间的钥匙也掉出来了！希望shishi不会怪罪。'};
    revealNotebookResult(result,lines[result.kind]);
  })},{label:'待会儿再检查笔记',run:()=>interaction.close(),secondary:true}]);
}
async function revealNotebookResult(result,copy){
  if(interactionBusy())return;
  notebookOpening=true;notebookRewardPending={result,copy};state.notebook=result;currentObject='notebook';refresh();
  showObject(`智力检定 · ${outcomeNames[result.kind]}`,copy,'notebook',[{label:'正在翻开笔记…',run:()=>{}}]);
  interaction.setAttribute('aria-busy','true');interaction.dataset.notebookPhase='opening';
  $('#interaction-actions').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
    if(!await window.InvitationInspection?.openNotebook({result:result.kind}))throw Error('笔记动画未完成');
    state.notebookOpen=true;sceneEvent();
    interaction.dataset.notebookPhase='pickup';
    setInteractionActions([{label:'正在收起旧钥匙…',run:()=>{}}]);$('#interaction-actions').querySelectorAll('button').forEach(b=>b.disabled=true);
    const target=inventory.children[items().length];
    if(!await window.InvitationInspection.pickupKey(target))throw Error('钥匙拾取未完成');
    state.key=true;notebookRewardPending=null;acquired('旧钥匙');
    interaction.dataset.notebookPhase='complete';setInteractionActions([continueSearchAction()]);
  }catch(error){
    console.error('笔记揭晓失败',error);interaction.dataset.notebookPhase='error';
    announce('笔记动画暂时无法播放，请重试。');
    setInteractionActions([{label:'重新翻开笔记',run:()=>revealNotebookResult(result,copy)},returnAction()]);
  }finally{notebookOpening=false;interaction.removeAttribute('aria-busy');}
}
function record(){
  if(state.recordBroken){currentObject='record';showObject('黑胶唱片机','唱片机坏了。','record',[{label:'唱片机里没有更多的线索了，再去找找别的地方',run:()=>interaction.close(),secondary:true}]);return;}
  currentObject='record';const route=recordRoute(state);const playing=window.InvitationAudio?.recordPlaying;
  let copy='shishi一直很想买台唱片机但一直没买。上面有唱片，里面一定有什么东西！';const actions=[];
  if(route==='clue'){copy+='\n笔记记载唱片机底下有个暗格，你决定摸摸看。';actions.push({label:'打开暗格',run:()=>takeKnife('依照笔记中的方法，你轻松打开了暗格。')});}
  else if(route==='unread'||route==='force'){
    if(state.notebook?.kind==='success')copy+='\n笔记提示唱片机里一定有婚礼请柬相关线索。';
    actions.push({label:'敲敲打打寻找请柬线索',run:forceRecord});
  }
  else copy='shishi一直很想买台唱片机但一直没买，所以这是现实中不存在的黑胶唱片机，上面有唱片。唱片机的暗格已经空了。';
  const control=method=>async()=>{
    $('#interaction-actions').querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await window.InvitationAudio?.[method]?.();}
    finally{if(interaction.open&&currentObject==='record')record();}
  };
  actions.push({label:'上一首音乐',run:control('previousRecord'),secondary:true,musicControl:true},{label:playing?'将唱臂抬起':'将唱臂放下',run:control('toggleRecord'),secondary:true,musicControl:true},{label:'下一首音乐',run:control('nextRecord'),secondary:true,musicControl:true},{label:state.knife?'唱片机里没有更多的线索了，再去找找别的地方':'待会儿再来检查唱片机',run:()=>interaction.close(),secondary:true});
  if(window.InvitationAudio?.recordError)copy+='\n唱片暂时无法播放，请稍后再试。';
  showObject('黑胶唱片机',copy,'record',actions);
}
function takeKnife(prefix){state.knife=true;acquired('拆信刀');showObject('拆信刀',`${prefix}\n${letterOpenerDescription}`,'knife',[returnAction()],'获得物品 · 拆信刀');}
function forceRecord(){performCheck('strength','normal','力量检定','试着拆开唱片机底座的暗格。',result=>{
  if(result.kind==='fumble'){state.recordBroken=true;window.InvitationAudio?.breakRecord();}
  const lines={critical:'你将唱机抬起来，轻松看到了底部的小暗格。',success:'你的指尖在唱片机的底部摸到一条细缝，顺着缝，顺利的打开了隐藏的小暗格。',failure:'你什么都没摸到，但摇晃唱机时，听到里面有声音，循着声音，找到一个隐藏的小暗格。',fumble:'咔嚓！木片突然迸裂，唱针划过唱片，发出一声刺耳的短响。坏了坏了，这下好了。\n但好在暗格打开了。'};
  takeKnife(`${outcomeNames[result.kind]}。${lines[result.kind]}`);
  window.InvitationStudySounds?.play(result.kind==='fumble'?'record-break':'record-search');
});}
function drawer(){
  window.InvitationStudySounds?.play('box-pickup');
  if(forcedBoxPending){showForceSuccess(forcedBoxPending);return;}
  currentObject='drawer';const route=drawerRoute(state);
  if(route==='open'){
    if(!state.envelope){showBoxContents();return;}
    showObject('打开的首饰盒','；里面空无一物。','drawer-empty',[{label:'查看信封',run:openEnvelope},returnAction()]);return;
  }
  if(route==='locked'){showObject('上锁的首饰盒','锁得很紧，没办法轻易掀开。去找把钥匙吧。','drawer',[lookForKeyAction()]);return;}
  const actions=[];let copy='锁住的首饰盒，请柬一定是放在这儿，但是需要一把钥匙。';
  if(route==='key'){copy+='\n你找到的旧钥匙，形状恰好与锁孔吻合。';actions.push({label:'用钥匙打开',run:useKeyOnBox},returnAction());}
  else{
    actions.push({label:'我的超级智慧告诉我该使用超级力量打开盒子',run:forceDrawer},lookForKeyAction());
  }
  showObject('上锁的首饰盒',copy,'drawer',actions);
}
function forceDrawer(){
  if(state.drawerAttempted){showObject('上锁的首饰盒','锁得很紧，没办法轻易打开。去找把钥匙吧。','drawer',[lookForKeyAction()]);return;}
  performCheck('strength','extreme','力量检定 · 极难','握住盒盖边缘，尝试打开上锁的首饰盒。',resolveForceDrawer);
}
async function resolveForceDrawer(result){
  if(interactionBusy())return;
  state.drawerAttempted=true;currentObject='drawer';
  if(result.passed)await showForceSuccess(result);
  else await showForceFailure(result);
}
async function showForceSuccess(result){
  if(interactionBusy())return;
  boxOpening=true;forcedBoxPending=result;currentObject='drawer';state.drawerLockBroken=true;refresh();
  showObject(`力量极难检定 · ${outcomeNames[result.kind]}`,'我摧毁了旧铜锁。盒盖还合着，里面似乎藏着什么。','drawer',[{label:'正在打开首饰盒…',run:()=>{}}]);
  window.InvitationStudySounds?.play('box-break');
  interaction.setAttribute('aria-busy','true');interaction.dataset.forcePhase='opening';
  $('#interaction-actions').querySelectorAll('button').forEach(button=>button.disabled=true);
  try{
    if(!await window.InvitationInspection?.openJewelryBox({withoutLock:true}))throw Error('开盒动画未完成');
    state.drawerOpen=true;forcedBoxPending=null;refresh();interaction.dataset.forcePhase='opened';
    showBoxContents(result.kind==='critical'?'叽里咕噜说啥呢，你握住盒盖，刚一用力，旧铜锁便松脱了。盒盖顺势打开，轻得仿佛一直在等你。':'你深吸一口气，猛地拽掉了铜锁。');
  }catch(error){
    console.error('首饰盒开盖失败',error);interaction.dataset.forcePhase='error';
    setInteractionActions([{label:'重新打开首饰盒',run:()=>showForceSuccess(result)},returnAction()]);
  }finally{boxOpening=false;interaction.removeAttribute('aria-busy');}
}
async function showForceFailure(result){
  if(interactionBusy())return;
  boxOpening=true;currentObject='drawer';refresh();
  showObject(result.kind==='failure'?'力量检定·极难·失败':`力量极难检定 · ${outcomeNames[result.kind]}`,result.kind==='fumble'?'锁扣发出一声不祥的脆响，你赶紧松手，旧铜锁上留下了一道新的划痕。好了好了，这下坏啦。首饰盒纹丝不动，幸好锁孔还完好。\n锁得很紧，没有办法用蛮力打开。去找一把钥匙吧。':'你使了使劲，首饰盒却纹丝不动。锁的很紧，没有办法直接打开。\n\n你得赶紧找到婚礼请柬，桌子上某个地方肯定会有钥匙。','drawer',[lookForKeyAction()]);
  interaction.setAttribute('aria-busy','true');interaction.dataset.forcePhase='shaking';
  window.InvitationStudySounds?.play('box-failure');
  $('#interaction-actions').querySelectorAll('button').forEach(button=>button.disabled=true);
  try{
    if(!await window.InvitationInspection?.shakeJewelryBox())throw Error('锁抖动动画未完成');
    interaction.dataset.forcePhase='failed';
    $('#interaction-actions').querySelectorAll('button').forEach(button=>button.disabled=false);
  }catch(error){
    console.error('首饰盒锁抖动失败',error);interaction.dataset.forcePhase='error';
    setInteractionActions([{label:'重新查看锁扣晃动',run:()=>showForceFailure(result)},lookForKeyAction()]);
  }finally{boxOpening=false;interaction.removeAttribute('aria-busy');}
}
function showBoxContents(prefix){const copy='一封厚实的信封躺在首饰盒正中。 婚礼请柬一定在信封里面。';showObject('首饰盒里的信',prefix?`${prefix}\n${copy}`:copy,'drawer-open',[{label:'拿起信封',run:pickupEnvelope},returnAction()]);}
async function useKeyOnBox(){
  if(boxOpening||!state.key||state.drawerOpen)return;
  boxOpening=true;state.key=false;refresh();
  announce('旧钥匙已用于打开锁扣。正在打开首饰盒，请等待动画结束。');
  interaction.setAttribute('aria-busy','true');interaction.setAttribute('closedby','none');
  $('#interaction-actions').querySelectorAll('button').forEach(button=>button.disabled=true);
  let completed=false;
  try{
    if(!window.InvitationInspection)throw Error('模型检视尚未准备好');
    completed=await window.InvitationInspection.openJewelryBox();
    if(!completed)throw Error('开盒动画未完成');
    state.drawerOpen=true;
  }catch(error){
    console.error('首饰盒开锁失败',error);state.key=true;
    announce('开盒动画暂时无法播放，钥匙已放回物品栏，请重试。');
  }finally{
    boxOpening=false;interaction.removeAttribute('aria-busy');refresh();
    if(completed){announce('首饰盒已打开。可以继续旋转调查，或拿起盒中的信封。');showBoxContents();}else drawer();
  }
}
function pickupEnvelope(){
  if(boxOpening||!state.drawerOpen||state.envelope)return;
  state.envelope=true;acquired('火漆信封');openEnvelope();
}
function openEnvelope(){
  if(!state.envelope||boxOpening)return;
  currentObject='envelope';
  if(state.opened){showOpenedEnvelope(!!state.envelopeOpenedWithKnife);return;}
  if(!state.seal){showObject('奇怪火漆封缄的信','请柬一定在信封里，但是信上的火漆上有着一个奇怪的印记，你忍不住想触碰它','envelope',[{label:'触碰火漆',run:()=>performCheck('will','normal','意志检定','将指尖轻轻放在信封的火漆上。',result=>{
    state.seal=result;const lines={critical:'指尖刚碰到火漆，你就像忽然读懂了这封信里所有没说出口的话。\n从初次相识到决定相伴，shishi和之南把一路走来的心意，都认真收进了这份邀请里。你也会是他们这一天里，很想见到的人。',success:'指尖碰到火漆，凉意很快散去。你仿佛听见shishi和之南的笑声，心里也跟着轻快起来。\n这枚奇怪的印记，大概只是他们藏起来的一点小心思。信封里装着的，是一份认真准备的邀请。',failure:'你盯着印记看了半天，还是没看明白，脑海里却先浮现出婚礼上热闹的模样。\n你已经开始期待，和大家一起见证shishi与之南的婚礼。',fumble:'你刚碰到火漆，就满脑子都是婚宴上的好吃的，连那枚奇怪的印记都越看越像一块饼干。\n还没拆开请柬，你已经忍不住笑了。看来这场婚礼，你已经开始期待了。'};
    refresh();showObject(`意志检定 · ${outcomeNames[result.kind]}`,lines[result.kind],'envelope',[{label:'继续拆信',run:openEnvelope}]);
  })}]);return;}
  const actions=state.knife?[{label:'用拆信刀小心地拆开',run:()=>unseal(true)}]:[{label:'直接撕开信封',run:()=>unseal(false)},{label:'先找一件拆信工具',run:()=>interaction.close(),secondary:true}];
  showObject('信封里的答案',state.knife?'拆信刀应该可以小心的取下火漆了，划开封口。答案，近在眼前。':'封口粘得很牢。你可以直接撕开，肯定会损坏这个火漆，也许有更合适的工具。','envelope',actions);
}
function showOpenedEnvelope(withKnife){
  const story=withKnife?'划开封口，你看到了一张温暖的请柬。\n“关于往后的故事，我们想邀请你，一起见证。”':'你沿着封口撕开一道小口，看到了里面完好的请柬。\n“关于往后的故事，我们想邀请你，一起见证。”';
  showObject('原来，是一场喜事',story,'invitation',[{label:'阅读婚礼请柬',run:readInvitation}]);
  const summary=document.createElement('span');summary.className='ending-summary';
  const columns=document.createElement('span');columns.className='ending-columns';
  const makeLine=(text,className)=>{const line=document.createElement('span');line.className=className;line.textContent=text;return line;};
  if(withKnife){
    const ending=document.createElement('span');ending.className='ending-achievement';
    const title=document.createElement('strong');title.className='perfect-ending-title';title.textContent='完美结局';
    ending.append(title,makeLine('信用评级+1','ending-credit'));columns.append(ending);
  }
  if(rollCounts.critical||rollCounts.fumble){
    const rolls=document.createElement('span');rolls.className='ending-rolls';
    if(rollCounts.critical)rolls.append(makeLine(`大成功 x ${rollCounts.critical}`,'ending-roll critical'));
    if(rollCounts.fumble)rolls.append(makeLine(`大失败 x ${rollCounts.fumble}`,'ending-roll fumble'));
    columns.append(rolls);
  }
  const copy=$('#interaction-copy');copy.replaceChildren();
  if(columns.childElementCount){summary.append(makeLine('你达成了','ending-label'),columns);copy.append(summary);}
  if(withKnife)copy.append(makeLine('截图私发给新人可以获得神秘礼品！','ending-gift'));
  copy.append(makeLine(story,'ending-story'));
}
async function readInvitation(){
  if(interactionBusy())return;opening=true;interaction.setAttribute('aria-busy','true');
  $('#interaction-actions').querySelectorAll('button').forEach(button=>button.disabled=true);
  try{
    if(!await window.InvitationInspection?.readInvitation())throw Error('请柬展开动画未完成');
    announce('请柬已展开，可以上下滚动阅读。');
    setInteractionActions([{label:'阅读婚礼请柬',run:readInvitation}]);
  }catch(error){console.error('请柬展开失败',error);announce('信纸暂时无法展开，可以重试或在当前窗口直接阅读请柬。');setInteractionActions([{label:'重新展开信纸',run:readInvitation},{label:'直接阅读请柬',run:async()=>{try{await window.InvitationInspection?.showInvitation();}catch{announce('请柬图片暂时无法载入，请稍后重试。');}}}]);
  }finally{opening=false;interaction.removeAttribute('aria-busy');}
}
async function unseal(withKnife){
  if(opening||state.opened)return;opening=true;
  interaction.setAttribute('aria-busy','true');interaction.dataset.envelopePhase='opening';
  $('#interaction-actions').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
    if(!await window.InvitationInspection?.openEnvelope({withKnife}))throw Error('信封打开动画未完成');
    state.opened=true;state.envelopeOpenedWithKnife=withKnife;
    interaction.dataset.envelopePhase='complete';showOpenedEnvelope(withKnife);
  }catch(error){
    console.error('信封打开失败',error);interaction.dataset.envelopePhase='error';
    announce('信封动画暂时无法播放，请重试。');
    setInteractionActions([{label:'重新打开信封',run:()=>unseal(withKnife)},returnAction()]);
  }finally{opening=false;interaction.removeAttribute('aria-busy');}
}
async function prepareCheckAppearance(){
  await document.fonts?.ready;
  const urls=new Set(['assets/check-ornate-frame.svg',...Object.values(thumbnailAssets)]);
  for(const element of [checkDialog,...checkDialog.querySelectorAll('*')])for(const pseudo of [null,'::before','::after']){
    for(const match of getComputedStyle(element,pseudo).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(match[1]);
  }
  await Promise.all([...urls].map(url=>{const image=new Image();image.src=url;return image.decode();}));
  // Flush layout and paint the complete check card behind the loading overlay.
  checkDialog.getBoundingClientRect();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
function prepareDice(){
  if(frame.hasAttribute('srcdoc'))return;
  diceReady=false;frame.dataset.diceState='loading';
  frame.srcdoc='<!doctype html><html lang="zh-CN" class="embedded-root"><body class="embedded">'+document.querySelector('#study-dice-document').innerHTML+'</body></html>';
}
function sendRoll(){if(!activeCheck?.started||activeCheck.result||activeCheck.sent||!diceReady)return;activeCheck.sent=true;frame.contentWindow.postMessage({type:'study-roll',id:activeCheck.id},location.protocol==='file:'?'*':location.origin);}
function resetDice(){if(diceReady)frame.contentWindow.postMessage({type:'study-reset'},location.protocol==='file:'?'*':location.origin);}
function randomD100(){const a=new Uint32Array(1),limit=Math.floor(4294967296/100)*100;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%100+1;}
function finishCheck(){if(!activeCheck?.result)return;clearTimeout(resultTimer);const {onResult,result}=activeCheck;activeCheck=null;checkDialog.close();resetDice();onResult(result);}
function resolveRoll(value){
  if(!activeCheck?.started||activeCheck.result)return;
  clearTimeout(diceTimer);
  const result=evaluateRoll(value,state.attributes[activeCheck.attribute],activeCheck.difficulty);
  activeCheck.result=result;
  if(result.kind in rollCounts)rollCounts[result.kind]++;
  window.InvitationStudySounds?.play(result.passed?'check-success':'check-failure');
  $('#check-verdict').textContent=`${String(value).padStart(2,'0')} · ${outcomeNames[result.kind]}`;
  $('#check-title').textContent=outcomeNames[result.kind];
  $('#check-result-number').textContent=String(value).padStart(2,'0');$('#check-result-number').hidden=false;
  checkDialog.dataset.outcome=result.kind;
  checkDialog.dataset.passed=String(result.passed);
  checkDialog.dataset.phase='result';
  $('#check-roll-label').textContent='结果已落定';
  $('#check-progress').textContent='结果已落定';
  resultTimer=setTimeout(finishCheck,3000);
}
function performCheck(attribute,difficulty,title,context,onResult){if(activeCheck)return;window.InvitationStudySounds?.prepare('check-success');window.InvitationStudySounds?.prepare('check-failure');interaction.close();activeCheck={id:++sequence,attribute,difficulty,onResult,started:false,sent:false,result:null};delete checkDialog.dataset.outcome;delete checkDialog.dataset.passed;checkDialog.dataset.phase='ready';
  $('#check-result-number').hidden=true;$('#check-result-number').textContent='';
  const value=state.attributes[attribute],threshold=checkThreshold(value,difficulty),bonus=state.choice===attribute?5:0;
  $('#check-title').textContent='调查';$('#check-kind').textContent=`${difficulty==='extreme'?'极难':''}${attributeNames[attribute]}检定`;
  $('#check-context').textContent=context;$('#check-attribute-value').textContent=String(threshold);
  $('#check-bonus-value').textContent=`+${bonus}`;$('#check-bonus-attribute').textContent=attributeNames[attribute];
  $('#check-bonus-item').textContent=bonus?keepsakes[attribute].name:'无对应纪念品';
  $('#check-bonus-card').classList.toggle('no-bonus',!bonus);
  const bonusArt=$('#check-bonus-art');bonusArt.hidden=!bonus;
  if(bonus)bonusArt.src=thumbnailAssets[({strength:'musicbox',intelligence:'windchime',will:'pendant'})[attribute]];else bonusArt.removeAttribute('src');
  $('#check-verdict').textContent='等待掷骰';
  $('#check-progress').textContent=`${difficulty==='extreme'?'极难检定':'D100'} · 点数不高于 ${threshold} 即通过`;
  $('#check-roll').disabled=false;$('#check-roll-label').textContent='点击骰子';checkDialog.showModal();
  frame.hidden=false;
  prepareDice();
}
$('#check-roll').onclick=()=>{
  if(!activeCheck||activeCheck.started)return;
  activeCheck.started=true;checkDialog.dataset.phase='rolling';$('#check-roll').disabled=true;$('#check-roll-label').textContent='正在投掷…';
  window.InvitationAudio?.playDice();
  $('#check-verdict').textContent='骰子即将落下…';$('#check-progress').textContent='正在投掷双十面骰';
  sendRoll();
  diceTimer=setTimeout(()=>{if(activeCheck?.started&&!activeCheck.result){$('#check-context').textContent='骰子画面暂时不可用，已完成同样的 D100 随机检定。';resolveRoll(randomD100());}},16000);
};
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==(location.protocol==='file:'?'null':location.origin))return;const msg=event.data;if(msg?.type==='dice-ready'){diceReady=true;window.dispatchEvent(new Event('study-dice-ready'));frame.dataset.diceState=msg.rendererAvailable===false?'fallback':'ready';$('#check-dice-area').classList.toggle('models-ready',msg.rendererAvailable!==false);$('#check-dice-area').classList.toggle('numeric-fallback',msg.rendererAvailable===false);sendRoll();}else if(msg?.type==='dice-result'&&msg.id===activeCheck?.id&&Number.isInteger(msg.total)&&msg.total>=1&&msg.total<=100)resolveRoll(msg.total);});
for(const dialog of [interaction,choose,checkDialog,gain]){dialog.setAttribute('closedby','none');dialog.addEventListener('cancel',e=>e.preventDefault());}
$('#start-exploration').onclick=()=>{if(entry.hidden)return;entry.hidden=true;$('#study').hidden=false;if(window.InvitationLocalPreviewRequired){$('#hotspots').inert=true;return;}$('#hotspots').inert=false;refresh();window.InvitationDice.prepare().catch(()=>{});window.dispatchEvent(new Event('study-enter'));};
$('#study-direct-invitation').onclick=()=>window.InvitationAudio?.leaveStudy();
function finishSelection(){gain.close();$('#hotspots').inert=false;($('.static-room-stage')||$('#world canvas')||$('[data-object="note"]')).focus({preventScroll:true});}
$('#gain-continue').onclick=finishSelection;
document.querySelectorAll('[data-keepsake]').forEach(button=>button.onclick=()=>{
  if(state.choice)return;
  state.choice=button.dataset.keepsake;state.attributes[state.choice]+=5;choose.close();refresh();
  $('#hotspots').inert=true;
  $('#gain-title').textContent=`获得${keepsakes[state.choice].name}`;
  $('#gain-value').textContent=`你觉得${attributeNames[state.choice]}上升了`;
  gain.showModal();announce(`获得${keepsakes[state.choice].name}，你觉得${attributeNames[state.choice]}上升了。`);
});
document.querySelectorAll('[data-object]').forEach(button=>button.onclick=()=>{if(!state||activeCheck||interactionBusy()||!canInspectDeskObject(button.dataset.object))return;({notebook,record,drawer,photo,note,pendant,windchime,musicbox,teacup,handheld})[button.dataset.object]();});
window.addEventListener('study-object',e=>{if(state&&!activeCheck&&!interactionBusy()&&!interaction.open&&!choose.open&&!gain.open&&canInspectDeskObject(e.detail))({notebook,record,drawer,photo,note,pendant,windchime,musicbox,teacup,handheld})[e.detail]?.();});
window.addEventListener('record-state',()=>{if(state&&interaction.open&&currentObject==='record')record();});
window.addEventListener('study-scene-ready',sceneEvent);
refresh();
