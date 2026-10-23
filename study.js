import {keepsakes,initialState,checkThreshold,evaluateRoll,recordRoute,drawerRoute} from './study-rules.js';

const $ = s => document.querySelector(s);
const interaction=$('#interaction-dialog'), choose=$('#choose-dialog'), checkDialog=$('#check-dialog');
const inventory=$('#inventory'), frame=$('#dice-frame');
const entry=$('#entry-screen'), gain=$('#gain-dialog');
const attributeNames={strength:'力量',intelligence:'智力',will:'意志'};
const letterOpenerDescription='看起来是shishi最爱玩的游戏里面的道具，看起来能很方便的把东西剥离下来';
let state=initialState(), currentObject=null, activeCheck=null, diceReady=false, diceTimer=null, resultTimer=null, sequence=0, opening=false;
const outcomeNames={critical:'大成功',success:'成功',failure:'失败',fumble:'大失败'};
const announce=text=>{$('#game-status').textContent=text;};
const returnAction=()=>({label:'返回',run:()=>interaction.close(),secondary:true});
const continueSearchAction=()=>({label:'继续寻找请柬的线索',run:()=>interaction.close(),secondary:true});
const lookForKeyAction=()=>({label:'看起来我应该先找一把钥匙',clue:'一把钥匙',run:()=>interaction.close(),secondary:true});
const sceneEvent=()=>window.dispatchEvent(new CustomEvent('study-state',{detail:{choice:state.choice,drawerOpen:state.drawerOpen,key:state.key,knife:state.knife,envelope:state.envelope}}));
const artAssets={musicbox:'musicbox-source-detail-v1',pendant:'pendant-books-source-detail-v1',windchime:'windchime-source-detail-v1',note:'note-source-detail-v2',notebook:'notebook-source-detail-v2',record:'record-source-detail-v2',drawer:'drawer-source-closed-detail-v2','drawer-open':'drawer-source-open-detail-v2','drawer-empty':'drawer-source-empty-detail-v2',envelope:'envelope-source-detail-v1',knife:'knife-source-detail-v1',key:'key-source-detail-v1',invitation:'envelope-source-detail-v1',photo:'photo-source-detail-v2'};
const thumbnailAssets={envelope:'envelope-source-thumbnail-v1',knife:'knife-source-thumbnail-v1',key:'key-source-thumbnail-v1'};
const keepsakeArt=()=>({strength:'musicbox',will:'pendant',intelligence:'windchime'})[state.choice]||'keepsake';
const canInspectDeskObject=name=>name==='note'||!!state.choice&&name!==keepsakeArt();
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
  $('#interaction-title').textContent=title;
  const keyClues={success:['钥匙','唱片机'],critical:['请柬','唱片机','拆信刀','钥匙'],fumble:['钥匙'],failure:['打开某个锁']};
  const clue=art==='knife'?'把东西剥离下来':art==='key'||art==='notebook'&&state.notebook?keyClues[state.notebook?.kind]:art==='drawer'?'一把钥匙':null;
  setClueText($('#interaction-copy'),copy,clue);
  const illustration=$('#object-art');illustration.className=`object-art ${art}`;illustration.dataset.art=art;illustration.replaceChildren();
  const stage=document.createElement('div');stage.className='inspection-stage';illustration.append(stage);
  if(artAssets[art]){
    stage.classList.add('is-loading');stage.dataset.loading='正在检查…';
    const image=document.createElement('img');image.src=`assets/${artAssets[art]}.webp`;image.alt='';image.className='inspection-image';image.decoding='sync';stage.append(image);
    image.decode().then(()=>{stage.classList.remove('is-loading');stage.classList.add('is-ready');}).catch(()=>{stage.classList.remove('is-loading');stage.classList.add('art-error');stage.dataset.loading='物品图像暂时无法载入，仍可继续调查。';});
    if(art==='invitation'){const card=document.createElement('div');card.className='reveal-card';const heading=document.createElement('small');heading.textContent='婚 礼 请 柬';const names=document.createElement('strong');const d=window.invitationData||{};names.textContent=`${d.partnerOne||'陈萌'} & ${d.partnerTwo||'叶倩芸'}`;const date=document.createElement('span');date.textContent=d.date||'2026.11.21';card.append(heading,names,date);stage.append(card);}
  }
  else{const emblem=document.createElement('span');emblem.className='keepsake-detail';emblem.textContent=keepsakes[state?.choice]?.icon||'◇';stage.append(emblem);}
  $('#interaction-actions').replaceChildren(...actions.map(action=>{
    const b=document.createElement('button');b.type='button';setClueText(b,action.label,action.clue);if(action.secondary)b.className='secondary';if(action.musicControl)b.classList.add('record-music-control');b.onclick=action.run;return b;
  }));
  if(!interaction.open){interaction.showModal();interaction.scrollTop=0;}
}
function items() {
  if(!state)return [];
  const list=state.choice?[{id:'keepsake',...keepsakes[state.choice]}]:[];
  if(state.key)list.push({id:'key',name:'旧钥匙',icon:'⚿',description:'从笔记书脊里找到的钥匙。齿口正好与抽屉的锁孔吻合。'});
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
    if(item&&artAssets[itemArt]){const image=document.createElement('img');image.src=`assets/${thumbnailAssets[itemArt]||artAssets[itemArt]}.webp`;image.alt='';image.className='inventory-photo';slot.append(image);}else slot.append(icon);
    if(item){slot.type='button';slot.setAttribute('aria-label',`查看${item.name}`);const label=document.createElement('small');label.textContent=item.name;slot.append(label);slot.onclick=()=>{currentObject=item.id;if(item.id==='envelope')openEnvelope();else if(itemArt==='musicbox')musicbox();else if(itemArt==='windchime')windchime();else if(itemArt==='pendant')pendant();else showObject(item.name,item.description,itemArt,[returnAction()],'随身物品');};}
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
  showObject('陶瓷八音盒','这个八音盒是shishi送给之南的生日礼物，之南很喜欢。这还是一个首饰盒，发条在底部，转一圈，会播放独特又好听的歌。','musicbox',[{label:'转动发条',run:()=>window.InvitationAudio?.windMusicBox()},{label:'看上去请柬不在八音盒里',run:()=>interaction.close(),secondary:true}]);
}
function pendant(){
  currentObject='pendant';
  showObject('小王子吊坠','shishi和之南刚认识时，夜市上，之南称赞了shishi戴着还可以，shishi花一百块买下来了。后来shishi发现淘宝只卖五十。','pendant',[{label:'看上去请柬也不在这里',run:()=>interaction.close(),secondary:true}]);
}
function windchime(){
  currentObject='windchime';
  showObject('黄铜风铃','之南送给shishi的生日礼物，随风发出悦耳的铃声。但是深圳梅雨季，木制的底座总是长霉。','windchime',[{label:'摇摇风铃',run:()=>window.InvitationAudio?.playBell()},{label:'铃铛里面怎么看也塞不进请柬',run:()=>interaction.close(),secondary:true}]);
}
function note(){
  currentObject='note';
  if(state.choice){showObject('留言便签',`“可以从桌子上挑选一件纪念品，寻找婚礼请柬时可能帮得上忙”\n你已经选好了${keepsakes[state.choice].name}。`,'note',[{label:'继续寻找请柬的线索',run:()=>interaction.close(),secondary:true}]);return;}
  choose.showModal();
}
function photo(){
  currentObject='photo';
  showObject('新郎新娘的合影','桌面上有一点灰尘，但相框却被擦得很干净，是shishi和之南领证的纪念照。','photo',[{label:'看上去请柬不在照片里面',run:()=>interaction.close(),secondary:true}]);
}
function notebook(){
  currentObject='notebook';
  if(state.notebook){
    const summaries={
      success:'日记里反复出现“书脊”和“唱片机”。钥匙已经收好，唱片机里应该还有婚礼请柬相关线索。',
      failure:'希望大家能叮嘱shishi写日记。',
      critical:'两篇有折痕的日记记载得很清楚：请柬锁在抽屉里，钥匙夹在书脊里，拆信刀放在唱片机底下的暗格里。钥匙已经收好，快说谢谢shishi！',
      fumble:'笔记的封面已经被你不小心拽掉了，夹在书脊与书封之间的钥匙也已经收好。希望shishi不会怪罪。'
    };
    showObject('旧笔记',summaries[state.notebook.kind],'notebook',[continueSearchAction()]);return;
  }
  showObject('旧笔记','应该是之南叮嘱shishi每天要写的日记，记录了shishi的日常与心情，最近的日期是空的，没有继续写，真是三分钟热度哇。','notebook',[{label:'快速翻阅，寻找线索',run:()=>performCheck('intelligence','normal','智力检定','快速翻阅日记，寻找其中的线索。',result=>{
    state.notebook=result;state.key=true;acquired('旧钥匙');
    const lines={critical:'你清楚的知道，按照shishi草履虫般的记忆力，重要的信息一定会单独记载，你果然在两篇有折痕的日记内找到了相关信息：“担心请柬弄丢，锁在抽屉里，钥匙夹了书脊里”；“拆信刀放在唱片机底下小抽屉里面，找不到记得翻翻”。你轻而易举拿到了钥匙，该去唱片机里找拆信刀了，快说谢谢shishi！',success:'日记除了日常琐事，也会写一些辅助记忆的关键词，你注意到频繁出现，“书脊”，“唱片机”两个词。你果然在书脊中找到了钥匙，那么唱片机里肯定还有东西！',failure:'稀稀拉拉的日记，不是今天喝啤酒，就是明天打猎杀对决游戏，丁点有用的线索都没有。\n你没好气地把笔记丢回桌上，一把旧钥匙从松脱的书脊中滑了出来。看起来能打开某个锁。',fumble:'每一页都是琐碎的事项，甚至上班怎么摸鱼都写的一清二楚！越翻越烦躁，不小心将书的封面拽掉了，夹在书脊与书封之间的钥匙也掉出来了！希望shishi不会怪罪。'};
    showObject(`智力检定 · ${outcomeNames[result.kind]}`,lines[result.kind],'key',[continueSearchAction()],'获得物品 · 旧钥匙');
  })},{label:'待会儿再检查笔记',run:()=>interaction.close(),secondary:true}]);
}
function record(){
  if(state.recordBroken){currentObject='record';showObject('黑胶唱片机','唱片机坏了。','record',[{label:'唱片机里没有更多的线索了，再去找找别的地方',run:()=>interaction.close(),secondary:true}]);return;}
  currentObject='record';const route=recordRoute(state);const playing=window.InvitationAudio?.recordPlaying;
  let copy='shishi一直很想买台唱片机但一直没买，他哪儿来的黑胶唱片机？上面有唱片，里面一定有什么东西！';const actions=[];
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
});}
function drawer(){
  currentObject='drawer';const route=drawerRoute(state);
  if(route==='open'){showObject('已经打开的抽屉','信封已经取出。木板上留下一个没有落灰的长方形印记。','drawer-empty',[{label:'查看信封',run:openEnvelope},returnAction()]);return;}
  if(route==='locked'){showObject('上锁的抽屉','锁得很紧，没办法轻易拉开。去找把钥匙吧。','drawer',[lookForKeyAction()]);return;}
  const actions=[];let copy='锁住的抽屉，要说请柬放在哪儿，一定是放在这儿，但是需要一把钥匙。';
  if(route==='key'){copy+='\n你找到的旧钥匙，形状恰好与锁孔吻合。';actions.push({label:'用钥匙打开',run:()=>takeEnvelope()},returnAction());}
  else{
    actions.push({label:'我的超级智慧告诉我该使用超级力量拉开这个抽屉',run:forceDrawer},lookForKeyAction());
  }
  showObject('上锁的抽屉',copy,'drawer',actions);
}
function forceDrawer(){
  if(state.drawerAttempted){showObject('上锁的抽屉','锁得很紧，没办法轻易拉开。去找把钥匙吧。','drawer',[lookForKeyAction()]);return;}
  performCheck('strength','extreme','力量检定 · 极难','抓住把手，尝试拉开上锁的抽屉。',result=>{
    state.drawerAttempted=true;
    if(result.passed){takeEnvelope(result.kind==='critical'?'叽里咕噜说啥呢，你抓住把手，刚一用力，锁扣便整齐地脱开。抽屉顺势滑出，轻得仿佛一直在等你。':'你深吸一口气，猛地拉开了抽屉，老旧锁扣终于松脱。');}
    else{refresh();showObject(result.kind==='failure'?'力量检定·极难·失败':`力量极难检定 · ${outcomeNames[result.kind]}`,result.kind==='fumble'?'把手发出一声不祥的脆响，你赶紧松手，把手顺势掉在地上，好了好了，这下坏啦。抽屉纹丝不动，幸好锁孔还完好。\n锁得很紧，没有办法用蛮力拉开。去找一把钥匙吧。':'你使了使劲，抽屉却纹丝不动。锁的很紧，没有办法直接拉开。\n\n你得赶紧找到婚礼请柬，桌子上某个地方肯定会有钥匙。','drawer',[lookForKeyAction()]);}
  });
}
function takeEnvelope(prefix){state.drawerOpen=true;state.envelope=true;acquired('火漆信封');const copy='一封厚实的信封躺在抽屉正中。 婚礼请柬一定在信封里面。';showObject('抽屉里的信',prefix?`${prefix}\n${copy}`:copy,'drawer-open',[{label:'拿起信封',run:openEnvelope},returnAction()],'发现物品 / 火漆信封');}
function openEnvelope(){
  currentObject='envelope';
  if(!state.seal){showObject('奇怪火漆封缄的信','请柬一定在信封里，但是信上的火漆上有着一个奇怪的印记，你忍不住想触碰它','envelope',[{label:'触碰火漆',run:()=>performCheck('will','normal','意志检定','将指尖轻轻放在信封的火漆上。',result=>{
    state.seal=result;const lines={critical:'指尖刚碰到火漆，你就像忽然读懂了这封信里所有没说出口的话。\n从初次相识到决定相伴，shishi和之南把一路走来的心意，都认真收进了这份邀请里。你也会是他们这一天里，很想见到的人。',success:'指尖碰到火漆，凉意很快散去。你仿佛听见shishi和之南的笑声，心里也跟着轻快起来。\n这枚奇怪的印记，大概只是他们藏起来的一点小心思。信封里装着的，是一份认真准备的邀请。',failure:'你盯着印记看了半天，还是没看明白，脑海里却先浮现出婚礼上热闹的模样。\n算了，猜不透也没关系。你已经开始期待，和大家一起见证shishi与之南的婚礼。',fumble:'你刚碰到火漆，就满脑子都是婚宴上的好吃的，连那枚奇怪的印记都越看越像一块小饼干。\n还没拆开请柬，你已经忍不住笑了。看来这场婚礼，你已经开始期待了。'};
    refresh();showObject(`意志检定 · ${outcomeNames[result.kind]}`,lines[result.kind],'envelope',[{label:'继续拆信',run:openEnvelope}]);
  })}]);return;}
  const actions=state.knife?[{label:'用拆信刀小心地拆开',run:()=>unseal(true)}]:[{label:'直接撕开信封',run:()=>unseal(false)},{label:'先找一件拆信工具',run:()=>interaction.close(),secondary:true}];
  showObject('信封里的答案',state.knife?'拆信刀应该可以小心的取下火漆了，划开封口。答案，近在眼前。':'封口粘得很牢。你可以直接撕开，肯定会损坏这个火漆，也许有更合适的工具。','envelope',actions);
}
function unseal(withKnife){if(opening)return;opening=true;$('#object-art').classList.add('opening');$('#interaction-actions').querySelectorAll('button').forEach(b=>b.disabled=true);
  setTimeout(()=>{state.opened=true;opening=false;showObject('原来，是一场喜事',withKnife?'你完美通关，保留了完整的火漆，信用评级+1。\n\n划开封口，你抽出一张温暖的请柬。\n“关于往后的故事，我们想邀请你，一起见证。”':'你沿着封口撕开一道小口，抽出了里面完好的请柬。\n“关于往后的故事，我们想邀请你，一起见证。”','invitation',[{label:'阅读婚礼请柬',run:()=>{window.InvitationAudio?.leaveStudy();location.href='invitation.html';}}],'陈萌 & 叶倩芸 · 敬邀');},matchMedia('(prefers-reduced-motion: reduce)').matches?0:750);
}
function sendRoll(){if(!activeCheck?.started||activeCheck.result||activeCheck.sent||!diceReady)return;activeCheck.sent=true;frame.contentWindow.postMessage({type:'study-roll',id:activeCheck.id},location.protocol==='file:'?'*':location.origin);}
function randomD100(){const a=new Uint32Array(1),limit=Math.floor(4294967296/100)*100;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%100+1;}
function finishCheck(){if(!activeCheck?.result)return;clearTimeout(resultTimer);const {onResult,result}=activeCheck;activeCheck=null;checkDialog.close();onResult(result);}
function resolveRoll(value){
  if(!activeCheck?.started||activeCheck.result)return;
  clearTimeout(diceTimer);
  const result=evaluateRoll(value,state.attributes[activeCheck.attribute],activeCheck.difficulty);
  activeCheck.result=result;
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
function performCheck(attribute,difficulty,title,context,onResult){if(activeCheck)return;interaction.close();activeCheck={id:++sequence,attribute,difficulty,onResult,started:false,sent:false,result:null};delete checkDialog.dataset.outcome;delete checkDialog.dataset.passed;checkDialog.dataset.phase='ready';
  $('#check-result-number').hidden=true;$('#check-result-number').textContent='';
  const value=state.attributes[attribute],threshold=checkThreshold(value,difficulty),bonus=state.choice===attribute?5:0;
  $('#check-title').textContent='调查';$('#check-kind').textContent=`${difficulty==='extreme'?'极难':''}${attributeNames[attribute]}检定`;
  $('#check-context').textContent=context;$('#check-attribute-value').textContent=String(threshold);
  $('#check-bonus-value').textContent=`+${bonus}`;$('#check-bonus-attribute').textContent=attributeNames[attribute];
  $('#check-bonus-item').textContent=bonus?keepsakes[attribute].name:'无对应纪念品';
  $('#check-bonus-card').classList.toggle('no-bonus',!bonus);
  const bonusArt=$('#check-bonus-art');bonusArt.hidden=!bonus;
  if(bonus)bonusArt.src={strength:'assets/musicbox-source-sprite-v2-flat.png',intelligence:'assets/windchime-source-detail-v1.webp',will:'assets/pendant-original-face-32.png'}[attribute];else bonusArt.removeAttribute('src');
  $('#check-verdict').textContent='等待掷骰';
  $('#check-progress').textContent=`${difficulty==='extreme'?'极难检定':'D100'} · 点数不高于 ${threshold} 即通过`;
  $('#check-roll').disabled=false;$('#check-roll-label').textContent='点击骰子';checkDialog.showModal();
  frame.hidden=false;
  if(!frame.getAttribute('src'))frame.src='dice.html?embed=1';
}
$('#check-roll').onclick=()=>{
  if(!activeCheck||activeCheck.started)return;
  activeCheck.started=true;checkDialog.dataset.phase='rolling';$('#check-roll').disabled=true;$('#check-roll-label').textContent='正在投掷…';
  window.InvitationAudio?.playDice();
  $('#check-verdict').textContent='骰子即将落下…';$('#check-progress').textContent='正在投掷双十面骰';
  sendRoll();
  diceTimer=setTimeout(()=>{if(activeCheck?.started&&!activeCheck.result){$('#check-context').textContent='骰子画面暂时不可用，已完成同样的 D100 随机检定。';resolveRoll(randomD100());}},16000);
};
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==(location.protocol==='file:'?'null':location.origin))return;const msg=event.data;if(msg?.type==='dice-ready'){diceReady=true;$('#check-dice-area').classList.toggle('models-ready',msg.rendererAvailable!==false);$('#check-dice-area').classList.toggle('numeric-fallback',msg.rendererAvailable===false);sendRoll();}else if(msg?.type==='dice-result'&&msg.id===activeCheck?.id&&Number.isInteger(msg.total)&&msg.total>=1&&msg.total<=100)resolveRoll(msg.total);});
checkDialog.addEventListener('cancel',e=>e.preventDefault());
interaction.addEventListener('cancel',e=>{if(opening)e.preventDefault();});
$('#start-exploration').onclick=()=>{if(entry.hidden)return;entry.hidden=true;$('#study').hidden=false;$('#hotspots').inert=false;refresh();window.InvitationAudio?.startBackground();};
$('#study-direct-invitation').onclick=()=>window.InvitationAudio?.leaveStudy();
function finishSelection(){gain.close();$('#hotspots').inert=false;$('[data-object="note"]').focus({preventScroll:true});}
$('#gain-continue').onclick=finishSelection;
gain.addEventListener('cancel',event=>{event.preventDefault();finishSelection();});
document.querySelectorAll('[data-keepsake]').forEach(button=>button.onclick=()=>{
  if(state.choice)return;
  state.choice=button.dataset.keepsake;state.attributes[state.choice]+=5;choose.close();refresh();
  $('#hotspots').inert=true;
  $('#gain-title').textContent=`获得${keepsakes[state.choice].name}`;
  $('#gain-value').textContent=`你觉得${attributeNames[state.choice]}上升了`;
  gain.showModal();announce(`获得${keepsakes[state.choice].name}，你觉得${attributeNames[state.choice]}上升了。`);
});
document.querySelectorAll('[data-object]').forEach(button=>button.onclick=()=>{if(!state||activeCheck||!canInspectDeskObject(button.dataset.object))return;({notebook,record,drawer,photo,note,pendant,windchime,musicbox})[button.dataset.object]();});
window.addEventListener('study-object',e=>{if(state&&!activeCheck&&!interaction.open&&!choose.open&&!gain.open&&canInspectDeskObject(e.detail))({notebook,record,drawer,photo,note,pendant,windchime,musicbox})[e.detail]?.();});
window.addEventListener('record-state',()=>{if(state&&interaction.open&&currentObject==='record')record();});
refresh();
