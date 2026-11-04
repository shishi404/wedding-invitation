import * as THREE from 'three';
import {OrbitControls} from './vendor/three-addons/controls/OrbitControls.js';
import {applyTabletopMaterial} from './loft-table-lighting.js';
import {JewelryBoxController,setJewelryLockVisible} from './模型库/14_彩绘漆面首饰盒_Source/青蓝写实旧铜锁版_v7/jewelry-box-controller.js';
import {playKeyPickup} from './study-pickup.js';
import {applyNotebookPages} from './study-notebook.js';
import {notebookPageLabel} from './notebook-page-copy.js';
import {applyStickyNoteMessage,STICKY_NOTE_MESSAGE} from './study-sticky-note.js';
import {createWindchimeSway} from './study-windchime-sway.js';
import {createEnvelopeDetails,showInlineInvitation} from './study-envelope.js';

// Orbit the camera rather than tipping the object: heavy objects stay upright.
export const inspectionLimits=art=>({min:.06,max:art==='record'?Math.PI/2-.12:Math.PI-.06});

export function createInspection({getModel,mobile=false}){
  let renderer,scene,camera,controls,host,art,model,mixer,frame=0,timer=0,token=0,last=0;
  let materials=[];
  let boxClosedHold=null;
  let windchimeMotion=null;
  let envelopePlaying=false,envelopeCancel=null,envelopeAction=null;
  let envelopeDetails=null;
  let clipRoot,clips=[],jewelryController,busy=false,pendingShow=Promise.resolve(),bookPlaying=false,bookOpened=false;
  const isBox=value=>['drawer','drawer-open','drawer-empty'].includes(value);
  function resetView(){const distance=camera.position.length();camera.position.set(.3,.7,1).setLength(distance);controls.target.set(0,0,0);controls.update();fit();}
  const visible=()=>host?.isConnected&&host.closest('dialog')?.open&&!document.hidden;
  function stop(){cancelAnimationFrame(frame);clearTimeout(timer);frame=timer=0;}
  function request(){if(visible()&&renderer&&!frame)frame=requestAnimationFrame(render);}
  function init(){
    if(renderer)return;
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.25;
    scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff4e1,0x65706b,2));
    for(const [position,intensity] of [[[3,4,5],3],[[-3,1,-2],1.5]]){
      const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.fromArray(position);scene.add(light);
    }
    camera=new THREE.PerspectiveCamera(38,1,.01,100);
    const canvas=renderer.domElement;canvas.tabIndex=0;
    canvas.setAttribute('role','img');
    controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableZoom=false;
    controls.enableDamping=false;controls.rotateSpeed=.65;controls.addEventListener('change',request);
    canvas.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
      event.preventDefault();
      if(busy)return;
      if(event.key==='Home'){resetView();return;}
      const spherical=new THREE.Spherical().setFromVector3(camera.position);
      if(event.key==='ArrowLeft')spherical.theta-=.15;
      else if(event.key==='ArrowRight')spherical.theta+=.15;
      else spherical.phi+=event.key==='ArrowUp'?-.12:.12;
      spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.setFromSpherical(spherical);controls.update();request();
    });
  }
  function release(){
    envelopeDetails?.dispose();envelopeDetails=null;
    envelopeCancel?.();envelopeCancel=null;envelopePlaying=false;envelopeAction=null;
    if(boxClosedHold){boxClosedHold.resolve(false);boxClosedHold=null;}
    bookPlaying=bookOpened=false;
    windchimeMotion?.stop();windchimeMotion=null;
    jewelryController?.dispose();jewelryController=null;clipRoot=null;clips=[];
    mixer?.stopAllAction();if(mixer)mixer.uncacheRoot(mixer.getRoot());
    if(model)scene.remove(model);model=mixer=null;
    // Geometry and textures belong to the room; only viewer materials are owned here.
    materials.forEach(material=>material.dispose());materials=[];
  }
  function fit(){
    if(!visible()||!renderer)return;
    const bounds=host.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
    renderer.setSize(Math.round(bounds.width),Math.round(bounds.height),false);
    camera.aspect=bounds.width/bounds.height;
    const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
    const distance=1.65/Math.sin(Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect)));
    if(camera.position.length()<.1)camera.position.set(.3,.7,1);
    camera.position.setLength(distance);camera.near=.01;camera.far=distance+20;camera.updateProjectionMatrix();
    controls.minDistance=controls.maxDistance=distance;controls.update();request();
  }
  const resizeObserver=new ResizeObserver(fit);
  async function show(detail){
    const sequence=++token;
    if(!detail.host)return;
    const same=(art===detail.art||isBox(art)&&isBox(detail.art)||art==='envelope'&&detail.art==='invitation')&&model;
    resizeObserver.disconnect();host=detail.host;art=detail.art;
    host.classList.add('model-inspection');host.dataset.modelState='loading';
    host.setAttribute('aria-busy','true');
    try{
      // Paint the dialog before model cloning, material setup and shader work.
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      if(sequence!==token||!visible())return;
      init();host.replaceChildren(renderer.domElement);resizeObserver.observe(host);
      renderer.domElement.setAttribute('aria-label',art==='record'?'留声机模型。拖动或使用方向键查看上方与侧面，无法翻看底部。':'物品模型。拖动或使用方向键旋转调查，Home 键重置。');
      if(!same){
        release();renderer.clear();
        const result=await getModel(art);
        if(sequence!==token)return;
        if(!result?.object)throw Error('物品模型暂时不可用');
        model=new THREE.Group();const object=result.object;object.visible=true;clipRoot=object;clips=result.clips||[];
        if(art==='windchime')windchimeMotion=createWindchimeSway(object,{reducedMotion:()=>matchMedia('(prefers-reduced-motion:reduce)').matches});
        if(art==='note'){applyStickyNoteMessage(object);host.dataset.noteText=STICKY_NOTE_MESSAGE;}
        object.traverse(node=>{
          if(!node.isMesh)return;
          const original=Array.isArray(node.material)?node.material:[node.material];
          const cloned=original.map(material=>{const copy=material.clone();materials.push(copy);applyTabletopMaterial(copy,renderer,{enabled:true});return copy;});
          node.material=Array.isArray(node.material)?cloned:cloned[0];
        });
        const box=new THREE.Box3().setFromObject(object,art==='notebook-opening'||result.notebookOpen),size=box.getSize(new THREE.Vector3());
        // Reserve room for the raised lid without reframing halfway through opening.
        if(isBox(art)){
          const preview=new THREE.AnimationMixer(object);
          for(const name of ['Unlock','OpenLid']){
            const clip=clips.find(clip=>clip.name===name);if(!clip)continue;
            const action=preview.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();preview.update(clip.duration+.001);
          }
          box.union(new THREE.Box3().setFromObject(object));box.getSize(size);
          preview.stopAllAction();preview.uncacheRoot(object);
        }
        if(art==='notebook-opening'){
          const clip=clips.find(c=>c.name==='OpenBook');if(!clip)throw Error('缺少笔记打开动画');
          const preview=new THREE.AnimationMixer(object),action=preview.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
          for(let t=0;t<=clip.duration+.05;t+=.3){preview.setTime(Math.min(t,clip.duration));box.union(new THREE.Box3().setFromObject(object,true));}
          box.getSize(size);preview.stopAllAction();preview.uncacheRoot(object);
        }
        if(['envelope','invitation'].includes(art)){
          envelopeDetails=await createEnvelopeDetails(object,clips);
          if(sequence!==token)return;
          const preview=new THREE.AnimationMixer(object);
          for(const name of ['Seal_Remove','Flap_Open']){
            const clip=clips.find(c=>c.name===name);if(!clip)throw Error('缺少信封打开动画');
            const action=preview.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();preview.update(clip.duration+.001);
            box.union(new THREE.Box3().setFromObject(object));
          }
          box.getSize(size);preview.stopAllAction();preview.uncacheRoot(object);
          if(art==='invitation'){
            mixer=new THREE.AnimationMixer(object);
            for(const name of [detail.envelopeWithKnife?'Seal_Remove':'Seal_Split','Flap_Open']){const clip=clips.find(value=>value.name===name);const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.time=clip.duration;}
            mixer.update(0);
          }
        }
        const scale=2/Math.max(size.x,size.y,size.z);
        const center=box.getCenter(new THREE.Vector3());
        const centered=new THREE.Group();centered.add(object);centered.position.copy(center).negate();model.add(centered);model.scale.setScalar(scale);scene.add(model);
        const clip=art==='record'?result.clips?.find(clip=>clip.name==='RecordSpin'):null;
        if(clip){mixer=new THREE.AnimationMixer(object);mixer.clipAction(clip).play();}
        bookOpened=!!result.notebookOpen;
        host.dataset.notebookPages=notebookPageLabel(result.notebookResult);
        const limits=inspectionLimits(art);controls.minPolarAngle=limits.min;controls.maxPolarAngle=limits.max;
        controls.target.set(0,0,0);camera.position.set(.3,.7,1);controls.update();
      }
      if(isBox(art))host.dataset.lockVisible=String(clipRoot.getObjectByName('BrassLock_Root')?.visible!==false);
      host.dataset.modelState='ready';host.setAttribute('aria-busy','false');
      controls.enabled=!busy;host.dataset.inspectionBusy=String(busy);
      host.dataset.inspectionArt=art;fit();request();
      if(art==='invitation'){
        envelopeDetails?.setOpened(!!detail.envelopeWithKnife);
        host.dataset.animationPhase='envelope-open';host.dataset.envelopeOpenProgress='1';
        host.dataset.waxState=detail.envelopeWithKnife?'removed-intact':'split';host.dataset.letterState='visible';
      }
    }catch(error){
      if(sequence!==token)return;
      console.error('模型检视失败',error);host.dataset.modelState='error';host.setAttribute('aria-busy','false');
      host.textContent='模型暂时无法载入，仍可使用下方选项继续调查。';
    }
  }
  function render(now){
    frame=0;clearTimeout(timer);timer=0;if(!visible()||!renderer||!model)return;
    const dt=Math.min(Math.max(0,(now-last)/1000),.05);last=now;
    if(mixer&&art==='record'&&window.InvitationAudio?.recordPlaying)mixer.update(dt);
    if(mixer&&bookPlaying)mixer.update(dt);
    if(mixer&&envelopePlaying)mixer.update(dt);
    envelopeDetails?.update(dt);
    if(envelopeAction)host.dataset.envelopeOpenProgress=String(envelopeAction.time/envelopeAction.getClip().duration);
    windchimeMotion?.update(dt);
    jewelryController?.update(dt);
    if(boxClosedHold){boxClosedHold.remaining-=dt;if(boxClosedHold.remaining<=0){const done=boxClosedHold.resolve;boxClosedHold=null;done(true);}}
    const lidAction=jewelryController?.actions.OpenLid;
    if(lidAction)host.dataset.boxOpenProgress=String(lidAction.time/lidAction.getClip().duration);
    renderer.render(scene,camera);
    host.dataset.polarAngle=String(controls.getPolarAngle());
    if(boxClosedHold||jewelryController?.busy||bookPlaying||envelopePlaying||envelopeDetails?.active()||windchimeMotion?.active()||mixer&&art==='record'&&window.InvitationAudio?.recordPlaying)timer=setTimeout(request,1000/30);
  }
  async function openEnvelope({withKnife=false}={}){
    if(busy)return false;
    busy=true;if(controls)controls.enabled=false;
    const sequence=token;
    try{
      await pendingShow;
      if(sequence!==token||!visible()||art!=='envelope'||host.dataset.modelState!=='ready')throw Error('信封模型尚未就绪');
      await Promise.all(['envelope-open',...(withKnife?['wax']:[])].map(name=>window.InvitationStudySounds?.prepare(name)));
      if(sequence!==token||!visible())return false;
      mixer?.stopAllAction();mixer=new THREE.AnimationMixer(clipRoot);
      host.dataset.inspectionBusy='true';resetView();
      if(!withKnife){
        host.dataset.animationPhase='splitting-seal';host.dataset.waxState='splitting';last=performance.now();
        const split=envelopeDetails.splitSeal();request();if(!await split)return false;host.dataset.waxState='split';
      }
      for(const [name,phase,sound]of [...(withKnife?[['Seal_Remove','removing-seal','wax']]:[]),['Flap_Open','opening-envelope','envelope-open']]){
        const clip=clips.find(c=>c.name===name);if(!clip)throw Error('缺少信封打开动画');
        const action=mixer.clipAction(clip);envelopeAction=action;
        const finished=new Promise(resolve=>{
          const cleanup=result=>{mixer?.removeEventListener('finished',done);envelopeCancel=null;resolve(result);};
          const done=event=>{if(event.action===action)cleanup(true);};
          envelopeCancel=()=>cleanup(false);mixer.addEventListener('finished',done);
        });
        host.dataset.animationPhase=phase;
        action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
        envelopePlaying=true;last=performance.now();request();
        if(sound)window.InvitationStudySounds?.play(sound);
        if(!await finished||sequence!==token||!visible())return false;
        if(name==='Seal_Remove')host.dataset.waxState='removed-intact';
      }
      envelopePlaying=false;host.dataset.animationPhase='revealing-letter';
      const reveal=envelopeDetails.reveal();request();if(!await reveal)return false;
      host.dataset.letterState='visible';
      host.dataset.animationPhase='envelope-open';return true;
    }finally{
      envelopePlaying=false;busy=false;if(controls)controls.enabled=true;
      if(host)host.dataset.inspectionBusy='false';request();
    }
  }
  async function readInvitation(){
    if(busy)return false;busy=true;
    try{
      await pendingShow;
      if(!visible()||art!=='invitation'||!envelopeDetails)throw Error('请柬信纸尚未就绪');
      controls.enabled=false;resetView();host.dataset.inspectionBusy='true';host.dataset.animationPhase='extracting-letter';
      const extracted=envelopeDetails.extract();last=performance.now();request();if(!await extracted)return false;
      clipRoot.updateWorldMatrix(true,true);
      const paper=envelopeDetails.paper,center=new THREE.Vector3();paper.getWorldPosition(center);
      const corner=paper.localToWorld(new THREE.Vector3(.09,0,-.058));center.project(camera);corner.project(camera);
      const rect=renderer.domElement.getBoundingClientRect();
      const origin={x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2,width:Math.max(40,Math.abs(corner.x-center.x)*rect.width)};
      const dialog=host.closest('dialog');paper.visible=false;host.dataset.animationPhase='reading-invitation';
      try{return await envelopeDetails.foreground({dialog,origin});}finally{paper.visible=true;envelopeDetails?.setOpened(host.dataset.waxState==='removed-intact');}
    }finally{busy=false;if(controls)controls.enabled=true;if(host)host.dataset.inspectionBusy='false';request();}
  }
  async function shakeWindchime(){
    const sequence=token;await pendingShow;
    if(sequence!==token||art!=='windchime'||!visible()||host.dataset.modelState!=='ready'||!windchimeMotion)return false;
    windchimeMotion.trigger();last=performance.now();request();return true;
  }
  async function openNotebook({result='success'}={}){
    if(busy)return false;
    busy=true;if(controls)controls.enabled=false;
    try{
      await pendingShow;
      if(!visible()||!['notebook','notebook-opening'].includes(art))throw Error('笔记模型尚未就绪');
      if(art!=='notebook-opening'){await show({art:'notebook-opening',host});}
      if(host.dataset.modelState!=='ready')throw Error('笔记动画模型载入失败');
      if(bookOpened)return true;
      await Promise.all(['notebook-open',...(result==='fumble'?['notebook-tear']:[])].map(name=>window.InvitationStudySounds?.prepare(name)));
      materials.push(...applyNotebookPages(clipRoot,result));host.dataset.notebookPages=notebookPageLabel(result);
      host.dataset.inspectionBusy='true';host.dataset.animationPhase='opening-notebook';resetView();
      mixer=new THREE.AnimationMixer(clipRoot);const clip=clips.find(c=>c.name==='OpenBook'),action=mixer.clipAction(clip);
      const finished=new Promise(resolve=>{const done=e=>{if(e.action!==action)return;mixer.removeEventListener('finished',done);resolve(true);};mixer.addEventListener('finished',done);});
      action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();bookPlaying=true;last=performance.now();request();
      const sound=result==='fumble'?window.InvitationStudySounds?.playSequence(['notebook-open','notebook-tear']):window.InvitationStudySounds?.play('notebook-open');
      await finished;bookPlaying=false;bookOpened=true;
      if(result==='fumble')await sound;
      host.dataset.animationPhase='notebook-open';return true;
    }finally{busy=false;if(controls)controls.enabled=true;if(host)host.dataset.inspectionBusy='false';request();}
  }
  async function pickupKey(target){
    if(busy)return false;busy=true;controls.enabled=false;
    host.dataset.inspectionBusy='true';host.dataset.animationPhase='picking-up-key';
    try{return await playKeyPickup({getModel,dialog:host.closest('dialog'),target,mobile});}
    finally{busy=false;controls.enabled=true;host.dataset.inspectionBusy='false';request();}
  }
  async function openJewelryBox({withoutLock=false}={}){
    if(busy)return false;
    busy=true;if(controls)controls.enabled=false;
    try{
      await pendingShow;
      if(!visible()||!isBox(art)||!clipRoot)throw Error('首饰盒模型尚未就绪');
      await Promise.all([window.InvitationStudySounds?.prepare('unlock'),window.InvitationStudySounds?.prepare('box-open')]);
      host.dataset.inspectionBusy='true';resetView();
      jewelryController?.dispose();
      let lastSoundPhase='';
      jewelryController=new JewelryBoxController(clipRoot,clips,{canUseKey:()=>true,onChange:state=>{
        if(state.state!==lastSoundPhase){
          if(state.state==='unlocking')window.InvitationStudySounds?.play('unlock');
          if(state.state==='opening')window.InvitationStudySounds?.play('box-open');
          lastSoundPhase=state.state;
        }
        host.dataset.animationPhase=state.state;request();
      }});
      last=performance.now();
      if(withoutLock){
        setJewelryLockVisible(clipRoot,false);host.dataset.lockVisible='false';host.dataset.animationPhase='unlocked-closed';
        if(!await new Promise(resolve=>{boxClosedHold={remaining:.45,resolve};request();}))return false;
        jewelryController.state='unlocked';
      }else if(!await jewelryController.unlock(jewelryController.keyId))return false;
      return await jewelryController.attemptOpen();
    }finally{
      busy=false;if(controls)controls.enabled=true;
      if(host)host.dataset.inspectionBusy='false';request();
    }
  }
  async function shakeJewelryBox(){
    if(busy)return false;
    busy=true;if(controls)controls.enabled=false;
    try{
      await pendingShow;
      if(!visible()||!isBox(art)||!clipRoot)throw Error('首饰盒模型尚未就绪');
      host.dataset.inspectionBusy='true';resetView();jewelryController?.dispose();
      jewelryController=new JewelryBoxController(clipRoot,clips,{onChange:state=>{host.dataset.animationPhase=state.busy?'locked-shake':'locked';request();}});
      last=performance.now();
      return await jewelryController.run(()=>jewelryController.play('LockedShake'));
    }finally{busy=false;if(controls)controls.enabled=true;if(host)host.dataset.inspectionBusy='false';request();}
  }
  window.addEventListener('study-inspect',event=>{pendingShow=show(event.detail);});
  window.addEventListener('record-state',request);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else request();});
  new MutationObserver(()=>{
    if(!visible()){stop();if(host&&!host.closest('dialog')?.open){++token;release();art=null;}}
    else{fit();request();}
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  return {show,openJewelryBox,shakeJewelryBox,openNotebook,openEnvelope,readInvitation,showInvitation:()=>showInlineInvitation(host.closest('dialog')),pickupKey,shakeWindchime};
}
