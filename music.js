(() => {
  'use strict';
  const button = document.querySelector('#music-toggle');
  const label = document.querySelector('#music-toggle-label') || button;
  const disc = document.querySelector('#music-record-icon');
  const audio = document.querySelector('#background-music');
  const status = document.querySelector('#music-status');
  const config = window.invitationData || {};
  const audioSource=value=>window.InvitationAudioSource?.(value)||value;
  const cachedSource=value=>{value=audioSource(value);return window.InvitationMediaSource?.(value)||value;};
  // Native music keeps a normal media URL. Blob URLs (especially fragments on
  // them) can fail in iOS WebViews even when the entry HTTP track played.
  const musicSource=value=>audioSource(value);
  const nativeAttempts=new WeakMap();
  function playNative(media){
    const attempt={expired:false};nativeAttempts.set(media,attempt);
    const started=Promise.resolve(media.play()); // Call before any await: retain the click.
    let timer;
    started.then(()=>{if(attempt.expired&&nativeAttempts.get(media)===attempt)media.pause();},()=>{});
    return Promise.race([started,new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        attempt.expired=true;
        if(nativeAttempts.get(media)===attempt)media.pause();
        const error=Error('音乐暂时未能开始，请再试一次。');error.name='TimeoutError';reject(error);
      },8000);
    })]).finally(()=>clearTimeout(timer));
  }
  // A mobile reader shares the parent's already-unlocked media element.
  if(window.parent&&window.parent!==window&&window.frameElement?.id==='invitation-reader-frame'){
    const parent=window.parent,player=parent.InvitationAudio;
    if(player){
      const parentButton=parent.document.querySelector('#music-toggle');
      const sync=()=>{label.textContent=parent.document.querySelector('#music-toggle-label').textContent;button.setAttribute('aria-pressed',parentButton.getAttribute('aria-pressed'));};
      button.removeAttribute('aria-controls');button.addEventListener('click',()=>player.toggleRecord());
      const retry=event=>{if(!event.target?.closest?.('#music-toggle'))player.resumeAfterGesture();};
      document.addEventListener('click',retry,{capture:true});document.addEventListener('touchend',retry,{capture:true,passive:true});
      document.addEventListener('WeixinJSBridgeReady',retry);
      const observer=new MutationObserver(sync);observer.observe(parentButton,{attributes:true,childList:true,subtree:true});
      window.addEventListener('pagehide',()=>observer.disconnect());window.InvitationAudio=player;sync();return;
    }
  }
  const isStudy = !!document.querySelector('#study');
  const sharedPlaylist = isStudy || document.body?.dataset?.musicPlaylist === 'study';
  const autoplay = document.body?.hasAttribute?.('data-autoplay-music') || false;
  let retryAutoplay = false;
  let studyRoomReady = false;
  let readingInvitation = false;
  let invitationRecordBroken = false;
  const source = audioSource(sharedPlaylist ? (config.studyMusic || config.music) : config.music);
  const record = document.querySelector('#record-music');
  const bell = document.querySelector('#bell-sound');
  const diceSound = document.querySelector('#dice-sound');
  const diceSources = ['assets/dice1.ogg','assets/dice2.ogg'].map(audioSource);
  if (diceSound) diceSound.volume = .65;
  const musicBox = document.querySelector('#musicbox-music');
  const musicBoxWindingSource=audioSource(config.musicBoxWinding||'assets/musicbox-winding.ogg');
  const musicBoxMusicSource=audioSource(config.musicBoxMusic||'assets/musicbox-nop.ogg');
  const musicBoxSequenceSource=config.musicBoxSequence||'';
  const musicBoxWindingSeconds=Number(config.musicBoxWindingSeconds)||2.9;
  if (musicBox) { musicBox.src = musicBoxSequenceSource||musicBoxWindingSource; musicBox.volume = .7; musicBox.loop = false; }
  let musicBoxPhase='idle',musicBoxResumeBackground=false,musicBoxRequest=0,retryMusicBox=false;
  const bellSources = Array.from({length:12},(_,i)=>audioSource(`assets/windchime-${String(i+1).padStart(2,'0')}.ogg`));
  if (bell) bell.volume = .7;
  const recordSources = Array.isArray(config.recordPlaylist) ? config.recordPlaylist.filter(src => typeof src === 'string' && src.trim()).map(audioSource) : [];
  if (!recordSources.length) recordSources.push(audioSource(config.recordMusic || 'assets/record-waltz.wav'));
  // In the study, the background track is the first record on one shared channel.
  if (sharedPlaylist && source) recordSources.splice(0, recordSources.length, ...new Set([source, ...recordSources]));
  let recordIndex = 0;
  if (record && !sharedPlaylist) { record.src = recordSources[recordIndex]; record.volume = .48; }
  let recordPlaying = false, resumeBackground = false, recordError = false, recordRequest = 0;
  let recordBroken = false;
  let enabled = false;
  let mediaPause=null;
  let request = 0,recordSourceChanges=0;
  if (sharedPlaylist) { audio.src = recordSources[0]; audio.loop=false; }
  else if (source) audio.src = source;
  audio.volume = .5;
  let preparedBackground,backgroundPreparation;
  async function prepareBackground(){
    if(preparedBackground)return;
    if(backgroundPreparation)return backgroundPreparation;
    const original=recordSources[0];
    backgroundPreparation=(async()=>{
      const response=await fetch(original,{signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('背景音乐下载失败');
      await response.arrayBuffer();preparedBackground=true;
      // Download readiness never changes the source unlocked by the entry click.
    })().catch(error=>{backgroundPreparation=null;throw error;});
    return backgroundPreparation;
  }
  function update() {
    if (sharedPlaylist && recordBroken) {
      label.textContent = '唱片已损坏';
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
      return;
    }
    label.textContent = enabled ? (sharedPlaylist ? '暂停音乐' : '关闭音乐') : (sharedPlaylist && (musicBoxPhase!=='idle'||audio.currentTime > 0) ? '恢复音乐' : '播放音乐');
    button.setAttribute('aria-pressed', String(enabled));
  }
  function syncPlayback() {
    const playing = !audio.paused && !audio.ended && !audio.error && audio.readyState >= 3;
    disc?.classList.toggle('is-playing', playing);
    if (sharedPlaylist) {
      const next = playing && enabled && !recordBroken;
      if (recordPlaying !== next) { recordPlaying = next; notifyRecord(); }
    }
  }
  // The study's 3D record and the music button follow actual media playback.
  for (const event of ['playing','play','pause','waiting','ended','emptied','error']) audio.addEventListener(event,()=>{
    syncPlayback();
    if(event==='pause'&&!recordSourceChanges&&sharedPlaylist&&enabled&&audio.paused&&!audio.ended&&!audio.error&&!mediaPause&&musicBoxPhase==='idle'&&(studyRoomReady||readingInvitation||autoplay)){
      enabled=false;retryAutoplay=true;update();syncPlayback();
    }
  });
  syncPlayback();
  async function setBackground(nextEnabled) {
    if(nextEnabled&&mediaPause)return;
    if (sharedPlaylist && recordBroken) { update(); return; }
    retryAutoplay = false;
    const current = ++request;
    if(nextEnabled&&musicBoxPhase!=='idle')cancelMusicBox();
    enabled = nextEnabled;
    update();
    status.textContent = '';
    if (!enabled) { resumeBackground = false; musicBoxResumeBackground=false; audio.pause(); syncPlayback(); return; }
    if (!sharedPlaylist && recordPlaying) { resumeBackground = true; return; }
    if (!sharedPlaylist && !source) {
      status.textContent = '音乐尚未设置，当前仅预览音乐开关。';
      return;
    }
    try {
      if (sharedPlaylist) recordError = false;
      await playNative(audio);
      if (!enabled || mediaPause || musicBoxPhase!=='idle' || (sharedPlaylist ? recordBroken : recordPlaying)) audio.pause();
      syncPlayback();
    } catch (error) {
      if (current !== request) return;
      enabled = false;
      if (sharedPlaylist) recordError = true;
      update();
      syncPlayback();
      retryAutoplay = (autoplay || readingInvitation || (isStudy && studyRoomReady)) && error.name === 'NotAllowedError';
      status.textContent = retryAutoplay ? '点击音乐按钮播放音乐。' : '音乐暂时无法播放，请稍后重试。';
    }
  }
  button.addEventListener('click', () => setBackground(!enabled));
  audio.addEventListener('error', () => {
    if (!enabled) return;
    ++request;
    enabled = false;
    if (sharedPlaylist) recordError = true;
    update();
    syncPlayback();
    status.textContent = '音乐暂时无法播放，请稍后重试。';
  });
  function notifyRecord() { window.dispatchEvent(new Event('record-state')); }
  async function stopRecord() {
    ++recordRequest;
    if (record) record.pause();
    recordPlaying = false;
    const shouldResume = resumeBackground && enabled;
    resumeBackground = false;
    notifyRecord();
    if (shouldResume && source) {
      try { await audio.play(); if (!enabled || recordPlaying) audio.pause(); }
      catch { enabled = false; update(); status.textContent = '请点击播放音乐，继续背景音乐。'; }
    }
  }
  async function playRecord() {
    if (!record || recordBroken) return;
    const token = ++recordRequest;
    if (!recordPlaying) resumeBackground = enabled && !audio.paused;
    audio.pause(); recordError = false; recordPlaying = true;
    try { await record.play(); if (token !== recordRequest) return; notifyRecord(); }
    catch { if (token !== recordRequest) return; recordError = true; await stopRecord(); status.textContent = '唱片暂时无法播放，请稍后重试。'; }
  }
  async function changeRecord(direction) {
    if (recordBroken || (!sharedPlaylist && !record)) return;
    recordIndex = (recordIndex + direction + recordSources.length) % recordSources.length;
    if (sharedPlaylist) {
      ++recordSourceChanges;
      try{
        audio.pause();audio.src=musicSource(recordSources[recordIndex]);audio.load?.();
        await setBackground(true);
      }finally{--recordSourceChanges;}
      return;
    }
    record.pause();
    record.src = musicSource(recordSources[recordIndex]);
    record.load?.();
    await playRecord();
  }
  async function finishMusicBox(error=false){
    const shouldResume=musicBoxResumeBackground&&!recordBroken;
    const completion=++musicBoxRequest;musicBoxPhase='idle';musicBoxResumeBackground=false;retryMusicBox=false;musicBox?.pause();
    if(shouldResume)await setBackground(true);
    else update();
    if(error&&completion===musicBoxRequest)status.textContent='八音盒暂时无法播放，请稍后重试。';
  }
  function cancelMusicBox(){
    ++musicBoxRequest;musicBoxPhase='idle';musicBoxResumeBackground=false;retryMusicBox=false;
    musicBox?.pause();if(musicBox)musicBox.currentTime=0;
  }
  async function playMusicBoxSource(src,phase,token){
    retryMusicBox=false;
    musicBoxPhase=phase;musicBox.pause();musicBox.src=musicSource(src);musicBox.volume=phase==='winding'?.7:.55;musicBox.load();
    try{
      await playNative(musicBox);
      if(token!==musicBoxRequest){if(musicBoxPhase==='idle')musicBox.pause();return false;}
      return true;
    }catch{
      if(token===musicBoxRequest)await finishMusicBox(true);
      return false;
    }
  }
  async function resumeMusicBox(){
    if(mediaPause||musicBoxPhase==='idle')return false;
    const token=musicBoxRequest;retryMusicBox=false;
    try{await playNative(musicBox);return token===musicBoxRequest;}
    catch(error){
      if(token===musicBoxRequest&&musicBoxPhase!=='idle'){
        retryMusicBox=error.name==='NotAllowedError';
        status.textContent=retryMusicBox?'点击页面继续播放八音盒。':'八音盒暂时无法播放，请重新转动发条。';
      }
      return false;
    }
  }
  musicBox?.addEventListener('ended',()=>{
    if(!musicBox.ended)return;
    if(musicBoxSequenceSource&&musicBoxPhase!=='idle')return finishMusicBox();
    if(musicBoxPhase==='winding')return playMusicBoxSource(musicBoxMusicSource,'music',musicBoxRequest);
    if(musicBoxPhase==='music')return finishMusicBox();
  });
  musicBox?.addEventListener('timeupdate',()=>{
    if(musicBoxSequenceSource&&musicBoxPhase==='winding'&&musicBox.currentTime>=musicBoxWindingSeconds){musicBoxPhase='music';musicBox.volume=.55;}
  });
  musicBox?.addEventListener('error',()=>{if(musicBoxPhase!=='idle')return finishMusicBox(true);});
  musicBox?.addEventListener('pause',()=>{if(musicBoxPhase!=='idle'&&!mediaPause&&musicBox.paused&&!musicBox.ended)retryMusicBox=true;});
  if(sharedPlaylist)audio.addEventListener('ended',()=>{
    if(audio.ended&&enabled&&!recordBroken&&musicBoxPhase==='idle')return changeRecord(1);
  });
  window.InvitationAudio = {
    prepareBackground,
    preloadSources:()=>[...new Set([source,...recordSources,...bellSources,...diceSources,...(musicBoxSequenceSource?[musicBoxSequenceSource]:[musicBoxWindingSource,musicBoxMusicSource])].filter(Boolean))],
    pauseForMedia(){
      const hold={background:enabled&&!audio.paused&&!audio.ended&&!recordBroken,musicBox:musicBoxPhase!=='idle'&&musicBox&&!musicBox.paused};
      mediaPause=hold;++request;retryAutoplay=false;enabled=false;resumeBackground=false;
      audio.pause();musicBox?.pause();update();syncPlayback();
      return ()=>{
        if(mediaPause!==hold)return;
        mediaPause=null;
        if(hold.musicBox&&musicBoxPhase!=='idle')return resumeMusicBox();
        else if(hold.background&&!recordBroken)return setBackground(true);
      };
    },
    startInvitation(){if(!readingInvitation)invitationRecordBroken=recordBroken;readingInvitation=true;recordBroken=false;button.disabled=false;window.InvitationStudySounds?.stop();window.InvitationStudySounds?.unlock?.();audio.muted=false;return setBackground(true);},
    endInvitation(){readingInvitation=false;if(invitationRecordBroken){invitationRecordBroken=false;window.InvitationAudio.breakRecord();}},
    resumeAfterGesture(){window.InvitationStudySounds?.unlock?.();if(retryMusicBox&&!mediaPause)return resumeMusicBox();if(retryAutoplay)return window.InvitationAudio.startBackground();},
    get recordPlaying() { return recordPlaying; },
    get recordError() { return recordError; },
    startBackground() { return enabled&&!audio.paused ? Promise.resolve() : setBackground(true); },
    async playDice() {
      if(window.InvitationStudySounds?.play&&(window.AudioContext||window.webkitAudioContext))return window.InvitationStudySounds.play('dice');
      if (!diceSound) return false;
      diceSound.pause();
      diceSound.src = cachedSource(diceSources[Math.floor(Math.random() * diceSources.length)]);
      diceSound.load();
      try { await diceSound.play(); return true; }
      catch { return false; }
    },
    async windMusicBox() {
      if (!musicBox) return false;
      if(musicBoxPhase==='idle')musicBoxResumeBackground=enabled&&!recordBroken;
      const token=++musicBoxRequest;++request;
      musicBoxPhase='winding';enabled=false;audio.pause();update();syncPlayback();status.textContent='';
      // Start the continuous winding + song file in this click. No asynchronous
      // source replacement or second play() is needed when winding ends.
      return playMusicBoxSource(musicBoxSequenceSource||musicBoxWindingSource,'winding',token);
    },
    async playBell() {
      if(window.InvitationStudySounds?.play&&(window.AudioContext||window.webkitAudioContext))return window.InvitationStudySounds.play('windchime');
      if (!bell) return false;
      // One shared sound channel: a fresh ring always replaces the previous one.
      // Keep background music and the record player completely independent.
      bell.pause();
      bell.src = cachedSource(bellSources[Math.floor(Math.random() * bellSources.length)]);
      bell.load();
      try { await bell.play(); return true; }
      catch { return false; } // A replaced pending play may reject with AbortError.
    },
    async toggleRecord() {
      if (sharedPlaylist) return setBackground(!enabled);
      if (!record || recordBroken) return;
      if (recordPlaying) { await stopRecord(); return; }
      await playRecord();
    },
    previousRecord() { return changeRecord(-1); },
    nextRecord() { return changeRecord(1); },
    breakRecord() {
      recordBroken = true;
      if (!sharedPlaylist) return stopRecord();
      ++request; enabled = false; resumeBackground = false;
      musicBoxResumeBackground=false;
      audio.pause(); record?.pause(); syncPlayback(); update();
      status.textContent = '唱片已损坏，无法继续播放音乐。';
    },
    leaveStudy() { mediaPause=null;studyRoomReady=false;retryAutoplay=false;retryMusicBox=false;window.InvitationStudySounds?.stop(); ++request; ++recordRequest; ++musicBoxRequest; musicBoxPhase='idle';musicBoxResumeBackground=false;enabled = false; record?.pause(); bell?.pause(); if (bell) bell.currentTime = 0; musicBox?.pause(); if (musicBox) musicBox.currentTime = 0; diceSound?.pause(); if (diceSound) diceSound.currentTime = 0; audio.pause();audio.muted=false; recordPlaying = false; resumeBackground = false; update(); syncPlayback(); notifyRecord(); }
  };
  if (!sharedPlaylist) {
    record?.addEventListener('ended', stopRecord);
    record?.addEventListener('error', () => { recordError = true; if (recordPlaying) stopRecord(); });
  }
  window.addEventListener('pagehide', () => window.InvitationAudio.leaveStudy());
  if (isStudy) {
    const primeBackground = () => {
      if(studyRoomReady||recordBroken)return;
      // Call play synchronously in the user's entry/retry click, then keep the
      // same media element silent and running until the room is revealed.
      audio.muted=true;
      try{audio.play().catch(()=>{});}catch{}
    };
    window.addEventListener('study-enter',primeBackground);
    document.querySelector('#scene-retry')?.addEventListener('click',primeBackground);
    window.addEventListener('study-room-enter',() => {
      if(studyRoomReady)return;
      studyRoomReady=true;audio.currentTime=0;audio.muted=false;
      window.InvitationAudio.startBackground();
    });
    window.addEventListener('study-room-failed',() => window.InvitationAudio.leaveStudy());
  }
  if (autoplay || isStudy) {
    // Browsers may require a gesture; a later deliberate pause must never be undone.
    const resumeAutoplay = event => {
      if ((!retryAutoplay&&!retryMusicBox) || (isStudy&&!studyRoomReady&&!readingInvitation) || event.target?.closest?.('#music-toggle')) return;
      if (event.type === 'keydown' && !['Enter',' ','ArrowDown','PageDown'].includes(event.key)) return;
      window.InvitationAudio.resumeAfterGesture();
    };
    document.addEventListener('click', resumeAutoplay, {capture:true});
    document.addEventListener('touchend', resumeAutoplay, {capture:true,passive:true});
    document.addEventListener('keydown', resumeAutoplay, {capture:true});
    document.addEventListener('WeixinJSBridgeReady',resumeAutoplay);
    if(autoplay)window.InvitationAudio.startBackground();
  }
  update();
})();
