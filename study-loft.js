import * as THREE from 'three';
import {GLTFLoader} from './vendor/three-addons/loaders/GLTFLoader.js';
import {assetCatalog} from './loft-asset-profile.js';
import {createFireplace} from './loft-fireplace.js';
import {createDesk} from './loft-desk.js';
import {createFirewood} from './loft-firewood.js';
import {createHearthAsh} from './loft-hearth-ash.js';
import {createTableProps} from './loft-table-props.js?v=mobile-shadows-6';
import {applyRoomFinishes} from './loft-room-finishes.js';
import {createTableLighting,preserveRoomLighting} from './loft-table-lighting.js';
import {LOFT_INTERACTIONS,TAKEN_MODELS,canUseLoftObject} from './study-loft-mapping.js';
import {createInspection} from './study-inspection.js?v=preload-10';
import {clone} from './vendor/three-addons/utils/SkeletonUtils.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.js';
import {notebookPageLabel} from './notebook-page-copy.js';
import {setJewelryLockVisible} from './模型库/14_彩绘漆面首饰盒_Source/青蓝写实旧铜锁版_v7/jewelry-box-controller.js';
import {inspectionAssetCatalog} from './loft-inspection-assets.js';
import {createMobileSceneView,mobileRenderSize,sceneNeedsZoom} from './study-mobile-view.js?v=full-table-8';

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
let sceneGesturing=false;
let mobileBaseFov=100;
let mobileMinimumZoom=1;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const queue=[];let decoding=0;
function load(url){return new Promise((resolve,reject)=>{queue.push({url,resolve,reject});pump();});}
function pump(){while(decoding<2&&queue.length){const task=queue.shift();decoding++;loader.loadAsync(task.url).then(gltf=>{
  gltf.scene.traverse(object=>{if(object.geometry&&!object.geometry.boundingBox)object.geometry.computeBoundingBox();});
  task.resolve(gltf);
},task.reject).finally(()=>{decoding--;pump();});}}
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
function suspended(){return document.hidden||study.hidden||sceneGesturing||modalOpen();}
function stop(){clearTimeout(timer);timer=0;if(request)cancelAnimationFrame(request);request=0;}
function requestRender(){if(renderer&&!request&&!suspended())request=requestAnimationFrame(render);}
function activity(){if(suspended())stop();else requestRender();}
document.addEventListener('visibilitychange',activity);
new MutationObserver(activity).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden']});

const needsZoom=()=>{const r=world.getBoundingClientRect();return sceneNeedsZoom(r.width,r.height);};
function updateHint(){
  const copy=game.noteRead?'与物品互动·寻找婚礼请柬':'与物品互动·便签上有字也许有线索';
  const controls=needsZoom()?(profile==='mobile'?'双指捏合查看全桌 · 张开放大后左右拖动':'滚轮缩放画面 · 放大后可左右拖动'):'';
  hint.textContent=copy+(controls?'\n'+controls:'');
  world.querySelector('canvas')?.setAttribute('aria-label','三维房间。点击物品进行调查。'+(controls?controls+'。Home 键还原画面。':''));
}
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
  const width=bounds.width,height=bounds.height;
  camera.aspect=width/height;
  const fitFov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(layout.fov)/2)*Math.max(1,layout.aspect/camera.aspect)));
  mobileBaseFov=Math.min(100,fitFov);
  // Keep the approved close initial composition, but allow pinching back to
  // the same complete horizontal field of view used on desktop.
  mobileMinimumZoom=Math.min(1,Math.tan(THREE.MathUtils.degToRad(mobileBaseFov)/2)/Math.tan(THREE.MathUtils.degToRad(fitFov)/2));
  camera.fov=profile==='mobile'?mobileBaseFov:fitFov;
  camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,profile==='mobile'?1.5:2));
  setSceneSize(width,height);
  renderer.domElement.style.width=width+'px';renderer.domElement.style.height=height+'px';
  world.dataset.letterbox='false';
  world.style.setProperty('--scene-bar-y',(bounds.height-height)/2+'px');
  world.style.setProperty('--scene-bar-x',(bounds.width-width)/2+'px');
  updateHint();mobileView?.resize(width,height);requestRender();
}
new ResizeObserver(resize).observe(world);
function setSceneSize(width,height,zoom=1){
  const size=profile==='mobile'?mobileRenderSize(width,height,Math.max(1,zoom),renderer.getPixelRatio()):{width:Math.round(width),height:Math.round(height)};
  const ratio=renderer.getPixelRatio(),canvas=renderer.domElement;
  if(canvas.width!==Math.floor(size.width*ratio)||canvas.height!==Math.floor(size.height*ratio))renderer.setSize(size.width,size.height,false);
}
function applyLook(){
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch))));
  poseChanged=Math.abs(yaw-baseYaw)+Math.abs(pitch-basePitch)>.005;reset.hidden=!poseChanged;requestRender();
}
reset.onclick=()=>{if(mobileView){mobileView.reset();yaw=baseYaw;pitch=basePitch;applyLook();return;}yaw=baseYaw;pitch=basePitch;applyLook();};
function hit(event){
  const rect=renderer.domElement.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return null;
  pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  camera.updateMatrixWorld();scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);return props?.findHit(raycaster);
}
function installInput(canvas){
  const blocked=()=>!ready||document.hidden||study.hidden||modalOpen()||hotspots.inert;
  reset.textContent='还原画面';
  mobileView=createMobileSceneView({surface:world,canvas,blocked,
    zoomLimit:3,zoomMinimum:()=>profile==='mobile'?mobileMinimumZoom:1,projected:profile==='mobile',zoomEnabled:needsZoom,
    framing:profile==='mobile'?bounds=>{
      const controls=document.querySelector('.scene-controls').getBoundingClientRect();
      const footer=document.querySelector('.study-footer').getBoundingClientRect();
      const bottom=Math.max(1,Math.min(controls.top,footer.top)-bounds.top-12);
      let anchor=.74;
      if(desk){
        const base=new THREE.PerspectiveCamera(mobileBaseFov,camera.aspect,.03,100);
        base.position.copy(camera.position);base.quaternion.copy(camera.quaternion);base.updateMatrixWorld();
        desk.surface.updateWorldMatrix(true,false);
        anchor=Math.max(...[-1,1].map(sign=>{
          const p=new THREE.Vector3(0,0,sign*desk.nativeSize.z/2).applyMatrix4(desk.surface.matrixWorld).project(base);
          return (1-p.y)/2;
        }));
      }
      return {bottom,anchor,initialZoom:bounds.height>bounds.width?1.4:1};
    }:null,
    onTap:event=>{
      const id=hit(event);if(canUseLoftObject(id,game))window.dispatchEvent(new CustomEvent('study-object',{detail:LOFT_INTERACTIONS[id]}));
    },onChange:({zoom,pan,offsetY,width,height,settled,gesturing})=>{
      sceneGesturing=gesturing&&profile!=='mobile';
      if(profile==='mobile'){
        camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(mobileBaseFov)/2)/zoom));
        camera.updateProjectionMatrix();
        camera.projectionMatrix.elements[8]=-2*pan/width;
        camera.projectionMatrix.elements[9]=2*offsetY/height;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
      const initial=Number(world.dataset.sceneInitialZoom)||1;
      reset.hidden=Math.abs(zoom-initial)<.001&&Math.abs(pan)<1;
      const bounds=world.getBoundingClientRect();
      world.style.setProperty('--scene-bar-top',Math.max(0,(bounds.height-height*zoom)/2+offsetY)+'px');
      world.style.setProperty('--scene-bar-bottom',Math.max(0,(bounds.height-height*zoom)/2-offsetY)+'px');
      world.style.setProperty('--scene-bar-x',Math.max(0,(bounds.width-width*zoom)/2)+'px');
      // Move the existing canvas during touch gestures, then redraw within the GPU budget.
      if(gesturing&&profile!=='mobile'){stop();return;}
      if(settled&&width&&height)setSceneSize(width,height,zoom);
      requestRender();
    }});
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerType==='mouse'&&!blocked())canvas.style.cursor=canUseLoftObject(hit(event),game)?'pointer':'default';
  });
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Home'&&!blocked()){event.preventDefault();reset.onclick();return;}
    if(profile==='mobile'||Number(world.dataset.sceneZoom)>1.001){mobileView.key(event);return;}
    if(blocked())return;
    if(event.key==='ArrowLeft')yaw+=.12;else if(event.key==='ArrowRight')yaw-=.12;else if(event.key==='ArrowUp')pitch+=.08;else if(event.key==='ArrowDown')pitch-=.08;else return;
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
  sceneGesturing=false;
  mobileView?.destroy();
  stop();if(scene)scene.traverse(object=>{object.geometry?.dispose();for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});
  renderer?.dispose();renderer?.domElement.remove();mobileView=null;renderer=null;props=null;desk=null;firewood=null;lighting=null;lastNotebookState='';lastChoice=undefined;lastBoxOpen=lastEnvelope=lastLockBroken=null;ready=false;
}
async function boot(){
  if(booting||ready)return;booting=true;hotspots.inert=true;delete world.dataset.handheldMediaReady;loading.hidden=false;retry.hidden=true;loadingText.textContent='正在添加泥土…';window.InvitationTerminal?.begin();
  try{
    // Also gate retries, when the room module is already in memory.
    await window.InvitationTerminal?.intro();
    clearScene();layout=await fetch('./assets/study-loft-layout.json').then(response=>{if(!response.ok)throw Error('布局加载失败');return response.json();});
    // Download both complete tracks while the scene loads. Playback begins after entry.
    const roomAudio=Promise.all([window.InvitationAudio?.prepareBackground(),window.InvitationStudySounds?.prepareCampfire(),window.InvitationStudySounds?.prepareEffects()]).then(()=>({ok:true}),error=>({error}));
    const handheldReady=window.InvitationInspection.prepareHandheld().then(()=>({ok:true}),error=>({error}));
    scene=new THREE.Scene();scene.background=new THREE.Color('#e3e2db');scene.add(new THREE.AmbientLight(0xffffff,.3));
    camera=new THREE.PerspectiveCamera(layout.fov,layout.aspect,.03,100);camera.position.fromArray(layout.position);camera.quaternion.fromArray(layout.quaternion);
    const direction=camera.getWorldDirection(new THREE.Vector3());baseYaw=yaw=Math.atan2(direction.x,direction.z);basePitch=pitch=Math.asin(direction.y);
    renderer=new THREE.WebGLRenderer({antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
    const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',profile==='mobile'?'三维房间。点击物品进行调查，双指缩放画面，左右滑动查看放大的区域，Home 键还原画面。':'三维房间。点击物品进行调查，滚轮缩放画面，放大后左右拖动，使用方向键查看桌面，Home 键还原画面。');world.prepend(canvas);installInput(canvas);resize();
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
    props=createTableProps({desk,scene,renderer,loader:{loadAsync:load},assets:catalog.tableProps,envelopeAsset:catalog.envelope,saved:savedProps,lighting,emphasizeShadows:profile==='mobile',onChange(){
      if(!props)return;const progress=props.getProgress();
      if(ready||!booting||!retry.hidden){requestRender();return;}
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
    loadingText.textContent='正在载入游戏机里的回忆…';window.InvitationTerminal?.progress(95);
    const handheldResult=await handheldReady;
    if(handheldResult.error)throw Object.assign(Error('游戏机视频暂未载入，请重试。'),{code:'HANDHELD_MEDIA',cause:handheldResult.error});
    world.dataset.handheldMediaReady='true';
    await window.InvitationTerminal?.complete();
    ready=true;loading.hidden=true;hotspots.inert=false;hotspots.classList.remove('scene-fallback');world.classList.add('ready');resize();world.dataset.sceneLoaded='true';world.dataset.itemsLoaded=props.getProgress().loaded;
    world.dataset.layoutSource='assets/study-loft-layout.json';syncGame();props.setRecordPlaying(!!window.InvitationAudio?.recordPlaying);
    window.dispatchEvent(new Event('study-room-enter'));
    window.dispatchEvent(new Event('study-scene-ready'));requestRender();
  }catch(error){console.error('3D 房间载入失败',error);loadingText.textContent=error.code==='HANDHELD_MEDIA'?error.message:'房间暂时未能载入，请重试。';retry.hidden=false;window.InvitationTerminal?.fail();world.dataset.sceneLoaded='error';hotspots.classList.add('scene-fallback');window.dispatchEvent(new Event('study-room-failed'));}
  finally{booting=false;}
}
retry.onclick=()=>boot();
window.addEventListener('study-enter',boot);
window.dispatchEvent(new Event('study-scene-ready'));
updateHint();if(!study.hidden)boot();
