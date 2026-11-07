// Set false to restore the original loader for everyone; ?loading=legacy previews it.
(() => {
  'use strict';
  const ENABLE_TERMINAL = true;
  if (!ENABLE_TERMINAL || new URLSearchParams(location.search).get('loading') === 'legacy') return;
  const host = document.querySelector('#scene-loading');
  if (!host) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const copy = [
    '作为shishi和之南的好友或师长，同时也是一个优秀调查员的你',
    '可以动用你的智力、力量和意志来探索这个书房',
    'AUDENTES FORTUNA IUVAT',
  ];
  host.classList.add('terminal-loading');
  const screen = document.createElement('div');
  screen.className = 'terminal-screen';
  screen.innerHTML = '<div class="terminal-heading" aria-hidden="true"><span>TERMINAL</span><span>BOOT SEQUENCE / 001</span></div><div class="terminal-copy" aria-hidden="true"></div><div class="terminal-sweep" aria-hidden="true"></div><div class="terminal-footer" aria-hidden="true"><div>正在进入书房…</div><div class="terminal-progress-row"><div class="terminal-meter"><div class="terminal-fill"></div></div><span>LOADING</span><span class="terminal-percent">00%</span></div></div>';
  host.prepend(screen);
  const lines = copy.map(() => {
    const line = document.createElement('p');
    line.className = 'terminal-line';screen.querySelector('.terminal-copy').append(line);return line;
  });
  const accessibleCopy = document.createElement('span');
  accessibleCopy.className = 'sr-only';accessibleCopy.textContent = copy.join('。');host.append(accessibleCopy);
  const cursor = document.createElement('span');cursor.className = 'terminal-cursor';
  const fill = screen.querySelector('.terminal-fill'), percent = screen.querySelector('.terminal-percent');
  let running = false, timer = 0, progressTimer = 0, settle, settleProgress;
  let printed = Promise.resolve(), full = Promise.resolve(), amount = 0, target = 0, introReady = false, context;
  let characterOutput, toneCount = 0, lastToneAt = -1;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function stopSound() {
    if (!context) return;
    const old = context;context = null;characterOutput = null;
    old.close().catch(() => {});host.dataset.audio = 'stopped';
  }
  function startSound() {
    stopSound();
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();const ctx = context;
      toneCount = 0;lastToneAt = -1;
      characterOutput = ctx.createGain();characterOutput.gain.value = .16;
      const characterFilter = ctx.createBiquadFilter();characterFilter.type = 'lowpass';characterFilter.frequency.value = 3800;
      characterOutput.connect(characterFilter).connect(ctx.destination);
      const master = ctx.createGain();master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(.12, ctx.currentTime + .6);master.connect(ctx.destination);
      for (const [frequency, volume] of [[60,.4],[120,.12],[240,.025]]) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.frequency.setValueAtTime(frequency * .65, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency, ctx.currentTime + 1.1);
        gain.gain.value = volume;oscillator.connect(gain).connect(master);oscillator.start();
      }
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .12;
      const fan = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      fan.buffer = buffer;fan.loop = true;filter.type = 'lowpass';filter.frequency.value = 650;
      fan.connect(filter).connect(master);fan.start();
      ctx.resume().catch(() => {});host.dataset.audio = 'running';
    } catch { stopSound(); }
  }
  function characterSound(character) {
    if (!character || /\s/.test(character) || !running || document.hidden || context?.state !== 'running' || !characterOutput) return;
    // A soft electronic data pulse: a descending carrier with a short upper partial.
    // Schedule only for newly visible characters, never queue a burst after a model stall.
    const ctx = context, now = ctx.currentTime;
    if (now - lastToneAt < .025) return;
    lastToneAt = now;
    const frequency = [1480,1660,1560,1760,1600][toneCount++ % 5];
    for (const [ratio, level, duration, type] of [[1,.32,.034,'sine'],[1.9,.045,.018,'triangle']]) {
      const oscillator = ctx.createOscillator(), envelope = ctx.createGain();oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency * ratio, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * ratio * .72, now + duration);
      envelope.gain.setValueAtTime(0, now);envelope.gain.linearRampToValueAtTime(level, now + .002);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(envelope).connect(characterOutput);
      oscillator.onended = () => { oscillator.disconnect();envelope.disconnect(); };
      oscillator.start(now);oscillator.stop(now + duration + .003);
    }
    window.dispatchEvent(new CustomEvent('terminal-character-sound', {detail:{character,phase:host.dataset.phase}}));
  }
  function drawProgress() {
    fill.style.width = amount + '%';percent.textContent = String(amount).padStart(2, '0') + '%';
    if (introReady) {
      const previous = lines[2].textContent.length;
      const next = copy[2].slice(0, Math.floor(copy[2].length * amount / 100));
      lines[2].textContent = next;
      lines[2].append(cursor);
      if (next.length > previous) characterSound(next.slice(previous).trim().at(-1));
    }
  }
  function advanceProgress() {
    progressTimer = 0;
    if (!running || !introReady) return;
    amount = reduced ? target : Math.min(target, amount + 1);
    drawProgress();
    if (amount === 100) settleProgress();
    else if (amount < target) progressTimer = setTimeout(advanceProgress, 35);
  }
  function progress(value) {
    target = Math.max(target, Math.min(100, Math.round(value)));
    if (running && introReady && !progressTimer) advanceProgress();
  }
  function begin() {
    if (running) return;
    clearTimeout(timer);clearTimeout(progressTimer);settle?.();settleProgress?.();
    running = true;introReady = false;amount = target = 2;progressTimer = 0;
    host.dataset.phase = 'typing';host.classList.remove('terminal-depart');
    lines.forEach(line => line.replaceChildren());startSound();
    drawProgress();
    printed = new Promise(resolve => { settle = resolve; });
    full = new Promise(resolve => { settleProgress = resolve; });
    let row = 0, index = 0;
    function type() {
      if (!running) return;
      const line = lines[row];line.append(cursor);
      if (reduced) { line.textContent = copy[row];line.append(cursor);index = copy[row].length;characterSound(copy[row].at(-1)); }
      else if (index < copy[row].length) {
        const character = copy[row][index++];
        line.insertBefore(document.createTextNode(character), cursor);characterSound(character);
      }
      if (index === copy[row].length) {
        row++;index = 0;
        if (row === 2) {
          introReady = true;host.dataset.phase = 'waiting';
          drawProgress();advanceProgress();settle();return;
        }
        timer = setTimeout(type, reduced ? 0 : 380);
      } else timer = setTimeout(type, 48);
    }
    timer = setTimeout(type, reduced ? 0 : 300);
  }
  async function complete() {
    if (!running) return;
    progress(100);
    await printed;
    if (!running) return;
    await full;
    if (!running) return;
    host.dataset.phase = 'complete';
    await pause(reduced ? 0 : 850);
    host.classList.add('terminal-depart');
    await pause(reduced ? 0 : 300);
    running = false;stopSound();
  }
  function fail() {
    running = false;clearTimeout(timer);clearTimeout(progressTimer);progressTimer = 0;
    settle?.();settleProgress?.();cursor.remove();stopSound();host.dataset.phase = 'error';
  }
  // Let the last Chinese character and the third-line cursor paint before heavy work starts.
  const intro = () => printed.then(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  window.InvitationTerminal = { begin, intro, progress, complete, fail };
  // Start within the click gesture, including when the room module is still downloading.
  document.querySelector('#start-exploration')?.addEventListener('click', () => {
    if (document.querySelector('#entry-screen').hidden) return;
    begin();
    if (!document.querySelector('#scene-retry').hidden) fail();
  }, {capture:true});
  new MutationObserver(() => {
    if (!document.querySelector('#scene-retry').hidden) fail();
    if (host.hidden) stopSound();
  }).observe(host, {subtree:true, attributes:true, attributeFilter:['hidden']});
  document.addEventListener('visibilitychange', () => {
    if (context) (document.hidden ? context.suspend() : context.resume()).catch(() => {});
  });
  const resumeSound=event=>{
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    if(running&&!document.hidden&&context&&(context.state==='suspended'||context.state==='interrupted'))context.resume().catch(()=>{});
  };
  document.addEventListener('click',resumeSound,{capture:true});
  document.addEventListener('touchend',resumeSound,{capture:true,passive:true});
  document.addEventListener('keydown',resumeSound,{capture:true});
  window.addEventListener('pagehide', fail);
})();
