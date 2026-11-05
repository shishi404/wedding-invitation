import * as THREE from 'three';

export const FIREPLACE_DEFAULTS=Object.freeze({along:1.05,width:1.6,gap:0.025,visible:true});
export const FIREPLACE_LIMITS=Object.freeze({along:[0.95,4.6],width:[1.2,2.2],gap:[0.015,0.35]});
export const WALL_Z=-5.0391;
const WALL_RIGHT_X=5.24957;
const FLOOR_Y=0.01;

export function fireplaceAlongMax(width){
  const safeWidth=THREE.MathUtils.clamp(Number.isFinite(width)?width:FIREPLACE_DEFAULTS.width,...FIREPLACE_LIMITS.width);
  return Math.floor(Math.min(FIREPLACE_LIMITS.along[1],WALL_RIGHT_X-.03-safeWidth/2)*100)/100;
}

export function sanitizeFireplace(value={}){
  const result={};
  for(const key of ['along','width','gap']){
    const number=value[key];
    result[key]=THREE.MathUtils.clamp(Number.isFinite(number)?number:FIREPLACE_DEFAULTS[key],...FIREPLACE_LIMITS[key]);
  }
  result.visible=typeof value.visible==='boolean'?value.visible:FIREPLACE_DEFAULTS.visible;
  result.along=Math.min(result.along,fireplaceAlongMax(result.width));
  return result;
}

export function contactTexture(strength=1){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(128,128,30,128,128,128);
  gradient.addColorStop(0,`rgba(22,18,14,${Math.min(1,.40*strength)})`);
  gradient.addColorStop(.48,`rgba(22,18,14,${Math.min(1,.28*strength)})`);
  gradient.addColorStop(.78,`rgba(22,18,14,${Math.min(1,.10*strength)})`);
  gradient.addColorStop(1,'rgba(22,18,14,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(canvas);
}

const environmentCache=new WeakMap();
export function neutralEnvironment(renderer){
  if(environmentCache.has(renderer))return environmentCache.get(renderer);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');const gradient=ctx.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#f5f4ed');gradient.addColorStop(.45,'#dedbd1');gradient.addColorStop(.65,'#b3ada3');gradient.addColorStop(1,'#77736a');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.mapping=THREE.EquirectangularReflectionMapping;
  const generator=new THREE.PMREMGenerator(renderer);
  const result=generator.fromEquirectangular(texture);
  texture.dispose();generator.dispose();environmentCache.set(renderer,result);return result;
}

export function createFireplace(asset,scene,renderer){
  const root=new THREE.Group();root.name='Placed Fireplace';
  const oriented=new THREE.Group();oriented.name='Fireplace Front +Z';
  oriented.add(asset);oriented.rotation.y=-Math.PI/2;
  // Asset front is +X; rotate it toward the room (+Z), with origin at back/bottom.
  oriented.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(oriented);
  const nativeSize=box.getSize(new THREE.Vector3());
  oriented.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-box.min.z);
  root.add(oriented);scene.add(root);
  const environment=neutralEnvironment(renderer);
  asset.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      // Keep every source texture, color and roughness; supply neutral lighting only here.
      material.envMap=environment.texture;material.envMapIntensity=1.35;material.needsUpdate=true;
    }
  });
  const texture=contactTexture();
  const floorShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.72}));
  floorShadow.name='Fireplace Floor Contact';floorShadow.rotation.x=-Math.PI/2;
  const wallShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.32}));
  wallShadow.name='Fireplace Wall Contact';
  scene.add(floorShadow,wallShadow);
  const outline=new THREE.Box3Helper(new THREE.Box3(),0x929a6b);outline.visible=false;scene.add(outline);
  let layout=sanitizeFireplace(),selected=false;
  function apply(value){
    layout=sanitizeFireplace(value);
    const scale=layout.width/nativeSize.x;
    root.scale.setScalar(scale);
    root.position.set(layout.along,FLOOR_Y,WALL_Z+layout.gap);
    root.visible=layout.visible;
    root.updateMatrixWorld(true);
    const size=nativeSize.clone().multiplyScalar(scale);
    floorShadow.position.set(layout.along,FLOOR_Y+.009,WALL_Z+layout.gap+size.z*.45);
    floorShadow.scale.set(size.x*1.18,size.z*1.30,1);
    floorShadow.visible=layout.visible;
    wallShadow.position.set(layout.along,FLOOR_Y+size.y*.50,WALL_Z+.008);
    wallShadow.scale.set(size.x*1.15,size.y*1.12,1);wallShadow.visible=layout.visible;
    outline.box.setFromObject(root);outline.visible=selected&&layout.visible;
    return {...layout,height:size.y,depth:size.z};
  }
  apply(layout);
  return {root,outline,nativeSize,apply,getLayout:()=>({...layout}),setSelected(value){selected=value;outline.visible=value&&layout.visible;},getBounds:()=>new THREE.Box3().setFromObject(root)};
}
