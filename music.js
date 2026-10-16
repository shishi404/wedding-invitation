(() => {
  'use strict';
  const button = document.querySelector('#music-toggle');
  const audio = document.querySelector('#background-music');
  const status = document.querySelector('#music-status');
  const source = (window.invitationData || {}).music;
  let enabled = false;
  let request = 0;
  if (source) audio.src = source;
  audio.volume = .5;
  function update() {
    button.textContent = enabled ? '关闭音乐' : '播放音乐';
    button.setAttribute('aria-pressed', String(enabled));
  }
  button.addEventListener('click', async () => {
    const current = ++request;
    enabled = !enabled;
    update();
    status.textContent = '';
    if (!enabled) { audio.pause(); return; }
    if (!source) {
      status.textContent = '音乐尚未设置，当前仅预览音乐开关。';
      return;
    }
    try {
      await audio.play();
      if (!enabled) audio.pause();
    } catch (error) {
      if (current !== request) return;
      enabled = false;
      update();
      status.textContent = '音乐暂时无法播放，请稍后重试。';
    }
  });
  audio.addEventListener('error', () => {
    if (!enabled) return;
    ++request;
    enabled = false;
    update();
    status.textContent = '音乐暂时无法播放，请稍后重试。';
  });
})();
