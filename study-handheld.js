import * as THREE from 'three';

export const HANDHELD_VIDEO='assets/handheld-memory.mp4';
export const HANDHELD_IMAGE='assets/handheld-logo.webp';

// One media element per viewer. Orbiting or changing the viewing distance never
// replaces its source, seeks it, or starts a second playback.
export function createHandheldMedia({requestRender}){
  const video=document.createElement('video');
  video.id='handheld-video';video.playsInline=true;
  // Keep a tiny composited element in the viewport. display:none/hidden can
  // leave Safari's WebGL video source without fresh decoded frames.
  video.style.cssText='position:fixed;left:50%;top:50%;width:1px;height:1px;opacity:.001;pointer-events:none';
  video.setAttribute('aria-hidden','true');video.tabIndex=-1;
  video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.defaultMuted=true;video.muted=true;video.setAttribute('muted','');
  video.autoplay=false;video.controls=false;video.disableRemotePlayback=true;
  video.setAttribute('x-webkit-airplay','deny');
  video.disablePictureInPicture=true;video.preload='none';video.loop=false;
  video.volume=0;document.body.append(video);
  let host=null,active=false,playRequested=false,resumeMusic=null,binding=null,prompt=null,generation=0,playAttempt=0,playWatchdog;
  let preparing=null,prepared=false,videoURL=null,preparedImage=null,screens=null;
  function visibleInspection(){
    if(!active||!host||document.hidden||host.isConnected===false)return false;
    const dialog=host.closest?.('dialog'),world=document.querySelector?.('#world');
    return (!dialog||dialog.open)&&(!world||world.dataset.sceneLoaded==='true');
  }
  const mayPlay=()=>playRequested&&visibleInspection();
  function silence(){video.muted=true;video.volume=0;video.pause();}
  function enforceBoundary(){if(!mayPlay()){playRequested=false;silence();}}
  async function prepare(){
    if(prepared)return;
    if(preparing)return preparing;
    video.dataset.preloadState='loading';
    preparing=Promise.allSettled([
      (async()=>{
        if(videoURL)return;
        const response=await fetch(HANDHELD_VIDEO,{signal:AbortSignal.timeout(60000)});
        if(!response.ok)throw Error('游戏机视频下载失败');
        const blob=await response.blob();if(!blob.size)throw Error('游戏机视频为空');
        if(videoURL)URL.revokeObjectURL(videoURL);
        videoURL=URL.createObjectURL(new Blob([blob],{type:'video/mp4'}));
        video.dataset.preloadBytes=String(blob.size);silence();
        // Initialize while the other room resources load. Never wait for decoder
        // events here: some iPhones still defer them until the item is clicked.
        video.src=videoURL;video.preload='auto';video.dataset.decoderState='loading';video.load();
      })(),
      (async()=>{
        if(preparedImage)return;
        const image=new Image();image.src=HANDHELD_IMAGE;await image.decode();
        if(!image.naturalWidth)throw Error('游戏机下屏图片载入失败');preparedImage=image;
      })(),
    ]).then(results=>{
      const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
      prepared=true;video.dataset.preloadState='ready';
    }).catch(error=>{
      preparing=null;video.dataset.preloadState='error';throw error;
    });
    return preparing;
  }
  function state(value){if(host)host.dataset.videoState=value;requestRender();}
  function removePrompt(){prompt?.remove();prompt=null;}
  function offerPlayback(){
    if(!visibleInspection()||video.ended)return;
    playRequested=false;clearTimeout(playWatchdog);silence();
    removePrompt();state('awaiting-gesture');prompt=document.createElement('button');
    prompt.type='button';prompt.className='handheld-play-prompt';prompt.textContent='点击播放视频';
    prompt.onclick=event=>{event.stopPropagation();if(video.error)video.load();play();};host.append(prompt);
  }
  async function play(){
    if(!visibleInspection()){playRequested=false;silence();return;}
    const current=generation,attempt=++playAttempt,startedAt=video.currentTime;
    clearTimeout(playWatchdog);removePrompt();
    playRequested=true;video.volume=.8;video.muted=false;
    // A play promise can remain pending, or Safari can pause just after the
    // first frame without rejecting it. Both need an explicit way to resume.
    playWatchdog=setTimeout(()=>{
      if(current===generation&&attempt===playAttempt&&active&&!document.hidden&&!video.ended&&(video.paused||video.currentTime<=startedAt))offerPlayback();
    },2500);
    try{
      await video.play();
      if(!mayPlay()){silence();return;}
      if(current===generation&&attempt===playAttempt&&video.paused)offerPlayback();
    }
    catch(error){
      if(current!==generation||attempt!==playAttempt||!active)return;
      if(error.name==='NotAllowedError'){
        clearTimeout(playWatchdog);offerPlayback();
      }else if(error.name!=='AbortError'){clearTimeout(playWatchdog);state('error');}
    }
  }
  // Keep late browser playback/resume events silent outside item inspection.
  video.addEventListener('play',enforceBoundary);
  video.addEventListener('playing',()=>{if(mayPlay()){removePrompt();state('playing');}else silence();});
  video.addEventListener('pause',()=>{if(visibleInspection()&&video.paused&&!video.ended)offerPlayback();});
  video.addEventListener('waiting',()=>{if(mayPlay())state('loading');else silence();});
  // iOS may ignore scripted volume changes; muted + pause are the boundary.
  video.addEventListener('volumechange',()=>{if(!mayPlay()&&!video.muted)silence();});
  video.addEventListener('loadedmetadata',enforceBoundary);
  video.addEventListener('timeupdate',enforceBoundary);
  video.addEventListener('ended',()=>{if(active)state('ended');});
  video.addEventListener('error',()=>{if(active)state('error');});
  video.addEventListener('loadeddata',()=>{video.dataset.decoderState='ready';if(active)requestRender();});
  video.addEventListener('seeked',()=>{if(active)requestRender();});
  function update(){
    // Some Safari versions stall requestVideoFrameCallback for texture-only
    // playback. The inspection's existing 30 fps loop also refreshes the map.
    if(binding&&video.readyState>=2)binding.texture.needsUpdate=true;
  }
  function unbind(){binding?.dispose();binding=null;}
  function end({restore=true}={}){
    active=false;playRequested=false;++generation;++playAttempt;clearTimeout(playWatchdog);silence();removePrompt();unbind();
    document.body.append(video);
    const previousMusic=resumeMusic;resumeMusic=null;host=null;if(restore)previousMusic?.();
  }
  function begin(target){
    end();active=true;++generation;host=target;
    // Keep Safari's video source in the modal's top layer rather than behind
    // an inert, occluded document while its frames feed the WebGL texture.
    target.closest?.('dialog')?.append(video);
    resumeMusic=window.InvitationAudio?.pauseForMedia();
    state('loading');
    if(!videoURL){
      const current=generation;
      // Completion is asynchronous and no longer belongs to the item click.
      // Wait for an explicit playback click rather than unmuting from a fetch.
      prepare().then(()=>{if(active&&current===generation)offerPlayback();}).catch(()=>{
        if(!active||current!==generation)return;
        state('error');prompt=document.createElement('button');prompt.type='button';prompt.className='handheld-play-prompt';prompt.textContent='重试加载视频';prompt.onclick=event=>{event.stopPropagation();begin(target);};host.append(prompt);
      });
      return;
    }
    attachVideo();
  }
  function attachVideo(){
    if(!active)return;
    // Reuse the preinitialized decoder; no source replacement on the first click.
    if(video.getAttribute('src')!==videoURL){video.src=videoURL;video.preload='auto';video.load();}
    else if(video.readyState>=1)video.currentTime=0;
    // This call remains inside the original item click, including on iOS.
    play();
  }
  function bind(root){
    unbind();
    const upper=root.getObjectByName('Screen_Upper'),lower=root.getObjectByName('Screen_Lower');
    if(!upper?.isMesh||!lower?.isMesh)throw Error('游戏机缺少独立屏幕');
    const originals=[upper.material,lower.material];
    // Keep the prewarmed screen textures/materials across inspections, including
    // the VideoTexture callback and the renderer's compiled video shader.
    if(!screens){
      const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;
      texture.flipY=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
      const black=new THREE.MeshBasicMaterial({color:0x080a0b,toneMapped:false});
      const videoMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#d7edfa';ctx.fillRect(0,0,640,480);
      const imageTexture=new THREE.CanvasTexture(canvas);imageTexture.colorSpace=THREE.SRGBColorSpace;imageTexture.flipY=false;
      const imageMaterial=new THREE.MeshBasicMaterial({map:imageTexture,toneMapped:false});
      screens={texture,black,videoMaterial,imageTexture,imageMaterial,ctx};
    }
    const {texture,black,videoMaterial,imageTexture,imageMaterial,ctx}=screens;
    upper.material=black;
    const geometry=upper.geometry.clone();geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new THREE.Vector3()),size=geometry.boundingBox.getSize(new THREE.Vector3());
    const surface=new THREE.Mesh(geometry,videoMaterial);surface.name='Handheld Video Surface';surface.raycast=()=>{};
    // The supplied video is 4:3; the physical upper LCD is 5:3. Preserve all
    // of the video with narrow side bars instead of stretching or cropping it.
    function fitVideo(){
      const ratio=video.videoWidth&&video.videoHeight?video.videoWidth/video.videoHeight:660/494;
      // These glTF LCD planes lie in local X/Z, with their front normal +Y.
      const sx=Math.min(1,ratio/(size.x/size.z)),sy=Math.min(1,(size.x/size.z)/ratio);
      surface.scale.set(sx,1,sy);surface.position.set(center.x*(1-sx),.00004,center.z*(1-sy));
      requestRender();
    }
    upper.add(surface);fitVideo();video.addEventListener('loadedmetadata',fitVideo);
    lower.material=imageMaterial;
    let disposed=false;
    const image=preparedImage||new Image();const drawImage=()=>{
      if(disposed)return;
      const scale=Math.min(640/image.width,480/image.height),w=image.width*scale,h=image.height*scale;
      ctx.drawImage(image,(640-w)/2,(480-h)/2,w,h);imageTexture.needsUpdate=true;
      if(host)host.dataset.lowerScreenState='ready';requestRender();
    };
    if(preparedImage)drawImage();
    else{image.onload=drawImage;image.onerror=()=>{if(!disposed&&host)host.dataset.lowerScreenState='error';};image.src=HANDHELD_IMAGE;}
    binding={upper,texture,dispose(){
      disposed=true;image.onload=image.onerror=null;video.removeEventListener('loadedmetadata',fitVideo);
      upper.remove(surface);upper.material=originals[0];lower.material=originals[1];
      geometry.dispose();
    }};
    // The inspection canvas may replace host children after a blocked play().
    if(prompt&&host)host.append(prompt);
  }
  function suspendPlayback(){playRequested=false;++playAttempt;clearTimeout(playWatchdog);silence();}
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)suspendPlayback();else {enforceBoundary();if(active)offerPlayback();}});
  // Bridge readiness may unlock music, but must never authorize the 3DS video.
  document.addEventListener?.('WeixinJSBridgeReady',enforceBoundary);
  window.addEventListener('pageshow',()=>{enforceBoundary();if(active)offerPlayback();});
  window.addEventListener('pagehide',event=>{
    suspendPlayback();
    if(!event.persisted){end({restore:false});if(videoURL)URL.revokeObjectURL(videoURL);if(screens)for(const key of ['texture','black','videoMaterial','imageTexture','imageMaterial'])screens[key].dispose();}
  });
  window.addEventListener('study-enter',end);
  window.addEventListener('study-room-failed',end);
  return {prepare,begin,bind,end,update,get video(){return video;},get active(){return active;},get playing(){return active&&!video.paused&&!video.ended;}};
}
