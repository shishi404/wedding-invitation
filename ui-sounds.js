(() => {
  'use strict';
  const uiSources=['assets/ui-button-1.ogg','assets/ui-button-2.ogg'];
  const recordSource='assets/record-button.ogg';
  let channel;
  function play(src){
    if(!channel){channel=document.createElement('audio');channel.id='ui-click-sound';channel.preload='none';channel.volume=.65;document.body.append(channel);}
    channel.pause();channel.src=src;channel.currentTime=0;
    channel.play().catch(()=>{});
  }
  const ordinaryClick=()=>play(uiSources[Math.floor(Math.random()*uiSources.length)]);
  // Capture before action handlers rebuild dialogs or replace their buttons.
  document.addEventListener('click',event=>{
    const control=event.target?.closest?.('button,a[href],[role="button"],input[type="button"],input[type="submit"]');
    if(!control||control.disabled||control.getAttribute('aria-disabled')==='true'||control.closest('[inert]'))return;
    // The bell action owns its own random wind-chime channel.
    if(['bell','none'].includes(control.dataset.clickSound))return;
    if(control.classList.contains('record-music-control'))play(recordSource);
    else ordinaryClick();
  },true);
  window.addEventListener('study-object',ordinaryClick);
  window.addEventListener('pagehide',()=>channel?.pause());
})();
