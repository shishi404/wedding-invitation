// This classic script can explain startup failures even when modules cannot load.
(() => {
  const loadingText=document.querySelector('#scene-loading-text');
  const retry=document.querySelector('#scene-retry');
  function startupError(message,label,action){
    loadingText.textContent=message;retry.textContent=label;retry.hidden=false;retry.onclick=action;
  }
  if(location.protocol==='file:'){
    window.InvitationLocalPreviewRequired=true;
    const instructions='3D 书房需要本地预览服务。请先双击项目文件夹中的「启动书房预览.cmd」，浏览器会自动打开游戏。';
    document.querySelector('.entry-intro').textContent=instructions;
    document.querySelector('#start-exploration').textContent='查看本地预览打开方式';
    startupError(instructions,'打开已启动的本地预览',()=>{location.href='http://127.0.0.1:4175/';});
    return;
  }
  function loadRoomProgram(){
    const script=document.createElement('script');script.type='module';script.src=new URLSearchParams(location.search).has('bake-room')?'./study-loft.js?v=handheld-safari-3':'./study-static-room.js?v=static-picking-2';
    script.onerror=()=>startupError('房间程序未能载入，请刷新页面重试。若是本地预览，请重新运行「启动书房预览.cmd」。','重新载入页面',()=>location.reload());
    document.head.append(script);
  }
  // Download the first batch during typing; defer heavy modules and decoding.
  if(window.InvitationTerminal){
    window.addEventListener('study-enter',()=>{
      if(!new URLSearchParams(location.search).has('bake-room')){
        import('./static-room-downloads.js?v=static-picking-2').then(module=>module.preloadStaticRoom()).catch(()=>{});
        window.InvitationAudio?.prepareBackground().catch(()=>{});
        window.InvitationStudySounds?.prepareCampfire().catch(()=>{});
      }
      window.InvitationTerminal.intro().then(loadRoomProgram);
    },{once:true});
  }else loadRoomProgram();
})();
