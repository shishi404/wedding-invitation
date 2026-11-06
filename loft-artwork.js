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
 const map=await imageTexture('window-board-art');
 // The print is diffuse canvas, with no inherited baked emission. It receives
 // the same real window key, area lights and shadows as the tabletop props.
 const material=new THREE.MeshStandardMaterial({name:'Window Board · Lit Canvas',map,roughness:.92,metalness:0,side:THREE.DoubleSide});
 material.userData.physicalRoomSurface=true;board.receiveShadow=true;
 // Evaluate the actual window opening as a finite area emitter in this material.
 // Keeping it local to the canvas preserves illumination already baked into the room.
 const windowLight={position:{value:new THREE.Vector3()},halfWidth:{value:new THREE.Vector3()},halfHeight:{value:new THREE.Vector3()},color:{value:new THREE.Color(0xfff2df).multiplyScalar(2.5)}};
 const viewRotation=new THREE.Matrix3();
 board.onBeforeRender=(_renderer,_scene,camera)=>{
  viewRotation.setFromMatrix4(camera.matrixWorldInverse);
  windowLight.position.value.set(-2.92,2.5,-3.2).applyMatrix4(camera.matrixWorldInverse);
  windowLight.halfWidth.value.set(0,0,1.5).applyMatrix3(viewRotation);
  windowLight.halfHeight.value.set(0,2.3,0).applyMatrix3(viewRotation);
 };
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{canvasWindowPosition:windowLight.position,canvasWindowWidth:windowLight.halfWidth,canvasWindowHeight:windowLight.halfHeight,canvasWindowColor:windowLight.color});
  shader.fragmentShader='uniform vec3 canvasWindowPosition;\nuniform vec3 canvasWindowWidth;\nuniform vec3 canvasWindowHeight;\nuniform vec3 canvasWindowColor;\n'+shader.fragmentShader.replace('#include <lights_fragment_end>',`
   #include <lights_fragment_end>
   #if NUM_RECT_AREA_LIGHTS > 0
    RectAreaLight canvasWindow;
    canvasWindow.position=canvasWindowPosition;canvasWindow.halfWidth=canvasWindowWidth;canvasWindow.halfHeight=canvasWindowHeight;canvasWindow.color=canvasWindowColor;
    RE_Direct_RectArea(canvasWindow,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
   #endif
  `);
 };
 material.customProgramCacheKey=()=> 'physical-canvas-window-v1';

 geometry.clearGroups();
 for(let i=0;i<position.count;i++)if(normal.getY(i)<-.99)uv.setXY(i,(position.getX(i)+1)/2,(1-position.getZ(i))/2);
 const count=geometry.index?.count??position.count;
 for(let i=0;i<count;i+=3){const vertex=geometry.index?geometry.index.getX(i):i;geometry.addGroup(i,3,normal.getY(vertex)<-.99?1:0);}
 uv.needsUpdate=true;board.geometry=geometry;board.material=[board.material,material];
 return {board:board.name,image:'window-board-art',fit:'contain / upright / uncropped'};
}
