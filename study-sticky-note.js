import * as THREE from 'three';

export const STICKY_NOTE_MESSAGE='可以从桌子上挑选一件纪念品，寻找婚礼请柬时可能帮得上忙';
let messageTexture;
function texture(){
  if(messageTexture)return messageTexture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d'),family=getComputedStyle(document.body).getPropertyValue('--study-type').trim()||'serif';
  ctx.font=`900 88px ${family}`;ctx.fillStyle='#29271e';ctx.textAlign='center';ctx.textBaseline='middle';
  ['可以从桌子上','挑选一件纪念品，','寻找婚礼请柬时','可能帮得上忙'].forEach((line,i)=>ctx.fillText(line,512,285+i*150));
  messageTexture=new THREE.CanvasTexture(canvas);messageTexture.flipY=false;messageTexture.colorSpace=THREE.SRGBColorSpace;messageTexture.anisotropy=4;
  return messageTexture;
}

export function applyStickyNoteMessage(root){
  const existing=root.getObjectByName('Sticky_Note_Message');if(existing)return existing;
  const paper=root.getObjectByName('Sticky_Note');if(!paper?.isMesh)throw Error('便签缺少纸面模型');
  const geometry=paper.geometry.clone(),position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=new Float32Array(position.count*2);
  geometry.computeBoundingBox();const bounds=geometry.boundingBox,width=bounds.max.x-bounds.min.x,depth=bounds.max.z-bounds.min.z;
  for(let i=0;i<position.count;i++){uv[i*2]=(position.getX(i)-bounds.min.x)/width;uv[i*2+1]=(position.getZ(i)-bounds.min.z)/depth;}
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const indices=[],index=geometry.index,count=index?index.count:position.count;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(ids.reduce((sum,id)=>sum+normal.getY(id),0)>0)indices.push(...ids);}
  geometry.setIndex(indices);geometry.clearGroups();
  const material=new THREE.MeshBasicMaterial({name:'便签留言',map:texture(),transparent:true,alphaTest:.04,depthWrite:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,toneMapped:false});
  material.userData.displayImage=true;
  const ink=new THREE.Mesh(geometry,material);ink.name='Sticky_Note_Message';ink.userData.stickyNoteText=STICKY_NOTE_MESSAGE;paper.add(ink);
  return ink;
}
