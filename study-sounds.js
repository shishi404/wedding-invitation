(() => {
  'use strict';
  const definitions={
    'notebook-open':['notebook-open','mechanism'],
    'notebook-tear':['notebook-tear','mechanism'],
    'notebook-pickup':['notebook-pickup','object'],
    'handheld-pickup':['handheld-pickup','object'],
    'box-pickup':['box-pickup','object'],
    'sticky-note':['sticky-note','object'],
    'wax':['wax','action-result'],
    'envelope-open':['envelope-open','mechanism'],
    'cup':['cup-clink','object'],
    'check-success':['check-success','result'],
    'check-failure':['failure','result'],
    'musicbox-place':['musicbox-place','object'],
    'unlock':['unlock','mechanism'],
    'photo':['photo','object'],
    'box-open':['box-open','mechanism'],
    'box-break':['box-break','action-result'],
    'box-failure':['box-failure','action-result'],
    'key':['key','object'],
    'necklace':['necklace','object'],
    'record-break':['record-break','action-result'],
    'record-search':['record-search','action-result'],
  };
  const channels=new Map(),buffers=new Map();let context,ambient,ambientToken=0,ambientWanted=false,stopGeneration=0;
  const src=name=>`assets/sfx/${name}.ogg`;
  let preparedCampfire,campfirePreparation;
  async function prepareCampfire(){
    if(preparedCampfire)return;
    if(campfirePreparation)return campfirePreparation;
    campfirePreparation=(async()=>{
      const response=await fetch(src('campfire'),{signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('篝火声下载失败');
      const objectURL=URL.createObjectURL(await response.blob());
      preparedCampfire={objectURL,url:objectURL+'#campfire.ogg'};
    })().catch(error=>{campfirePreparation=null;throw error;});
    return campfirePreparation;
  }
  window.addEventListener('pagehide',()=>{if(preparedCampfire)URL.revokeObjectURL(preparedCampfire.objectURL);});
  function audioContext(){
    const Constructor=window.AudioContext||window.webkitAudioContext;
    if(!Constructor)return null;
    context ||= new Constructor();
    if(context.state==='suspended')context.resume().catch(()=>{});
    return context;
  }
  function notify(name,url){window.dispatchEvent(new CustomEvent('study-sound-started',{detail:{name,src:url}}));}
  function bufferFor(url,ctx){
    if(!buffers.has(url))buffers.set(url,fetch(url).then(response=>{if(!response.ok)throw Error('Sound unavailable');return response.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes)).catch(error=>{buffers.delete(url);throw error;}));
    return buffers.get(url);
  }
  async function play(name,{waitForEnd=false}={}){
    const definition=definitions[name];if(!definition)return false;
    const [choices,channel]=definition,stem=Array.isArray(choices)?choices[Math.floor(Math.random()*choices.length)]:choices,url=src(stem);
    if(!channels.has(channel))channels.set(channel,{token:0});
    const slot=channels.get(channel),token=++slot.token;
    slot.finish?.(false);slot.stopped=false;try{slot.node?.stop();}catch{}slot.media?.pause();
    let finish;
    const ended=new Promise(resolve=>{finish=completed=>{if(slot.finish===finish)slot.finish=null;resolve(completed);};});
    slot.finish=finish;
    try{
      // Unlock one context on entry; later animation/result cues work on mobile.
      const ctx=audioContext();
      if(ctx){
        const buffer=await bufferFor(url,ctx);
        if(ctx.state==='suspended')await ctx.resume();
        if(token!==slot.token){finish(false);return false;}
        const node=ctx.createBufferSource(),gain=ctx.createGain();node.buffer=buffer;gain.gain.value=.65;
        node.connect(gain);gain.connect(ctx.destination);slot.node=node;
        node.onended=()=>{node.disconnect();gain.disconnect();if(slot.node===node)slot.node=null;finish(token===slot.token);};node.start();
      }else{
        if(!slot.media){slot.media=document.createElement('audio');slot.media.preload='none';slot.media.id=`study-effect-${channel}`;slot.media.volume=.65;document.body.append(slot.media);}
        slot.media.onended=()=>finish(token===slot.token);slot.media.onerror=()=>finish(false);
        slot.media.src=url;slot.media.currentTime=0;await slot.media.play();
        if(token!==slot.token){if(slot.stopped)slot.media.pause();finish(false);return false;}
      }
      notify(name,url);return waitForEnd?ended:true;
    }catch{finish(false);return false;}
  }
  async function playSequence(names){
    const generation=stopGeneration;
    for(const name of names){
      if(generation!==stopGeneration||!await play(name,{waitForEnd:true}))return false;
    }
    return true;
  }
  async function prepare(name){
    const definition=definitions[name],ctx=audioContext();if(!definition||!ctx)return false;
    const choices=Array.isArray(definition[0])?definition[0]:[definition[0]];
    try{await Promise.all(choices.map(stem=>bufferFor(src(stem),ctx)));return true;}catch{return false;}
  }
  async function startCampfire(){
    if(ambientWanted)return;ambientWanted=true;const token=++ambientToken;
    audioContext();
    // Keep the encoded loop; the loader downloads it without decoding a large PCM buffer.
    if(!ambient){ambient=document.createElement('audio');ambient.id='study-campfire';ambient.preload='none';ambient.loop=true;ambient.volume=.2;ambient.src=preparedCampfire?.url||src('campfire');document.body.append(ambient);}
    try{await ambient.play();if(token!==ambientToken){if(!ambientWanted)ambient.pause();return;}notify('campfire',ambient.src);}
    catch{if(token===ambientToken)ambientWanted=false;}
  }
  function stop(){
    ++stopGeneration;++ambientToken;ambientWanted=false;ambient?.pause();
    for(const slot of channels.values()){++slot.token;slot.finish?.(false);slot.stopped=true;try{slot.node?.stop();}catch{}slot.media?.pause();}
  }
  window.InvitationStudySounds={play,playSequence,prepare,prepareCampfire,stop};
  // Unlock the effects context in the entry gesture without playing the room ambience.
  window.addEventListener('study-enter',audioContext);
  window.addEventListener('study-room-enter',startCampfire);
  window.addEventListener('pagehide',stop);
})();
