// WeChat/iOS file downloads do not save to Photos. Keep an actual JPEG image
// in the page so the native long-press image menu can save the complete poster.
(() => {
  const albumURL=new URL('assets/wedding-invitation-album.jpg',document.baseURI).href;
  const mobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||matchMedia('(pointer:coarse), (max-width:760px)').matches;
  let viewer=null;
  function prepare(link){
    if(!mobile())return;
    link.removeAttribute('download');link.href=albumURL;
    link.setAttribute('aria-label','保存请柬到相册');link.title='保存请柬到相册';
    link.setAttribute('aria-haspopup','dialog');
  }
  function prepareTree(node){
    if(node.nodeType!==1)return;
    if(node.matches('.invitation-download'))prepare(node);
    node.querySelectorAll('.invitation-download').forEach(prepare);
  }
  document.querySelectorAll('.invitation-download').forEach(prepare);
  new MutationObserver(records=>{for(const record of records)record.addedNodes.forEach(prepareTree);}).observe(document.body,{childList:true,subtree:true});
  function open(trigger){
    if(viewer?.open)return;
    const dialog=document.createElement('dialog');viewer=dialog;
    dialog.className='invitation-save-dialog';dialog.setAttribute('aria-labelledby','invitation-save-title');
    dialog.innerHTML='<header class="invitation-save-header"><div><h2 id="invitation-save-title">保存请柬到相册</h2><p>长按图片，选择“保存图片”</p></div><button type="button" class="invitation-save-close" aria-label="关闭保存窗口">关闭</button></header><p class="invitation-save-status" role="status">正在加载完整长图…</p><div class="invitation-save-scroll" tabindex="0" aria-label="可长按保存的完整请柬长图"><img class="invitation-save-image" width="1080" height="8238" alt="陈萌与叶倩芸的完整婚礼请柬长图，长按图片保存到相册"><button type="button" class="invitation-save-retry" hidden>重新加载图片</button></div>';
    const image=dialog.querySelector('img'),status=dialog.querySelector('.invitation-save-status'),retry=dialog.querySelector('.invitation-save-retry');
    function load(){
      dialog.dataset.imageState='loading';image.hidden=false;retry.hidden=true;status.hidden=false;
      status.textContent='正在加载完整长图…';image.src=albumURL;
    }
    image.onload=()=>{dialog.dataset.imageState='ready';status.hidden=true;};
    image.onerror=()=>{dialog.dataset.imageState='error';image.hidden=true;retry.hidden=false;status.hidden=false;status.textContent='图片暂时没有加载成功，请重试。';};
    retry.onclick=load;
    const close=()=>dialog.close();
    dialog.querySelector('.invitation-save-close').onclick=close;
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('close',()=>{
      image.onload=image.onerror=null;dialog.remove();
      if(viewer===dialog){
        viewer=null;document.documentElement.classList.remove('invitation-save-open');
        if(trigger.isConnected)trigger.focus({preventScroll:true});
      }
    },{once:true});
    document.body.append(dialog);document.documentElement.classList.add('invitation-save-open');
    dialog.showModal();load();
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('.invitation-download');
    if(!link||!mobile()||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();event.stopPropagation();prepare(link);open(link);
  });
})();
