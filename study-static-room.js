import * as THREE from 'three';
import {GLTFLoader} from './vendor/three-addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.js';
import {clone} from './vendor/three-addons/utils/SkeletonUtils.js';
import {assetCatalog} from './loft-asset-profile.js';
import {inspectionAssetCatalog} from './loft-inspection-assets.js';
import {sceneAssetProfile} from './loft-startup-downloads.js';
import {preloadStaticRoom,downloadRoomFile,backgroundRoomDownloads} from './static-room-downloads.js?v=interaction-ready-20261107-4';
import {createPickingDecoder,pickStaticRoom,applyPickingPatches} from './static-room-picking.js';
import {createInspection} from './study-inspection.js?v=interaction-ready-20261107-4';
import {createFlame} from './loft-flame.js';
import {createWindchimeBreeze} from './loft-windchime-breeze.js';
import {createTableLighting,applyTabletopMaterial} from './loft-table-lighting.js';
import {createMobileSceneView} from './study-mobile-view.js';
import {LOFT_INTERACTIONS,TAKEN_MODELS,canUseLoftObject} from './study-loft-mapping.js';
import {createJewelryContents} from './loft-jewelry-contents.js';
import {setJewelryLockVisible} from './模型库/14_彩绘漆面首饰盒_Source/青蓝写实旧铜锁版_v7/jewelry-box-controller.js';
import {applyNotebookPages,setNotebookPose} from './study-notebook.js';
import {applyFramedPhoto} from './loft-artwork.js';
import {notebookPageLabel} from './notebook-page-copy.js';

const world=document.querySelector('#world'),study=document.querySelector('#study'),loading=document.querySelector('#scene-loading'),loadingText=document.querySelector('#scene-loading-text'),retry=document.querySelector('#scene-retry'),hotspots=document.querySelector('#hotspots'),reset=document.querySelector('#scene-reset');
const profile=sceneAssetProfile(),catalog=assetCatalog(profile),extras=inspectionAssetCatalog(profile),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),parsed=new Map();
const ids={...Object.fromEntries(Object.entries(LOFT_INTERACTIONS).map(([id,art])=>[art,id])),'drawer-open':'painted-lacquer-jewelry-box','drawer-empty':'painted-lacquer-jewelry-box',envelope:'envelope',invitation:'envelope'};
let game={},ready=false,booting=false,stage,renderer,scene,camera,windchime,breeze,flame,view,manifest,url,hitPixels,hitWidth=0,hitHeight=0,layerImages={},frame=0,timer=0,last=0,generation=0;
let baseHitPixels,decodeHit,pickingPatches={},pickingState='';
const inspectionURL=art=>extras[art]||(ids[art]==='envelope'?catalog.envelope.url:catalog.tableProps.find(a=>a.id===ids[art])?.url);
async function modelAt(value){
 const absolute=new URL(value,document.baseURI).href;
 if(!parsed.has(absolute))parsed.set(absolute,downloadRoomFile(absolute).then(data=>loader.parseAsync(data,new URL('.',absolute).href)).catch(e=>{parsed.delete(absolute);throw e;}));
 return parsed.get(absolute);
}
async function getInspectionModel(art){
 const id=ids[art],openBook=id==='alchemical-book'&&game.notebookOpen;
 const source=await modelAt(inspectionURL(openBook?'notebook-opening':art));
 const object=clone(source.scene),clips=source.animations;
 if(id==='square-wood-photo-frame')await applyFramedPhoto(object);
 if(id==='painted-lacquer-jewelry-box'){
  const envelope=await modelAt(catalog.envelope.url);
  const contents=createJewelryContents(object,clips,clone(envelope.scene),{saved:{open:game.drawerOpen,lockBroken:game.drawerLockBroken}});
  contents.holder.visible=!game.envelope;setJewelryLockVisible(object,!game.drawerLockBroken);
 }
 if(openBook){setNotebookPose(object,clips,true);applyNotebookPages(object,game.notebookResult);}
 return {object,clips,notebookOpen:!!openBook,notebookResult:game.notebookResult};
}
window.InvitationInspection=createInspection({mobile:profile==='mobile',getModel:getInspectionModel});
function stop(){cancelAnimationFrame(frame);clearTimeout(timer);frame=timer=0;}
const suspended=()=>!ready||document.hidden||study.hidden||!!document.querySelector('dialog[open]');
function request(){if(!frame&&!suspended())frame=requestAnimationFrame(render);}
function render(now){
 frame=0;clearTimeout(timer);timer=0;if(suspended())return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(windchime.visible)breeze?.update(dt);flame.update(now/1000);renderer.render(scene,camera);
 world.dataset.renderCount=String(Number(world.dataset.renderCount||0)+1);world.dataset.triangles=renderer.info.render.triangles;world.dataset.drawCalls=renderer.info.render.calls;
 timer=setTimeout(request,1000/30);
}
function activity(){if(suspended())stop();else request();}
document.addEventListener('visibilitychange',activity);new MutationObserver(activity).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden']});
const transformGroup=matrix=>{const group=new THREE.Group();group.matrix.fromArray(matrix);group.matrixAutoUpdate=false;return group;};
async function imageFor(value){
 const blob=new Blob([await downloadRoomFile(value)]),objectURL=URL.createObjectURL(blob),image=new Image();image.decoding='async';image.src=objectURL;
 try{await image.decode();}finally{URL.revokeObjectURL(objectURL);}return image;
}
function addLayer(image,rect={x:0,y:0,width:1,height:1}){
 image.draggable=false;image.alt='';image.className='static-room-image';Object.assign(image.style,{left:rect.x*100+'%',top:rect.y*100+'%',width:rect.width*100+'%',height:rect.height*100+'%'});stage.append(image);return image;
}
function sync(){
 if(!stage)return;
 const maskNames=[];
 const removal={strength:'without-musicbox',will:'without-pendant',intelligence:'without-windchime'}[game.choice];if(removal)maskNames.push(removal);
 if(game.notebookOpen)maskNames.push('notebook-open');if(game.drawerOpen)maskNames.push('box-open');
 const maskState=maskNames.join('|');if(baseHitPixels&&maskState!==pickingState){hitPixels=applyPickingPatches(baseHitPixels,hitWidth,hitHeight,maskNames.map(key=>pickingPatches[key]).filter(Boolean));pickingState=maskState;}
 const selected=new Set();if(game.choice==='strength')selected.add('without-musicbox');if(game.choice==='will')selected.add('without-pendant');
 if(game.notebookOpen)selected.add('notebook-'+(game.notebookResult||'success'));
 if(game.drawerOpen)selected.add((game.envelope?'box-empty':'box-open')+(game.drawerLockBroken?'-broken':''));else if(game.drawerLockBroken)selected.add('box-broken');
 for(const [key,image]of Object.entries(layerImages))image.hidden=!selected.has(key);
 if(windchime)windchime.visible=game.choice!=='intelligence';
 world.dataset.notebookState=game.notebookOpen?'open':'closed';world.dataset.notebookPages=notebookPageLabel(game.notebookResult);world.dataset.jewelryLock=game.drawerLockBroken?'hidden':'visible';world.dataset.boxState=game.drawerOpen?(game.envelope?'empty':'open'):'closed';
 document.querySelector('#scene-hint').textContent=(game.noteRead?'与物品互动·寻找婚礼请柬':'与物品互动·便签上有字也许有线索')+(world.clientWidth<world.clientHeight?'\n双指捏合查看全桌 · 张开放大后左右拖动':'');request();
}
window.addEventListener('study-state',e=>{game={...e.detail};sync();});
function hit(event){
 if(!hitPixels||!stage)return null;const r=stage.getBoundingClientRect();
 return pickStaticRoom({pixels:hitPixels,width:hitWidth,height:hitHeight,u:(event.clientX-r.left)/r.width,v:(event.clientY-r.top)/r.height,decode:decodeHit,regions:manifest.picking.regions,canUse:id=>canUseLoftObject(id,game),radius:Math.max(1,Math.min(12,Math.round(4*hitWidth/r.width)))});
}
function size(){
 if(!stage||!manifest)return;const bounds=world.getBoundingClientRect(),fit=(bounds.width<bounds.height?Math.min:Math.max)(bounds.width/manifest.width,bounds.height/manifest.height),w=manifest.width*fit,h=manifest.height*fit;
 stage.style.width=w+'px';stage.style.height=h+'px';view?.resize(w,h);
}
new ResizeObserver(size).observe(world);
function installView(){
 const blocked=()=>!ready||suspended()||hotspots.inert;
 view=createMobileSceneView({surface:world,canvas:stage,blocked,zoomLimit:4,zoomEnabled:()=>world.clientWidth<world.clientHeight,
  framing:bounds=>({top:0,bottom:bounds.height,anchor:.5,initialZoom:bounds.height>bounds.width?Math.min(4,bounds.height/(bounds.width/manifest.camera.aspect)):1}),
  onTap:event=>{const id=hit(event);if(id)window.dispatchEvent(new CustomEvent('study-object',{detail:LOFT_INTERACTIONS[id]}));},
  onChange:({zoom,pan})=>{reset.hidden=Math.abs(zoom-Number(world.dataset.sceneInitialZoom||1))<.001&&Math.abs(pan)<1;}
 });
 reset.textContent='还原画面';reset.onclick=()=>view.reset();
 stage.addEventListener('keydown',e=>view.key(e));stage.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')stage.style.cursor=!blocked()&&hit(e)?'pointer':'default';});size();
}
const interactionURLs=()=>[...new Set([...catalog.tableProps.map(a=>a.url),catalog.envelope.url,...Object.values(extras)])];
async function prepareEntry(token){
 const media=[...(window.InvitationAudio?.preloadSources()||[]),'assets/wedding-invitation-mobile.webp'];
 await Promise.all([
  backgroundRoomDownloads([...interactionURLs(),...media],(done,total)=>{if(token===generation){world.dataset.startupLoaded=done;world.dataset.startupTotal=total;}},{strict:true}),
  window.InvitationAudio?.prepareBackground(),window.InvitationStudySounds?.prepareCampfire(),window.InvitationStudySounds?.prepareEffects(),
  window.InvitationDice?.prepare(),window.InvitationInspection.prepareHandheld()
 ]);
 world.dataset.handheldMediaReady='true';world.dataset.diceReady='true';
}
async function prepareLayers(){
 await Promise.all(Object.entries(manifest.layers).map(async([key,rect])=>{
  const image=await imageFor(url(rect.url));image.hidden=true;image.dataset.stateLayer=key;layerImages[key]=addLayer(image,rect);
 }));stage.append(renderer.domElement);
}
async function background(token){
 world.dataset.backgroundState='loading';
 const pending=interactionURLs();let done=0;const total=pending.length;
 // Parse downloaded animation clips in small batches; user inspection shares these promises.
 try{
  await Promise.all([0,1].map(async()=>{while(pending.length){await modelAt(pending.shift());if(token!==generation)return;world.dataset.backgroundLoaded=++done;world.dataset.backgroundTotal=total;await new Promise(resolve=>setTimeout(resolve,0));}}));
  if(token===generation)world.dataset.backgroundState='complete';
 }catch(error){if(token===generation)world.dataset.backgroundState='error';console.warn('互动模型预载失败，可在互动时重试',error);}
}
async function boot(){
 if(ready||booting)return;const retrying=world.dataset.sceneLoaded==='error';booting=true;const token=++generation;loading.hidden=false;retry.hidden=true;hotspots.inert=true;world.dataset.sceneLoaded='loading';window.InvitationTerminal?.begin();
 try{
  const startup=prepareEntry(token);startup.catch(()=>{});
  const first=preloadStaticRoom({retry:retrying});first.catch(()=>{});await window.InvitationTerminal?.intro();
  loadingText.textContent='正在展开书房…';({manifest,url}=await first);window.InvitationTerminal?.progress(35);
  stop();view?.destroy();stage?.remove();renderer?.dispose();layerImages={};
  stage=document.createElement('div');stage.className='static-room-stage';stage.tabIndex=0;stage.setAttribute('aria-label','书房。点击物品调查，双指或滚轮缩放，Home 键还原画面。');world.prepend(stage);
  const [backgroundImage,hitImage,windModel]=await Promise.all([imageFor(url(manifest.background)),imageFor(url(manifest.hitMap)),modelAt(url(manifest.windchime))]);
  const surround=addLayer(await imageFor(url(manifest.surround)),{x:0,y:-1,width:1,height:3});surround.classList.add('static-room-surround');
  addLayer(backgroundImage);const mask=document.createElement('canvas');mask.width=hitWidth=hitImage.naturalWidth;mask.height=hitHeight=hitImage.naturalHeight;const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(hitImage,0,0);baseHitPixels=hitPixels=ctx.getImageData(0,0,mask.width,mask.height).data;decodeHit=createPickingDecoder(manifest.picking.colors);pickingState='';pickingPatches={};
  await Promise.all(Object.entries(manifest.picking.patches).map(async([key,rect])=>{const image=await imageFor(url(rect.url)),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=false;context.drawImage(image,0,0);pickingPatches[key]={...rect,pixels:context.getImageData(0,0,canvas.width,canvas.height).data};}));
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(1);renderer.setSize(1600,Math.round(1600/manifest.camera.aspect),false);renderer.domElement.className='static-room-dynamics';stage.append(renderer.domElement);
  scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,.3));camera=new THREE.PerspectiveCamera(manifest.camera.fov,manifest.camera.aspect,.03,100);camera.position.fromArray(manifest.camera.position);camera.quaternion.fromArray(manifest.camera.quaternion);camera.updateMatrixWorld(true);
  const deskRoot=transformGroup(manifest.desk.root),deskSurface=transformGroup(manifest.desk.surface);scene.add(deskRoot,deskSurface);
  const lighting=createTableLighting({desk:{root:deskRoot,surface:deskSurface},renderer});lighting.apply({enabled:true,strength:1,shadows:true,reflection:.38});
  deskRoot.getObjectByName('Realtime floor shadow receiver').visible=false;
  const windShadow=new THREE.Mesh(new THREE.PlaneGeometry(manifest.desk.nativeSize[0],manifest.desk.nativeSize[2]),new THREE.ShadowMaterial({opacity:.3,depthWrite:false}));windShadow.rotation.x=-Math.PI/2;windShadow.position.y=.001;windShadow.receiveShadow=true;deskSurface.add(windShadow);
  windchime=clone(windModel.scene);windchime.matrix.fromArray(manifest.windchimeMatrix);windchime.matrixAutoUpdate=false;scene.add(windchime);lighting.prepare(windchime);
  // Apply the shared desktop light/material treatment; no mobile contact-shadow overlay.
  const deskRotation=new THREE.Quaternion();new THREE.Matrix4().fromArray(manifest.desk.root).decompose(new THREE.Vector3(),deskRotation,new THREE.Vector3());
  const deskYaw=new THREE.Euler().setFromQuaternion(deskRotation).y;
  windchime.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])applyTabletopMaterial(m,renderer,{enabled:true,strength:1,yaw:deskYaw,reflection:.38});});
  breeze=createWindchimeBreeze(windchime,{enabled:()=>!matchMedia('(prefers-reduced-motion:reduce)').matches});
  const fireplace=transformGroup(manifest.fireplaceMatrix);scene.add(fireplace);const anchor=transformGroup(manifest.flameAnchor);scene.add(anchor);const wood={visible:true};flame=createFlame(anchor,{root:fireplace,getLayout:()=>({gap:manifest.fireplaceGap})},wood);flame.apply(manifest.flame);flame.update(0);
  await prepareLayers();
  window.InvitationTerminal?.progress(85);loadingText.textContent='正在准备音乐、音效、动画与骰子…';await startup;world.dataset.roomAudioReady='true';
  loadingText.textContent='正在预演物品互动…';window.InvitationTerminal?.progress(92);
  await window.InvitationInspection.prepare();world.dataset.inspectionReady='true';
  scene.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);renderer.render(scene,camera);world.dataset.staticRoomReady='true';world.dataset.windchimeReady='true';world.dataset.flameReady='true';
  installView();sync();await window.InvitationTerminal?.complete();ready=true;loading.hidden=true;hotspots.inert=false;hotspots.classList.remove('scene-fallback');world.classList.add('ready');world.dataset.sceneLoaded='true';world.dataset.sceneMode='static-hybrid';world.dataset.sceneProfile=profile;world.dataset.clickMode='image-mask';world.dataset.itemsLoaded=manifest.hitIds.length;world.dataset.layoutSource='assets/static-room/manifest.json';
  window.dispatchEvent(new Event('study-room-enter'));window.dispatchEvent(new Event('study-scene-ready'));sync();request();
  // Start automatically after entry; clicking is never required to start downloads.
  background(token).catch(console.warn);
 }catch(e){console.error('书房载入失败',e);world.dataset.sceneLoaded='error';loadingText.textContent='书房暂时未能载入，请重试。';retry.hidden=false;window.InvitationTerminal?.fail();window.dispatchEvent(new Event('study-room-failed'));}
 finally{booting=false;}
}
retry.onclick=()=>boot();window.addEventListener('study-enter',boot);window.dispatchEvent(new Event('study-scene-ready'));if(!study.hidden)boot();
