// Keep the gesture-unlocked music player alive while phones read the invitation.
(() => {
  if(location.protocol==='file:')return;
  const entry=document.querySelector('#entry-screen'),study=document.querySelector('#study');
  if(!entry||!study)return;
  let reader=null,previous=null;
  function open(url,push=true){
    if(reader)return;
    previous={entryHidden:entry.hidden,studyHidden:study.hidden,title:document.title};
    window.InvitationAudio.startInvitation();
    entry.hidden=true;study.hidden=true;
    reader=document.createElement('iframe');reader.id='invitation-reader-frame';reader.title='婚礼请柬';
    reader.style.cssText='position:fixed;inset:0;z-index:100;width:100%;height:100%;height:100dvh;border:0;background:#a8bfca';
    const frameURL=new URL(url);frameURL.searchParams.set('reader','1');reader.src=frameURL.href;
    reader.addEventListener('load',()=>{if(reader?.isConnected)document.title=reader.contentDocument?.title||previous.title;});
    document.body.append(reader);reader.focus();
    if(push)history.pushState({weddingInvitationReader:true},'',url);
  }
  function close(){
    if(!reader)return;
    reader.remove();reader=null;document.title=previous.title;
    entry.hidden=previous.entryHidden;study.hidden=previous.studyHidden;
    window.InvitationAudio.endInvitation();
    if(previous.studyHidden)window.InvitationAudio.leaveStudy();
    else window.dispatchEvent(new Event('study-room-enter'));
  }
  for(const link of document.querySelectorAll('.entry-invitation-button,#study-direct-invitation')){
    link.addEventListener('click',event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      if(!matchMedia('(max-width:760px), (pointer:coarse)').matches)return;
      event.preventDefault();event.stopImmediatePropagation();open(link.href);
    },true);
  }
  window.addEventListener('popstate',()=>{
    if(history.state?.weddingInvitationReader)open(location.href,false);
    else close();
  });
})();
