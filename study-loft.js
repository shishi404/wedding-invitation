import * as THREE from 'three';
import {GLTFLoader} from './vendor/three-addons/loaders/GLTFLoader.js';
import {assetCatalog} from './loft-asset-profile.js';
import {createFireplace} from './loft-fireplace.js';
import {createDesk} from './loft-desk.js';
import {createFirewood} from './loft-firewood.js';
import {createHearthAsh} from './loft-hearth-ash.js';
import {createTableProps} from './loft-table-props.js';
import {applyRoomFinishes} from './loft-room-finishes.js';
import {createTableLighting,preserveRoomLighting} from './loft-table-lighting.js';
import {LOFT_INTERACTIONS,TAKEN_MODELS,canUseLoftObject} from './study-loft-mapping.js';
import {createInspection} from './study-inspection.js';
import {clone} from './vendor/three-addons/utils/SkeletonUtils.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.js';
import {notebookPageLabel} from './notebook-page-copy.js';
import {setJewelryLockVisible} from './模型库/14_彩绘漆面首饰盒_Source/青蓝写实旧铜锁版_v7/jewelry-box-controller.js';
import {inspectionAssetCatalog} from './loft-inspection-assets.js';
import {createMobileSceneView} from './study-mobile-view.js?v=object-tap-2';

const study=document.querySelector('#study'),world=document.querySelector('#world');
const loading=document.querySelector('#scene-loading'),loadingText=document.querySelector('#scene-loading-text'),retry=document.querySelector('#scene-retry');
const hint=document.querySelector('#scene-hint'),reset=document.querySelector('#scene-reset');
const hotspots=document.querySelector('#hotspots');
const geometryChoice=new URLSearchParams(location.search).get('geometry');
// Keep phones on lightweight assets in landscape as well as portrait.
const phone=matchMedia('(max-width:760px)').matches||matchMedia('(pointer:coarse) and (max-height:760px)').matches||navigator.userAgentData?.mobile===true;
const profile=['mobile','desktop'].includes(geometryChoice)?geometryChoice:phone?'mobile':'desktop';
const catalog=assetCatalog(profile),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let renderer,scene,camera,layout,desk,props,firewood,lighting,ready=false,booting=false;
let game={choice:null,drawerOpen:false,envelope:false},lastBoxOpen=null,lastEnvelope=null,lastLockBroken=null,lastChoice=undefined;
let request=0,timer=0,lastFrame=0,frames=0,drag=null,baseYaw=0,basePitch=0,yaw=0,pitch=0;
let poseChanged=false;
let mobileView=null;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const queue=[];let decoding=0;
function load(url){return new Promise((resolve,reject)=>{queue.push({url,resolve,reject});pump();});}
function pump(){while(decoding<2&&queue.length){const task=queue.shift();decoding++;loader.loadAsync(task.url).then(task.resolve,task.reject).finally(()=>{decoding--;pump();});}}
const inspectionAssets=new Map();
const inspectionIds={...Object.fromEntries(Object.entries(LOFT_INTERACTIONS).map(([id,art])=>[art,id])),'drawer-open':'painted-lacquer-jewelry-box','drawer-empty':'painted-lacquer-jewelry-box',envelope:'envelope',invitation:'envelope'};
const inspectionExtras=inspectionAssetCatalog(profile);
async function getInspectionModel(art){
  const id=inspectionIds[art];
  // The room's envelope holder omits its animation clips. Inspect the original animated asset.
  if(props&&id!=='envelope'){await props.ready;const model=props.inspectionModel(id);if(model){if(id==='painted-lacquer-jewelry-box')setJewelryLockVisible(model.object,!game.drawerLockBroken);return model;}}
  const url=inspectionExtras[art]||(id==='envelope'?catalog.envelope.url:catalog.tableProps.find(asset=>asset.id===id)?.url);
  if(!url)throw Error('缺少物品模型');
  if(!inspectionAssets.has(url))inspectionAssets.set(url,load(url).catch(error=>{inspectionAssets.delete(url);throw error;}));
  const gltf=await inspectionAssets.get(url);return {object:clone(gltf.scene),clips:gltf.animations};
}
window.InvitationInspection=createInspection({mobile:profile==='mobile',getModel:getInspectionModel});
let notebookSyncing=false,lastNotebookState='';
const modalOpen=()=>!!document.querySelector('dialog[open]');
function suspended(){return document.hidden||study.hidden;}
function stop(){clearTimeout(timer);timer=0;if(request)cancelAnimationFrame(request);request=0;}
function requestRender(){if(renderer&&!request&&!suspended())request=requestAnimationFrame(render);}
function activity(){if(suspended())stop();else requestRender();}
document.addEventListener('visibilitychange',activity);
new MutationObserver(activity).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden']});

function updateHint(){hint.textContent=game.noteRead?'与物品互动·寻找婚礼请柬':'与物品互动·便签上有字也许有线索';}
function syncGame(){
  updateHint();if(!props)return;
  if(lastChoice!==game.choice){props.setTaken(TAKEN_MODELS[game.choice]);lastChoice=game.choice;}
  if(lastBoxOpen!==game.drawerOpen||lastEnvelope!==game.envelope||lastLockBroken!==!!game.drawerLockBroken){props.setJewelryState({open:game.drawerOpen,envelopeVisible:!game.envelope,lockBroken:!!game.drawerLockBroken});lastBoxOpen=game.drawerOpen;lastEnvelope=game.envelope;lastLockBroken=!!game.drawerLockBroken;world.dataset.jewelryLock=game.drawerLockBroken?'hidden':'visible';}
  if(game.notebookOpen&&!notebookSyncing){
    const signature=game.notebookResult||'open';
    if(lastNotebookState!==signature){
      notebookSyncing=true;const targetProps=props;
      getInspectionModel('notebook-opening').then(model=>{
        if(props!==targetProps)return;
        if(props.setNotebookOpen({...model,result:signature})){
          lastNotebookState=signature;world.dataset.notebookState='open';world.dataset.notebookPages=notebookPageLabel(signature);
        }
      }).catch(error=>console.error('桌面笔记同步失败',error)).finally(()=>{notebookSyncing=false;requestRender();});
    }
  }
  requestRender();
}
window.addEventListener('study-state',event=>{game={...event.detail};syncGame();});
window.addEventListener('record-state',()=>{props?.setRecordPlaying(!!window.InvitationAudio?.recordPlaying);requestRender();});

function resize(){
  if(!renderer||!camera||!layout)return;
  const bounds=world.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
  const letterbox=profile==='mobile';
  const width=letterbox?Math.min(bounds.width,bounds.height*layout.aspect):bounds.width;
  const height=letterbox?width/layout.aspect:bounds.height;
  camera.aspect=width/height;
  camera.fov=letterbox?layout.fov:THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(layout.fov)/2)*Math.max(1,layout.aspect/camera.aspect)));
  camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,profile==='mobile'?1.5:2));
  renderer.setSize(Math.round(width),Math.round(height),false);
  renderer.domElement.style.width=width+'px';renderer.domElement.style.height=height+'px';
  world.dataset.letterbox=String(letterbox);
  world.style.setProperty('--scene-bar-y',(bounds.height-height)/2+'px');
  world.style.setProperty('--scene-bar-x',(bounds.width-width)/2+'px');
  mobileView?.resize(width,height);requestRender();
}
new ResizeObserver(resize).observe(world);
function applyLook(){
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch))));
  poseChanged=Math.abs(yaw-baseYaw)+Math.abs(pitch-basePitch)>.005;reset.hidden=!poseChanged;requestRender();
}
reset.onclick=()=>{if(mobileView){mobileView.reset();return;}yaw=baseYaw;pitch=basePitch;applyLook();};
function hit(event){
  const rect=renderer.domElement.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return null;
  pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  camera.updateMatrixWorld();scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);return props?.findHit(raycaster);
}
function installInput(canvas){
  let pendingTap=null;
  const blocked=()=>!ready||suspended()||modalOpen()||hotspots.inert;
  if(profile==='mobile'){
    reset.textContent='还原画面';
    mobileView=createMobileSceneView({surface:world,canvas,blocked,onTap:event=>{
      const id=hit(event);if(canUseLoftObject(id,game))window.dispatchEvent(new CustomEvent('study-object',{detail:LOFT_INTERACTIONS[id]}));
    },onChange:({zoom,width,height,settled})=>{
      reset.hidden=zoom<=1.001;
      const bounds=world.getBoundingClientRect();
      world.style.setProperty('--scene-bar-y',Math.max(0,(bounds.height-height*zoom)/2)+'px');
      world.style.setProperty('--scene-bar-x',Math.max(0,(bounds.width-width*zoom)/2)+'px');
      if(settled&&width&&height)renderer.setSize(Math.round(width*zoom),Math.round(height*zoom),false);
      requestRender();
    }});
    canvas.addEventListener('keydown',event=>mobileView.key(event));return;
  }
  canvas.addEventListener('pointerdown',event=>{
    pendingTap=null;
    if(event.button!==0||blocked())return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch,canLook:event.pointerType==='touch',moved:false};canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(blocked())return;
    if(drag?.id===event.pointerId){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>8)drag.moved=true;
      if(drag.moved&&drag.canLook){yaw=THREE.MathUtils.clamp(drag.yaw+dx*.003,baseYaw-.9,baseYaw+.9);pitch=THREE.MathUtils.clamp(drag.pitch+dy*.0025,basePitch-.3,basePitch+.2);applyLook();}
    }else if(event.pointerType==='mouse')canvas.style.cursor=canUseLoftObject(hit(event),game)?'pointer':'default';
  });
  canvas.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;const moved=drag.moved;drag=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(moved||blocked())return;
    pendingTap={x:event.clientX,y:event.clientY};
  });
  canvas.addEventListener('click',event=>{
    const tap=pendingTap;pendingTap=null;
    if(!tap||blocked()||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8)return;
    event.preventDefault();event.stopPropagation();
    const id=hit(event);if(canUseLoftObject(id,game))window.dispatchEvent(new CustomEvent('study-object',{detail:LOFT_INTERACTIONS[id]}));
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;pendingTap=null;});
  canvas.addEventListener('lostpointercapture',()=>{if(drag){drag=null;pendingTap=null;}});
  canvas.addEventListener('keydown',event=>{
    if(blocked())return;
    if(event.key==='ArrowLeft')yaw+=.12;else if(event.key==='ArrowRight')yaw-=.12;else if(event.key==='ArrowUp')pitch+=.08;else if(event.key==='ArrowDown')pitch-=.08;else if(event.key==='Home'){yaw=baseYaw;pitch=basePitch;}else return;
    event.preventDefault();yaw=THREE.MathUtils.clamp(yaw,baseYaw-.9,baseYaw+.9);pitch=THREE.MathUtils.clamp(pitch,basePitch-.3,basePitch+.2);applyLook();
  });
}
function render(now){
  request=0;clearTimeout(timer);timer=0;if(suspended()||!renderer)return;
  const dt=Math.min(Math.max(0,(now-lastFrame)/1000),.05);lastFrame=now;
  firewood?.update(now/1000);props?.update(dt);renderer.render(scene,camera);frames++;
  world.dataset.renderCount=frames;world.dataset.triangles=renderer.info.render.triangles;world.dataset.drawCalls=renderer.info.render.calls;
  if(ready&&(firewood?.flame.active()||props?.active()))timer=setTimeout(requestRender,Math.max(0,1000/30-(performance.now()-now)));
}
function repairBakedUV(root){root.traverse(object=>{
  if(!object.isMesh)return;const uv=object.geometry.attributes.uv,uv1=object.geometry.attributes.uv1;if(!uv||!uv1)return;
  let constant=true;for(let i=1;i<uv.count;i++)if(Math.abs(uv.getX(i)-uv.getX(0))>1e-7||Math.abs(uv.getY(i)-uv.getY(0))>1e-7){constant=false;break;}
  if(constant)object.geometry.setAttribute('uv',uv1.clone());
});}
function clearScene(){
  mobileView?.destroy();
  stop();if(scene)scene.traverse(object=>{object.geometry?.dispose();for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});
  renderer?.dispose();renderer?.domElement.remove();mobileView=null;renderer=null;props=null;desk=null;firewood=null;lighting=null;lastNotebookState='';lastChoice=undefined;lastBoxOpen=lastEnvelope=lastLockBroken=null;ready=false;
}
async function boot(){
  if(booting||ready)return;booting=true;loading.hidden=false;retry.hidden=true;loadingText.textContent='正在添加泥土…';window.InvitationTerminal?.begin();
  try{
    // Also gate retries, when the room module is already in memory.
    await window.InvitationTerminal?.intro();
    clearScene();layout=await fetch('./assets/study-loft-layout.json').then(response=>{if(!response.ok)throw Error('布局加载失败');return response.json();});
    // Download both complete tracks while the scene loads. Playback begins after entry.
    const roomAudio=Promise.all([window.InvitationAudio?.prepareBackground(),window.InvitationStudySounds?.prepareCampfire()]).then(()=>({ok:true}),error=>({error}));
    scene=new THREE.Scene();scene.background=new THREE.Color('#e3e2db');scene.add(new THREE.AmbientLight(0xffffff,.3));
    camera=new THREE.PerspectiveCamera(layout.fov,layout.aspect,.03,100);camera.position.fromArray(layout.position);camera.quaternion.fromArray(layout.quaternion);
    const direction=camera.getWorldDirection(new THREE.Vector3());baseYaw=yaw=Math.atan2(direction.x,direction.z);basePitch=pitch=Math.asin(direction.y);
    renderer=new THREE.WebGLRenderer({antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
    const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',profile==='mobile'?'三维房间。点击物品进行调查，双指缩放画面，左右滑动查看放大的区域，Home 键还原画面。':'三维房间。点击物品进行调查，使用方向键查看桌面，Home 键回到初始视角。');world.prepend(canvas);installInput(canvas);resize();
    world.dataset.sceneProfile=profile;world.dataset.clickMode='raycast / no highlights';
    const room=await load(catalog.roomModels.room.url);repairBakedUV(room.scene);scene.add(room.scene);
    await applyRoomFinishes(room.scene,{woodAsset:catalog.stairWood});preserveRoomLighting(room.scene);requestRender();
    loadingText.textContent='正在铺设木墙…';window.InvitationTerminal?.progress(35);
    const furniture=await Promise.allSettled([load(catalog.roomModels.desk.url),load(catalog.roomModels.fireplace.url)]);
    if(furniture.some(result=>result.status==='rejected'))throw Error('家具加载失败');
    desk=createDesk(furniture[0].value.scene,scene,renderer,camera);desk.apply(layout.desk);desk.setSelected(false);desk.showSurface(false);
    const fireplace=createFireplace(furniture[1].value.scene,scene,renderer);fireplace.apply(layout.fireplace);preserveRoomLighting(fireplace.root);
    lighting=createTableLighting({desk,renderer});lighting.apply(layout.tableLighting||{});
    const savedProps=structuredClone(layout.tableProps);savedProps.interactions={jewelryBox:{open:false}};
    props=createTableProps({desk,scene,renderer,loader:{loadAsync:load},assets:catalog.tableProps,envelopeAsset:catalog.envelope,saved:savedProps,lighting,onChange(){
      if(!props)return;const progress=props.getProgress();
      const stages=['正在添加泥土…','正在铺设石块…','正在种植苔藓…','正在生长树木…','正在点亮烛火…','正在藏起宝藏…'];
      loadingText.textContent=stages[Math.min(stages.length-1,Math.floor(stages.length*progress.loaded/Math.max(1,progress.total)))];window.InvitationTerminal?.progress(45+40*progress.loaded/Math.max(1,progress.total));requestRender();
    }});props.setEditing(false);
    const scenery=await Promise.allSettled([
      load(catalog.roomModels.firewood.url).then(gltf=>{firewood=createFirewood(gltf.scene,fireplace,renderer);firewood.apply(layout.fireplace.firewood);firewood.flame.apply(layout.fireplace.firewood.effects.flame);preserveRoomLighting(firewood.root);}),
      load(catalog.hearthAsh.url).then(gltf=>{const ash=createHearthAsh(gltf.scene,fireplace,renderer);preserveRoomLighting(ash.root);}),
      props.ready,
    ]);
    if(scenery.some(result=>result.status==='rejected')||props.getProgress().failed)throw Error('部分场景物品加载失败');
    loadingText.textContent='正在唤醒篝火…';window.InvitationTerminal?.progress(90);
    const audioResult=await roomAudio;if(audioResult.error)throw audioResult.error;
    world.dataset.roomAudioReady='true';
    await window.InvitationTerminal?.complete();
    ready=true;loading.hidden=true;hotspots.classList.remove('scene-fallback');world.classList.add('ready');world.dataset.sceneLoaded='true';world.dataset.itemsLoaded=props.getProgress().loaded;
    world.dataset.layoutSource='assets/study-loft-layout.json';syncGame();props.setRecordPlaying(!!window.InvitationAudio?.recordPlaying);
    window.dispatchEvent(new Event('study-room-enter'));
    window.dispatchEvent(new Event('study-scene-ready'));requestRender();
  }catch(error){console.error('3D 房间载入失败',error);loadingText.textContent='房间暂时未能载入，请重试。';retry.hidden=false;window.InvitationTerminal?.fail();world.dataset.sceneLoaded='error';hotspots.classList.add('scene-fallback');window.dispatchEvent(new Event('study-room-failed'));}
  finally{booting=false;}
}
retry.onclick=()=>boot();
window.addEventListener('study-enter',boot);
window.dispatchEvent(new Event('study-scene-ready'));
updateHint();if(!study.hidden)boot();
