import * as THREE from 'three';
import {GLTFLoader} from './vendor/three-addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.js';
import {ENVELOPE_V3} from './loft-envelope-assets.js';
import {MOBILE_REFINED} from './loft-mobile-refined.js';
import {createEnvelopeDetails} from './study-envelope.js';

// A lightweight entry: only the shared envelope is loaded, never the study room.
const dialog=document.createElement('dialog');dialog.className='invitation-intro';
dialog.setAttribute('aria-label','拆开婚礼请柬');
const host=document.createElement('div');host.className='invitation-intro-stage';dialog.append(host);document.body.append(dialog);
// Nonmodal keeps the music and download controls available throughout the animation.
dialog.show();dialog.addEventListener('cancel',event=>event.preventDefault());
const image=document.querySelector('#wedding-invitation-image');
const imageReady=image.decode().catch(()=>{});
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const mobile=matchMedia('(max-width:700px)').matches;
let renderer,details,mixer,object,frame,resizeObserver;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100);
scene.add(new THREE.HemisphereLight(0xfff4e1,0x65706b,2));
for(const [position,intensity]of [[[3,4,5],3],[[-3,1,-2],1.5]]){
  const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.fromArray(position);scene.add(light);
}
let last=0,phaseTime=0,advance;
function draw(now){
  // Hidden tabs pause the sequence; coming back must not skip a step.
  const dt=last&&!document.hidden?Math.min((now-last)/1000,.05):0;last=now;
  if(!document.hidden){mixer?.update(dt*(reduced?3:1));details?.update(dt*(reduced?3:1));phaseTime+=dt;advance?.();renderer.render(scene,camera);}
  frame=requestAnimationFrame(draw);
}
function hold(seconds){phaseTime=0;return new Promise(resolve=>{advance=()=>{if(phaseTime>=seconds){advance=null;resolve();}};});}
function play(name){
  const clip=object.animations.find(value=>value.name===name);if(!clip)throw Error('缺少动画 '+name);
  const action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopOnce,1).setEffectiveTimeScale(1.5);action.clampWhenFinished=true;
  return new Promise(resolve=>{const done=event=>{if(event.action!==action)return;mixer.removeEventListener('finished',done);resolve();};mixer.addEventListener('finished',done);action.play();});
}
function beginBackgroundTransition(){
  document.documentElement.classList.add('invitation-color-transition');
  dialog.classList.add('invitation-color-transition');
}
async function reveal(){
  await imageReady;
  // The backdrop has already changed during opening; only crossfade the paper here.
  beginBackgroundTransition();
  // Restore the reading position while still covered, before the first visible frame.
  window.scrollTo({top:0,left:0,behavior:'instant'});
  document.documentElement.classList.remove('invitation-opening');
  document.body.dataset.invitationPhase='revealing';
  await dialog.animate([{opacity:1},{opacity:0}],{duration:reduced?120:400,easing:'ease-in-out',fill:'forwards'}).finished;
  document.body.dataset.invitationPhase='reading';
}
try{
  document.body.dataset.invitationPhase='loading-envelope';
  const asset=mobile?(MOBILE_REFINED.envelope||ENVELOPE_V3.mobile):ENVELOPE_V3.desktop;
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(asset.url);
  object=gltf.scene;object.animations=gltf.animations;
  details=await createEnvelopeDetails(object,gltf.animations);
  // Frame both the closed pocket and the completely folded-back lid once.
  const bounds=new THREE.Box3().setFromObject(object),preview=new THREE.AnimationMixer(object);
  const clip=gltf.animations.find(value=>value.name==='Flap_Open'),action=preview.clipAction(clip);
  action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();preview.update(clip.duration+.001);
  bounds.union(new THREE.Box3().setFromObject(object));preview.stopAllAction();preview.uncacheRoot(object);
  const centered=new THREE.Group();centered.add(object);centered.position.copy(bounds.getCenter(new THREE.Vector3())).negate();
  const model=new THREE.Group();model.add(centered);model.scale.setScalar(2/Math.max(...bounds.getSize(new THREE.Vector3()).toArray()));scene.add(model);
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.25;renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','米色信封打开，取出并展开婚礼请柬');host.append(renderer.domElement);
  const fit=()=>{
    const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;
    const halfFov=THREE.MathUtils.degToRad(camera.fov/2),distance=1.65/Math.sin(Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect)));
    camera.position.set(.3,.7,1).setLength(distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  };
  resizeObserver=new ResizeObserver(fit);resizeObserver.observe(host);fit();mixer=new THREE.AnimationMixer(object);
  frame=requestAnimationFrame(draw);document.body.dataset.invitationPhase='closed-envelope';await hold(reduced ? .1 : .55);
  document.body.dataset.invitationPhase='splitting-seal';await details.splitSeal();
  document.body.dataset.invitationPhase='opening-envelope';beginBackgroundTransition();window.InvitationStudySounds?.play('envelope-open');await play('Flap_Open');
  document.body.dataset.invitationPhase='open-envelope';await hold(reduced ? .08 : .35);
  document.body.dataset.invitationPhase='extracting-letter';await details.extract();
  object.updateWorldMatrix(true,true);
  const paper=details.paper,center=new THREE.Vector3();paper.getWorldPosition(center);
  const corner=paper.localToWorld(new THREE.Vector3(.09,0,-.058));center.project(camera);corner.project(camera);
  const rect=renderer.domElement.getBoundingClientRect();
  const origin={x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2,width:Math.max(40,Math.abs(corner.x-center.x)*rect.width)};
  paper.visible=false;host.style.visibility='hidden';document.body.dataset.invitationPhase='unfolding-letter';cancelAnimationFrame(frame);
  await details.foreground({dialog,origin,onUnfolded:reveal});
}catch(error){
  // Reading and downloading remain available if WebGL or a model is unavailable.
  console.warn('信封动画暂时无法播放',error);await reveal();
}finally{
  cancelAnimationFrame(frame);resizeObserver?.disconnect();details?.dispose();mixer?.stopAllAction();
  renderer?.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene.traverse(node=>{if(!node.isMesh)return;geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
  dialog.close();dialog.remove();
}
