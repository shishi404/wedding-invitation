import * as THREE from 'three';

// The overlay lives inside the active modal so it remains above its backdrop.
export async function playKeyPickup({getModel,dialog,target,mobile}){
  const [{object}]=await Promise.all([getModel('key'),window.InvitationStudySounds?.prepare('key')]);
  const overlay=document.createElement('div');overlay.className='key-pickup-overlay';overlay.dataset.phase='appear';overlay.setAttribute('aria-hidden','true');
  const card=document.createElement('div');card.className='key-pickup-model';overlay.append(card);dialog.append(overlay);
  let renderer,animation;
  const materials=[];
  const visibility=()=>{if(animation){if(document.hidden)animation.pause();else animation.play();}};
  document.addEventListener('visibilitychange',visibility);
  const animate=async(keyframes,options)=>{
    animation=card.animate(keyframes,{...options,fill:'forwards'});visibility();await animation.finished;animation=null;
  };
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
    renderer.setSize(card.clientWidth,card.clientHeight);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.AgXToneMapping;card.append(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffedce,0x65706b,3));
    const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(2,3,5);scene.add(light);
    object.traverse(node=>{if(!node.isMesh)return;const copy=m=>{const next=m.clone();materials.push(next);return next;};node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);});
    const box=new THREE.Box3().setFromObject(object),center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3()).length();
    const group=new THREE.Group();object.position.sub(center);group.add(object);group.scale.setScalar(2/span);group.rotation.z=-.35;scene.add(group);
    const camera=new THREE.PerspectiveCamera(36,card.clientWidth/card.clientHeight,.01,100);camera.position.set(.25,.6,4.3);camera.lookAt(0,0,0);renderer.render(scene,camera);
    window.InvitationStudySounds?.play('key');
    const gentle=matchMedia('(prefers-reduced-motion:reduce)').matches;
    await animate([{transform:'scale(.82)',opacity:0},{transform:`scale(${gentle?1.03:1.14})`,opacity:1,offset:.52},{transform:'scale(1)',opacity:1}],{duration:gentle?300:460,easing:'cubic-bezier(.2,.8,.25,1)'});
    overlay.dataset.phase='fly';
    const destination=target.getBoundingClientRect(),origin=card.getBoundingClientRect();
    const dx=destination.x+destination.width/2-(origin.x+origin.width/2),dy=destination.y+destination.height/2-(origin.y+origin.height/2);
    const marker=document.createElement('div');marker.className='key-pickup-destination';marker.style.cssText=`left:${destination.x}px;top:${destination.y}px;width:${destination.width}px;height:${destination.height}px`;overlay.append(marker);
    await animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.22}px,${dy*.08}px) scale(.8)`,opacity:1,offset:.3},{transform:`translate(${dx}px,${dy}px) scale(.12)`,opacity:.85}],{duration:gentle?500:820,easing:'cubic-bezier(.55,.05,.75,.55)'});
    return true;
  }finally{
    document.removeEventListener('visibilitychange',visibility);animation?.cancel();renderer?.dispose();materials.forEach(m=>m.dispose());overlay.remove();
  }
}
