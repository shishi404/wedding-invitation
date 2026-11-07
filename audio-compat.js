// Select before assigning a source or starting a gesture-bound play().
// Fetching an Ogg file successfully does not mean the device can decode it.
(() => {
  'use strict';
  const probe=document.createElement('audio');
  const supportsVorbis=!!probe.canPlayType('audio/ogg; codecs="vorbis"');
  window.InvitationAudioSource=value=>typeof value==='string'&&!supportsVorbis&&/^assets\/(?!audio-compat\/).+\.ogg$/.test(value)
    ?value.replace(/^assets\//,'assets/audio-compat/').replace(/\.ogg$/,'.mp3'):value;
})();
