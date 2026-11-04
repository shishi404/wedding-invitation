import * as THREE from 'three';
import {notebookPagesFor} from './notebook-page-copy.js';

const pageTextures=new Map();
function pageTexture(text){
  if(pageTextures.has(text))return pageTextures.get(text);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;
  const ctx=canvas.getContext('2d');
  const family=getComputedStyle(document.body).getPropertyValue('--study-type').trim()||'serif';
  const characters=[...text],fontSize=Math.min(characters.length===3?360:270,1320/Math.max(1,characters.length*1.04));
  ctx.font=`900 ${fontSize}px ${family}`;ctx.fillStyle='#29251f';ctx.textAlign='center';ctx.textBaseline='middle';
  const spacing=fontSize*1.04,start=768-(characters.length-1)*spacing/2;
  characters.forEach((character,i)=>ctx.fillText(character,512,start+i*spacing));
  const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  pageTextures.set(text,texture);return texture;
}

// Use the book's existing curved page grids, so the lettering lies on the paper.
export function applyNotebookPages(root,result){
  const materials=[],pages=notebookPagesFor(result);
  for(const [name,text]of [['PageText_Left',pages.left],['PageText_Right',pages.right]]){
    const page=root.getObjectByName(name);if(!page)continue;
    page.visible=!!text;page.userData.notebookText=text;
    if(!text)continue;
    const material=new THREE.MeshBasicMaterial({name:`笔记页面 · ${text}`,map:pageTexture(text),transparent:true,alphaTest:.05,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.FrontSide,toneMapped:false});
    material.userData.displayImage=true;page.material=material;materials.push(material);
  }
  return materials;
}

export function setNotebookPose(root,clips,open){
  const clip=clips.find(c=>c.name==='OpenBook');if(!clip)throw Error('缺少笔记打开动画');
  const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.update(open?clip.duration+.001:0);
  // Leave morph weights at this pose without retaining a running mixer.
  const poses=[];root.traverse(node=>{if(node.morphTargetInfluences)poses.push([node,node.morphTargetInfluences.slice()]);});
  mixer.uncacheRoot(root);
  for(const [node,weights]of poses)node.morphTargetInfluences=weights;
}
