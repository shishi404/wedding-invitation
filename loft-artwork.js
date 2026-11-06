import * as THREE from 'three';
import {ROOM_IMAGE_ASSETS} from './loft-props-catalog.js';

const textures=new Map();
function imageTexture(id){
  if(!textures.has(id)){
    const asset=ROOM_IMAGE_ASSETS.find(item=>item.id===id);
    textures.set(id,new THREE.TextureLoader().loadAsync(new URL(asset.url,import.meta.url).href).then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.anisotropy=4;return texture;
    }).catch(error=>{textures.delete(id);throw error;}));
  }
  return textures.get(id);
}
function printMaterial(name,map){
  const material=new THREE.MeshBasicMaterial({name,map,side:THREE.DoubleSide,reflectivity:0,toneMapped:false});
  material.userData.displayImage=true;return material;
}
export async function applyFramedPhoto(root){
  const slot=root.getObjectByName('Photo_Slot');
  if(!slot?.isMesh)throw new Error('相框缺少照片槽');
  slot.material=printMaterial('Photo_Slot · Wedding Portrait',await imageTexture('wedding-photo'));
  const glass=root.getObjectByName('Frame_Glass');
  if(glass?.isMesh){
    const clearGlass=original=>{
      const material=original.clone();material.name='Frame Glass · Subtle Reflection';
      material.color.set(0xffffff);material.transparent=true;material.opacity=.035;
      material.side=THREE.FrontSide;material.depthWrite=false;material.roughness=.12;
      material.metalness=0;material.clearcoat=.06;material.clearcoatRoughness=.18;
      material.specularIntensity=.25;material.envMapIntensity=.18;
      material.userData.roomEnvironmentIntensity=.18;
      return material;
    };
    glass.material=Array.isArray(glass.material)?glass.material.map(clearGlass):clearGlass(glass.material);
  }
  return {photoSlot:'Photo_Slot',image:'wedding-photo',crop:'square / both faces retained'};
}

// Replace only the outward-facing print; keep the original board edges and back.
export async function applyWindowArtwork(room){
 let board;room.traverse(object=>{if(object.isMesh&&/^painting_/i.test(object.name))board=object;});
 if(!board?.isMesh)throw Error('未找到窗边画板');
 const geometry=board.geometry.clone(),position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
 const material=board.material.clone(),map=await imageTexture('window-board-art');
 material.name='Window Board · Dancing Figures';material.map=map;material.emissiveMap=map;material.toneMapped=false;
 geometry.clearGroups();
 for(let i=0;i<position.count;i++)if(normal.getY(i)<-.99)uv.setXY(i,(position.getX(i)+1)/2,(1-position.getZ(i))/2);
 const count=geometry.index?.count??position.count;
 for(let i=0;i<count;i+=3){const vertex=geometry.index?geometry.index.getX(i):i;geometry.addGroup(i,3,normal.getY(vertex)<-.99?1:0);}
 uv.needsUpdate=true;board.geometry=geometry;board.material=[board.material,material];
 return {board:board.name,image:'window-board-art',fit:'contain / upright / uncropped'};
}
