(() => {
  'use strict';
  const button = document.querySelector('#music-toggle');
  const label = document.querySelector('#music-toggle-label') || button;
  const disc = document.querySelector('#music-record-icon');
  const audio = document.querySelector('#background-music');
  const status = document.querySelector('#music-status');
  const config = window.invitationData || {};
  const isStudy = !!document.querySelector('#study');
  const sharedPlaylist = isStudy || document.body?.dataset?.musicPlaylist === 'study';
  const autoplay = document.body?.hasAttribute?.('data-autoplay-music') || false;
  let retryAutoplay = false;
  const source = sharedPlaylist ? (config.studyMusic || config.music) : config.music;
  const record = document.querySelector('#record-music');
  const bell = document.querySelector('#bell-sound');
  const diceSound = document.querySelector('#dice-sound');
  const diceSources = ['assets/dice1.ogg','assets/dice2.ogg'];
  if (diceSound) diceSound.volume = .65;
  const musicBox = document.querySelector('#musicbox-music');
  const musicBoxWindingSource=config.musicBoxWinding||'assets/musicbox-winding.ogg';
  const musicBoxMusicSource=config.musicBoxMusic||'assets/musicbox-nop.ogg';
  if (musicBox) { musicBox.src = musicBoxWindingSource; musicBox.volume = .7; musicBox.loop = false; }
  let musicBoxPhase='idle',musicBoxResumeBackground=false,musicBoxRequest=0;
  const bellSources = Array.from({length:12},(_,i)=>`assets/windchime-${String(i+1).padStart(2,'0')}.ogg`);
  if (bell) bell.volume = .7;
  const recordSources = Array.isArray(config.recordPlaylist) ? config.recordPlaylist.filter(src => typeof src === 'string' && src.trim()) : [];
  if (!recordSources.length) recordSources.push(config.recordMusic || 'assets/record-waltz.wav');
  // In the study, the background track is the first record on one shared channel.
  if (sharedPlaylist && source) recordSources.splice(0, recordSources.length, ...new Set([source, ...recordSources]));
  let recordIndex = 0;
  if (record && !sharedPlaylist) { record.src = recordSources[recordIndex]; record.volume = .48; }
  let recordPlaying = false, resumeBackground = false, recordError = false, recordRequest = 0;
  let recordBroken = false;
  let enabled = false;
  let request = 0;
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
      const blob=await response.blob();
      const objectURL=URL.createObjectURL(blob);
      preparedBackground={objectURL,url:objectURL+'#'+original.split('/').pop()};
      if(recordIndex===0)audio.src=preparedBackground.url;
    })().catch(error=>{backgroundPreparation=null;throw error;});
    return backgroundPreparation;
  }
  window.addEventListener('pagehide',()=>{if(preparedBackground)URL.revokeObjectURL(preparedBackground.objectURL);});
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
  for (const event of ['playing','play','pause','waiting','ended','emptied','error']) audio.addEventListener(event, syncPlayback);
  syncPlayback();
  async function setBackground(nextEnabled) {
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
      await audio.play();
      if (!enabled || musicBoxPhase!=='idle' || (sharedPlaylist ? recordBroken : recordPlaying)) audio.pause();
      syncPlayback();
    } catch (error) {
      if (current !== request) return;
      enabled = false;
      if (sharedPlaylist) recordError = true;
      update();
      syncPlayback();
      retryAutoplay = autoplay && error.name === 'NotAllowedError';
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
      audio.pause();
      audio.src = recordIndex===0&&preparedBackground?preparedBackground.url:recordSources[recordIndex];
      audio.currentTime = 0;
      await setBackground(true);
      return;
    }
    record.pause();
    record.src = recordSources[recordIndex];
    record.currentTime = 0;
    await playRecord();
  }
  async function finishMusicBox(error=false){
    const shouldResume=musicBoxResumeBackground&&!recordBroken;
    const completion=++musicBoxRequest;musicBoxPhase='idle';musicBoxResumeBackground=false;musicBox?.pause();
    if(shouldResume)await setBackground(true);
    else update();
    if(error&&completion===musicBoxRequest)status.textContent='八音盒暂时无法播放，请稍后重试。';
  }
  function cancelMusicBox(){
    ++musicBoxRequest;musicBoxPhase='idle';musicBoxResumeBackground=false;
    musicBox?.pause();if(musicBox)musicBox.currentTime=0;
  }
  async function playMusicBoxSource(src,phase,token){
    musicBoxPhase=phase;musicBox.pause();musicBox.src=src;musicBox.currentTime=0;musicBox.volume=phase==='winding'?.7:.55;musicBox.load();
    try{
      await musicBox.play();
      if(token!==musicBoxRequest){if(musicBoxPhase==='idle')musicBox.pause();return false;}
      return true;
    }catch{
      if(token===musicBoxRequest)await finishMusicBox(true);
      return false;
    }
  }
  musicBox?.addEventListener('ended',()=>{
    if(!musicBox.ended)return;
    if(musicBoxPhase==='winding')return playMusicBoxSource(musicBoxMusicSource,'music',musicBoxRequest);
    if(musicBoxPhase==='music')return finishMusicBox();
  });
  musicBox?.addEventListener('error',()=>{if(musicBoxPhase!=='idle')return finishMusicBox(true);});
  if(sharedPlaylist)audio.addEventListener('ended',()=>{
    if(audio.ended&&enabled&&!recordBroken&&musicBoxPhase==='idle')return changeRecord(1);
  });
  window.InvitationAudio = {
    prepareBackground,
    get recordPlaying() { return recordPlaying; },
    get recordError() { return recordError; },
    startBackground() { return enabled ? Promise.resolve() : setBackground(true); },
    async playDice() {
      if (!diceSound) return false;
      diceSound.pause();diceSound.currentTime = 0;
      diceSound.src = diceSources[Math.floor(Math.random() * diceSources.length)];
      diceSound.load();
      try { await diceSound.play(); return true; }
      catch { return false; }
    },
    async windMusicBox() {
      if (!musicBox) return false;
      if(musicBoxPhase==='idle')musicBoxResumeBackground=enabled&&!recordBroken;
      const token=++musicBoxRequest;++request;
      musicBoxPhase='winding';enabled=false;audio.pause();update();syncPlayback();status.textContent='';
      // Reuse one media element for both clips, including on mobile browsers.
      return playMusicBoxSource(musicBoxWindingSource,'winding',token);
    },
    async playBell() {
      if (!bell) return false;
      // One shared sound channel: a fresh ring always replaces the previous one.
      // Keep background music and the record player completely independent.
      bell.pause();
      bell.currentTime = 0;
      bell.src = bellSources[Math.floor(Math.random() * bellSources.length)];
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
    leaveStudy() { window.InvitationStudySounds?.stop(); ++request; ++recordRequest; ++musicBoxRequest; musicBoxPhase='idle';musicBoxResumeBackground=false;enabled = false; record?.pause(); bell?.pause(); if (bell) bell.currentTime = 0; musicBox?.pause(); if (musicBox) musicBox.currentTime = 0; diceSound?.pause(); if (diceSound) diceSound.currentTime = 0; audio.pause(); recordPlaying = false; resumeBackground = false; update(); syncPlayback(); notifyRecord(); }
  };
  if (!sharedPlaylist) {
    record?.addEventListener('ended', stopRecord);
    record?.addEventListener('error', () => { recordError = true; if (recordPlaying) stopRecord(); });
  }
  window.addEventListener('pagehide', () => window.InvitationAudio.leaveStudy());
  if (isStudy) window.addEventListener('study-room-enter', () => window.InvitationAudio.startBackground());
  if (autoplay) {
    // Browsers may require a gesture; a later deliberate pause must never be undone.
    const resumeAutoplay = event => {
      if (!retryAutoplay || event.target?.closest?.('#music-toggle')) return;
      if (event.type === 'keydown' && !['Enter',' ','ArrowDown','PageDown'].includes(event.key)) return;
      window.InvitationAudio.startBackground();
    };
    document.addEventListener('pointerdown', resumeAutoplay, {capture:true});
    document.addEventListener('keydown', resumeAutoplay, {capture:true});
    window.InvitationAudio.startBackground();
  }
  update();
})();
