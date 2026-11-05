import * as THREE from 'three';

export const HANDHELD_VIDEO='assets/handheld-memory.mp4';
export const HANDHELD_IMAGE='assets/handheld-logo.webp';

// One media element per viewer. Orbiting or changing the viewing distance never
// replaces its source, seeks it, or starts a second playback.
export function createHandheldMedia({requestRender}){
  const video=document.createElement('video');
  video.id='handheld-video';video.hidden=true;video.playsInline=true;
  video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.disablePictureInPicture=true;video.preload='none';video.loop=false;
  video.volume=.8;document.body.append(video);
  let host=null,active=false,resumeMusic=null,binding=null,prompt=null,generation=0;
  let preparing=null,prepared=false,videoURL=null,preparedImage=null;
  async function prepare(){
    if(prepared)return;
    if(preparing)return preparing;
    video.dataset.preloadState='loading';
    preparing=Promise.allSettled([
      (async()=>{
        if(videoURL&&video.readyState>=2)return;
        const response=await fetch(HANDHELD_VIDEO,{signal:AbortSignal.timeout(60000)});
        if(!response.ok)throw Error('游戏机视频下载失败');
        const blob=await response.blob();if(!blob.size)throw Error('游戏机视频为空');
        if(videoURL)URL.revokeObjectURL(videoURL);
        videoURL=URL.createObjectURL(new Blob([blob],{type:'video/mp4'}));
        video.dataset.preloadBytes=String(blob.size);video.muted=true;video.preload='auto';
        try{
          await new Promise((resolve,reject)=>{
            let settled=false;
            const done=error=>{
              if(settled)return;settled=true;
              clearTimeout(timeout);for(const type of ['loadeddata','canplay','loadedmetadata'])video.removeEventListener(type,ready);
              video.removeEventListener('error',failed);video.pause();error?reject(error):resolve();
            };
            const ready=()=>{if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&Number.isFinite(video.duration)&&video.duration>0)done();};
            const failed=()=>done(Error('游戏机视频无法解码'));
            const timeout=setTimeout(()=>done(Error('游戏机视频载入超时')),60000);
            for(const type of ['loadeddata','canplay','loadedmetadata'])video.addEventListener(type,ready);
            video.addEventListener('error',failed);video.src=videoURL;video.load();
            // Muted priming lets iOS decode a first frame without consuming the
            // audible, one-shot playback reserved for the item interaction.
            video.play().catch(error=>{if(!['AbortError','NotAllowedError'].includes(error.name))failed();});
            ready();
          });
          video.currentTime=0;
        }finally{video.pause();video.muted=false;}
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
  async function play(){
    const current=generation;
    removePrompt();
    try{await video.play();}
    catch(error){
      if(current!==generation||!active)return;
      if(error.name==='NotAllowedError'){
        state('awaiting-gesture');prompt=document.createElement('button');
        prompt.type='button';prompt.className='handheld-play-prompt';prompt.textContent='点击播放视频';
        prompt.onclick=event=>{event.stopPropagation();play();};host.append(prompt);
      }else if(error.name!=='AbortError')state('error');
    }
  }
  video.addEventListener('playing',()=>{if(active)state('playing');});
  video.addEventListener('ended',()=>{if(active)state('ended');});
  video.addEventListener('error',()=>{if(active)state('error');});
  function unbind(){binding?.dispose();binding=null;}
  function end(){
    if(!active)return;
    active=false;++generation;video.pause();removePrompt();unbind();
    const restore=resumeMusic;resumeMusic=null;host=null;restore?.();
  }
  function begin(target){
    end();active=true;++generation;host=target;
    resumeMusic=window.InvitationAudio?.pauseForMedia();
    video.currentTime=0;state('loading');
    // This call remains inside the original item click, including on iOS.
    play();
  }
  function bind(root){
    unbind();
    const upper=root.getObjectByName('Screen_Upper'),lower=root.getObjectByName('Screen_Lower');
    if(!upper?.isMesh||!lower?.isMesh)throw Error('游戏机缺少独立屏幕');
    const originals=[upper.material,lower.material];
    const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;
    texture.flipY=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
    const black=new THREE.MeshBasicMaterial({color:0x080a0b,toneMapped:false});
    const videoMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
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
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#d7edfa';ctx.fillRect(0,0,640,480);
    const imageTexture=new THREE.CanvasTexture(canvas);imageTexture.colorSpace=THREE.SRGBColorSpace;imageTexture.flipY=false;
    const imageMaterial=new THREE.MeshBasicMaterial({map:imageTexture,toneMapped:false});lower.material=imageMaterial;
    let disposed=false;
    const image=preparedImage||new Image();const drawImage=()=>{
      if(disposed)return;
      const scale=Math.min(640/image.width,480/image.height),w=image.width*scale,h=image.height*scale;
      ctx.drawImage(image,(640-w)/2,(480-h)/2,w,h);imageTexture.needsUpdate=true;
      if(host)host.dataset.lowerScreenState='ready';requestRender();
    };
    if(preparedImage)drawImage();
    else{image.onload=drawImage;image.onerror=()=>{if(!disposed&&host)host.dataset.lowerScreenState='error';};image.src=HANDHELD_IMAGE;}
    binding={upper,dispose(){
      disposed=true;image.onload=image.onerror=null;video.removeEventListener('loadedmetadata',fitVideo);
      upper.remove(surface);upper.material=originals[0];lower.material=originals[1];
      geometry.dispose();black.dispose();videoMaterial.dispose();texture.dispose();imageMaterial.dispose();imageTexture.dispose();
    }};
  }
  window.addEventListener('pagehide',event=>{end();if(!event.persisted&&videoURL)URL.revokeObjectURL(videoURL);});
  return {prepare,begin,bind,end,get video(){return video;},get active(){return active;},get playing(){return active&&!video.paused&&!video.ended;}};
}
