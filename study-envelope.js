import {mountDandelionEnding} from './launch.js?v=dandelion-mist-blue-4';
import * as THREE from 'three';

// The folded letter, hollow pocket and both seal halves now come from the Blender v3 library.
function foldedPaper(template,unfoldClip){
  const group=template.clone(true),owned=[];
  // Inspection hides the original after extraction; its foreground copy must render independently.
  group.visible=true;group.position.set(0,0,0);group.rotation.set(0,0,0);group.scale.set(1,1,1);
  group.traverse(node=>{if(!node.isMesh)return;const clone=material=>{const copy=material.clone();owned.push(copy);return copy;};node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);});
  const mixer=new THREE.AnimationMixer(group),action=mixer.clipAction(unfoldClip);
  action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  return {group,width:group.userData.panelWidth||.186,height:group.userData.panelHeight||.115,
    unfold(t){action.enabled=true;action.paused=false;action.time=unfoldClip.duration*t;mixer.update(0);},
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(group);group.removeFromParent();owned.forEach(material=>material.dispose());}};
}

export async function createEnvelopeDetails(root,clips){
  const paper=root.getObjectByName('Invitation_Folded_Letter');
  if(!paper||root.getObjectByName('Envelope_Root')?.userData.envelopeVersion!==3)throw Error('需要米色中空信封 v3 模型');
  const mixer=new THREE.AnimationMixer(root);let pending=null;
  const clip=name=>{const result=clips.find(value=>value.name===name);if(!result)throw Error('缺少动画 '+name);return result;};
  mixer.addEventListener('finished',event=>{if(pending?.action===event.action){const resolve=pending.resolve;pending=null;resolve(true);}});
  function run(name){
    if(pending){pending.resolve(false);pending.action.stop();pending=null;}
    const action=mixer.clipAction(clip(name));action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    return new Promise(resolve=>{pending={action,resolve};});
  }
  return {
    paper,
    active:()=>!!pending,
    update(dt){if(pending)mixer.update(dt);},
    splitSeal:()=>run('Seal_Split'),
    setOpened(withKnife){
      mixer.existingAction(clip('Letter_Extract'))?.stop();paper.position.set(0,0,0);
      if(!withKnife){const action=mixer.clipAction(clip('Seal_Split'));action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.time=action.getClip().duration;mixer.update(0);}
    },
    // Opening the real flap exposes the seated paper through the V-shaped pocket mouth.
    reveal:()=>Promise.resolve(true),
    extract:()=>run('Letter_Extract'),
    foreground:({dialog,origin,onUnfolded})=>playLetterForeground({dialog,origin,onUnfolded,template:paper,unfoldClip:clip('Letter_Unfold')}),
    dispose(){pending?.resolve(false);pending=null;mixer.stopAllAction();mixer.uncacheRoot(root);}
  };
}

export async function showInlineInvitation(dialog,existingOverlay){
  const overlay=existingOverlay||document.createElement('div');
  if(!existingOverlay){overlay.className='letter-foreground';dialog.append(overlay);}
  const reader=document.createElement('section');reader.className='letter-reader';reader.hidden=true;
  reader.setAttribute('aria-label','婚礼请柬');
  const invitationImage=window.InvitationMediaSource?.('assets/wedding-invitation-mobile.webp')||'assets/wedding-invitation-mobile.webp';
  reader.innerHTML='<div class="letter-reader-sheet"><div class="letter-reader-toolbar"><button type="button" class="letter-reader-music record-toggle" aria-controls="background-music" aria-pressed="false"><span>播放音乐</span></button><a class="letter-reader-download invitation-download" href="assets/wedding-invitation-original.jpg" download="陈萌与叶倩芸的婚礼请柬.jpg" aria-label="下载请柬" title="下载请柬"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg></a></div><div class="letter-reader-scroll" role="region" aria-label="请柬内容，可上下滚动阅读" tabindex="0"><img class="letter-reader-image" src="'+invitationImage+'" width="826" height="6300" alt="陈萌（shishi）与叶倩芸（之南）的婚礼邀请函。2026年11月21日，深圳南山沙河高尔夫泷涎花园餐厅。包含婚礼日程、着装建议和新人合影。"></div></div>';
  const image=reader.querySelector('img');image.sizes='(max-width: 900px) 100vw, 900px';overlay.append(reader);
  try{await image.decode();}catch(error){reader.remove();if(!existingOverlay)overlay.remove();throw error;}
  if(!dialog.open){overlay.remove();return false;}
  const scroll=reader.querySelector('.letter-reader-scroll');
  reader.hidden=false;scroll.scrollTo({top:0,left:0,behavior:'instant'});
  overlay.dataset.phase='reading';overlay.setAttribute('aria-label','婚礼请柬阅读窗口');
  const disposeEnding=mountDandelionEnding(scroll);
  const originalMusic=document.querySelector('#music-toggle'),music=reader.querySelector('.letter-reader-music');
  const syncMusic=()=>{
    const label=document.querySelector('#music-toggle-label')?.textContent||'播放音乐';
    music.querySelector('span').textContent=label;music.title=label;
    music.disabled=!originalMusic||originalMusic.disabled;
    music.setAttribute('aria-pressed',originalMusic?.getAttribute('aria-pressed')||'false');
  };
  const observer=new MutationObserver(syncMusic);
  if(originalMusic)observer.observe(originalMusic,{attributes:true,childList:true,characterData:true,subtree:true});
  syncMusic();music.onclick=()=>window.InvitationAudio?.toggleRecord();
  const close=()=>{disposeEnding();observer.disconnect();dialog.removeEventListener('close',close);overlay.remove();if(dialog.open)dialog.querySelector('#interaction-actions button')?.focus({preventScroll:true});};
  dialog.addEventListener('close',close);
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  scroll.focus({preventScroll:true});
  return true;
}

async function playLetterForeground({dialog,origin,template,unfoldClip,onUnfolded}){
  const overlay=document.createElement('div');overlay.className='letter-foreground';overlay.dataset.phase='approach';overlay.setAttribute('aria-label','请柬信纸展开中');dialog.append(overlay);
  const paper=foldedPaper(template,unfoldClip),w=innerWidth,h=innerHeight;
  let renderer,animation,completed=false;
  const visibility=()=>{if(animation)(document.hidden?animation.pause():animation.play());};
  document.addEventListener('visibilitychange',visibility);
  const animate=(duration,update)=>new Promise((resolve,reject)=>{
    // Web Animations supplies a visibility-paused clock; the mesh renders only during this transition.
    animation=overlay.animate([{opacity:1},{opacity:1}],{duration,fill:'forwards'});
    let frame;
    function draw(){if(!dialog.open){animation.cancel();return;}const t=Math.min(1,(Number(animation.currentTime)||0)/duration);update(t*t*(3-2*t));renderer.render(scene,camera);if(t<1)frame=requestAnimationFrame(draw);}
    animation.finished.then(()=>{cancelAnimationFrame(frame);update(1);renderer.render(scene,camera);animation=null;resolve(true);},error=>{cancelAnimationFrame(frame);reject(error);});visibility();draw();
  });
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-w/2,w/2,h/2,-h/2,1,3000);camera.position.z=1000;
  scene.add(new THREE.HemisphereLight(0xffffff,0x789297,3));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(1,2,5);scene.add(light);
  const tilt=new THREE.Group(),orientation=new THREE.Group();orientation.rotation.x=Math.PI/2;orientation.add(paper.group);tilt.add(orientation);scene.add(tilt);
  // Enlarge once to the reading width, then keep that scale through unfolding.
  const cardWidth=Math.min(w,900),scale=cardWidth/paper.width;
  const unfoldedZ=paper.height*3-h/(2*scale);
  const gentle=matchMedia('(prefers-reduced-motion:reduce)').matches;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(w,h);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);overlay.append(renderer.domElement);
    const fromX=origin.x-w/2,fromY=h/2-origin.y,startScale=Math.max(20,origin.width)/paper.width;
    await animate(gentle?160:650,t=>{tilt.position.set(fromX*(1-t),fromY*(1-t),0);tilt.rotation.z=.12*(1-t);tilt.scale.setScalar(startScale+(scale-startScale)*t);paper.group.position.z=paper.height/2;});
    overlay.dataset.phase='unfold';
    await animate(gentle?180:1150,t=>{paper.unfold(t);paper.group.position.z=paper.height/2+(unfoldedZ-paper.height/2)*t;});
    overlay.dataset.phase='complete';await animate(gentle?100:600,()=>{});
    if(onUnfolded){await onUnfolded();return true;}
    if(!await showInlineInvitation(dialog,overlay))return false;
    completed=true;return true;
  }finally{
    document.removeEventListener('visibilitychange',visibility);animation?.cancel();
    renderer?.dispose();renderer?.domElement.remove();paper.dispose();
    if(!completed)overlay.remove();
  }
}

