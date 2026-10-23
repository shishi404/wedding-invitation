// Image-layer scene adapter. Gameplay does not depend on how the room is drawn;
// a later 3D renderer can consume the same study-state / study-object events.
const world=document.querySelector('#world');
const artboard=document.querySelector('#scene-artboard');
const plate=document.querySelector('#scene-plate');
const openPlate=document.querySelector('#scene-open-plate');
plate.decode().then(()=>{world.classList.add('ready');artboard.classList.add('ready');}).catch(()=>{document.querySelector('#render-status').hidden=false;document.querySelector('#render-status').textContent='场景图片未能载入，仍可点击互动物品的位置继续调查。';});
window.addEventListener('study-state',event=>{
  const s=event.detail;artboard.classList.toggle('drawer-is-open',s.drawerOpen);
  const taken={strength:'musicbox',intelligence:'windchime',will:'pendant'}[s.choice];
  for(const button of document.querySelectorAll('[data-object]')){
    const name=button.dataset.object,owned=name===taken,locked=!s.choice&&name!=='note',outline=document.querySelector(`[data-outline="${name}"]`);
    button.hidden=owned;button.disabled=owned||locked;
    outline.toggleAttribute('hidden',owned||locked);
    if(owned||locked)outline.classList.remove('focused');
    document.querySelector(`[data-remove-object="${name}"]`)?.toggleAttribute('hidden',!owned);
  }
  document.querySelector('[data-outline="drawer"]').setAttribute('d',s.drawerOpen?'M397 665 L1137 665 L1197 767 L1178 916 L355 916 L340 769 Z':'M397 670 L1137 670 L1130 797 L406 797 Z');
  if(s.drawerOpen&&!openPlate.getAttribute('src'))openPlate.src='assets/study-source-open-v21.webp';
  for(const [name,collected]of [['notebook',s.key],['record',s.knife],['drawer',s.drawerOpen]])document.querySelector(`[data-outline="${name}"]`).classList.toggle('collected',!!collected);
});
document.querySelectorAll('[data-object]').forEach(button=>{
  const line=document.querySelector(`[data-outline="${button.dataset.object}"]`);
  for(const type of ['pointerenter','focus'])button.addEventListener(type,()=>{if(!button.hidden&&!button.disabled)line.classList.add('focused');});
  for(const type of ['pointerleave','blur'])button.addEventListener(type,()=>line.classList.remove('focused'));
  if(button.dataset.object==='windchime')button.addEventListener('pointerenter',event=>{
    if(!button.hidden&&!button.disabled&&event.pointerType!=='touch')window.InvitationAudio?.playBell();
  });
});
window.addEventListener('record-state',()=>document.body.classList.toggle('record-playing',!!window.InvitationAudio?.recordPlaying));
