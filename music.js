(() => {
  'use strict';
  const button = document.querySelector('#music-toggle');
  const label = document.querySelector('#music-toggle-label') || button;
  const disc = document.querySelector('#music-record-icon');
  const audio = document.querySelector('#background-music');
  const status = document.querySelector('#music-status');
  const config = window.invitationData || {};
  const isStudy = !!document.querySelector('#study');
  const source = isStudy ? (config.studyMusic || config.music) : config.music;
  const record = document.querySelector('#record-music');
  const bell = document.querySelector('#bell-sound');
  const diceSound = document.querySelector('#dice-sound');
  const diceSources = ['assets/dice1.ogg','assets/dice2.ogg'];
  if (diceSound) diceSound.volume = .65;
  const musicBox = document.querySelector('#musicbox-music');
  if (musicBox) { musicBox.src = 'assets/musicbox-sinners-blues.ogg'; musicBox.volume = .55; musicBox.loop = false; }
  const bellSources = ['assets/bell1.ogg','assets/bell2.ogg','assets/bell3.ogg','assets/bell4.ogg'];
  if (bell) bell.volume = .7;
  const recordSources = Array.isArray(config.recordPlaylist) ? config.recordPlaylist.filter(src => typeof src === 'string' && src.trim()) : [];
  if (!recordSources.length) recordSources.push(config.recordMusic || 'assets/record-waltz.wav');
  let recordIndex = 0;
  if (record) { record.src = recordSources[recordIndex]; record.volume = .48; }
  let recordPlaying = false, resumeBackground = false, recordError = false, recordRequest = 0;
  let recordBroken = false;
  let enabled = false;
  let request = 0;
  if (source) audio.src = source;
  audio.volume = .5;
  function update() {
    label.textContent = enabled ? (isStudy ? '暂停音乐' : '关闭音乐') : (isStudy && audio.currentTime > 0 ? '恢复音乐' : '播放音乐');
    button.setAttribute('aria-pressed', String(enabled));
  }
  function syncPlayback() {
    disc?.classList.toggle('is-playing', !audio.paused && !audio.ended && !audio.error && audio.readyState >= 3);
  }
  // Follow actual background playback, including interruptions by the turntable.
  for (const event of ['playing','play','pause','waiting','ended','emptied','error']) audio.addEventListener(event, syncPlayback);
  syncPlayback();
  async function setBackground(nextEnabled) {
    const current = ++request;
    enabled = nextEnabled;
    update();
    status.textContent = '';
    if (!enabled) { resumeBackground = false; audio.pause(); return; }
    if (recordPlaying) { resumeBackground = true; return; }
    if (!source) {
      status.textContent = '音乐尚未设置，当前仅预览音乐开关。';
      return;
    }
    try {
      await audio.play();
      if (!enabled || recordPlaying) audio.pause();
    } catch (error) {
      if (current !== request) return;
      enabled = false;
      update();
      status.textContent = '音乐暂时无法播放，请稍后重试。';
    }
  }
  button.addEventListener('click', () => setBackground(!enabled));
  audio.addEventListener('error', () => {
    if (!enabled) return;
    ++request;
    enabled = false;
    update();
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
    if (!record || recordBroken) return;
    recordIndex = (recordIndex + direction + recordSources.length) % recordSources.length;
    record.pause();
    record.src = recordSources[recordIndex];
    record.currentTime = 0;
    await playRecord();
  }
  window.InvitationAudio = {
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
      // Each winding starts one full play on a single, non-looping channel.
      musicBox.pause();
      musicBox.currentTime = 0;
      try { await musicBox.play(); return true; }
      catch { return false; }
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
      if (!record || recordBroken) return;
      if (recordPlaying) { await stopRecord(); return; }
      await playRecord();
    },
    previousRecord() { return changeRecord(-1); },
    nextRecord() { return changeRecord(1); },
    breakRecord() { recordBroken = true; return stopRecord(); },
    leaveStudy() { ++recordRequest; record?.pause(); bell?.pause(); if (bell) bell.currentTime = 0; musicBox?.pause(); if (musicBox) musicBox.currentTime = 0; diceSound?.pause(); if (diceSound) diceSound.currentTime = 0; audio.pause(); recordPlaying = false; resumeBackground = false; }
  };
  record?.addEventListener('ended', stopRecord);
  record?.addEventListener('error', () => { recordError = true; if (recordPlaying) stopRecord(); });
  window.addEventListener('pagehide', () => window.InvitationAudio.leaveStudy());
  update();
})();
