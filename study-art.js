// Accessible controls mirror the game state. The 3D scene handles pointer hits.
window.addEventListener('study-state',event=>{
  const state=event.detail;
  const taken={strength:'musicbox',intelligence:'windchime',will:'pendant'}[state.choice];
  for(const button of document.querySelectorAll('[data-object]')){
    const owned=button.dataset.object===taken;
    button.hidden=owned;
    button.disabled=owned;
  }
});
window.addEventListener('record-state',()=>document.body.classList.toggle('record-playing',!!window.InvitationAudio?.recordPlaying));
