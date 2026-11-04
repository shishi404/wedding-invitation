import * as THREE from 'three';
import {neutralEnvironment} from './loft-fireplace.js';
import {createFlame} from './loft-flame.js';

export const FIREWOOD_DEFAULTS=Object.freeze({visible:true,size:1,glow:1.8});
export const FIREWOOD_MAX_SIZE=1.8;
export function sanitizeFirewood(value={}){
  return {visible:typeof value.visible==='boolean'?value.visible:true,size:THREE.MathUtils.clamp(Number.isFinite(value.size)?value.size:1,.5,FIREWOOD_MAX_SIZE),glow:THREE.MathUtils.clamp(Number.isFinite(value.glow)?value.glow:1.8,0,3)};
}

export function createFirewood(asset,fireplace,renderer){
  asset.updateMatrixWorld(true);
  const sources=[];asset.traverse(object=>{if(object.isMesh)sources.push(object);});
  if(sources.length<3)throw new Error('Firewood pack needs three log variants');
  // Firebox back is z≈.08, grate rear is z≈.443, and the hearth floor is y≈.07.
  // Center the pile within that space, with its lowest sticks resting just above the floor.
  const root=new THREE.Group();root.name='Small Burned Campfire Stack';root.position.set(0,.086,.26);
  fireplace.root.add(root);
  const environment=neutralEnvironment(renderer),materials=[];
  const arrangements=[
    {variant:0,start:[-.145,.027,-.02],end:[.145,.027,.015]},
    {variant:2,start:[-.105,.045,.08],end:[.105,.045,-.07]},
  ];
  // Six short sticks lean inward over two crossed base pieces, forming a loose cone.
  const radii=[.13,.14,.12,.14,.13,.145],heights=[.21,.19,.22,.20,.225,.20];
  for(let i=0;i<6;i++){
    const angle=THREE.MathUtils.degToRad(15+i*60);
    arrangements.push({variant:i%sources.length,start:[Math.cos(angle)*radii[i],.035,Math.sin(angle)*radii[i]],end:[Math.cos(angle+.2)*.018,heights[i],Math.sin(angle+.2)*.018]});
  }
  // Normalize each variant once; repeated sticks share geometry and materials.
  const variants=sources.map(source=>{
    const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();
    const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3());
    geometry.translate(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-(box.min.z+box.max.z)/2);
    geometry.scale(1/size.x,1/size.x,1/size.x);
    const sourceMaterials=Array.isArray(source.material)?source.material:[source.material];
    const cloned=sourceMaterials.map(original=>{const material=original.clone();material.envMap=environment.texture;material.envMapIntensity=.65;material.emissiveIntensity=FIREWOOD_DEFAULTS.glow;material.needsUpdate=true;materials.push(material);return material;});
    return {geometry,material:Array.isArray(source.material)?cloned:cloned[0]};
  });
  // GLTFLoader owns distinct source geometries; normalized copies replace them.
  for(const geometry of new Set(sources.map(source=>source.geometry)))geometry.dispose();
  for(const [index,spec] of arrangements.entries()){
    const variant=variants[spec.variant],start=new THREE.Vector3().fromArray(spec.start),end=new THREE.Vector3().fromArray(spec.end),axis=end.clone().sub(start);
    const log=new THREE.Mesh(variant.geometry,variant.material);log.scale.setScalar(axis.length());
    log.name=`Small Burned Stick ${index+1}`;log.position.copy(start).add(end).multiplyScalar(.5);log.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),axis.normalize());root.add(log);
  }
  const pileBounds=new THREE.Box3();
  for(const log of root.children){log.updateMatrix();log.geometry.computeBoundingBox();pileBounds.union(log.geometry.boundingBox.clone().applyMatrix4(log.matrix));}
  const back=.101,grate=.443,frontLimit=grate-.001;
  const maxDepthScale=(frontLimit-back)/(pileBounds.max.z-pileBounds.min.z);
  const baseFront=.26+pileBounds.max.z;
  const effectsAnchor=new THREE.Group();effectsAnchor.name='FireEffectsAnchor';effectsAnchor.position.set(0,.1,0);root.add(effectsAnchor);
  const flame=createFlame(effectsAnchor,fireplace,root);
  let layout=sanitizeFirewood();
  function apply(value){
    layout=sanitizeFirewood(value);root.visible=layout.visible;
    const growth=Math.max(0,(layout.size-1)/(FIREWOOD_MAX_SIZE-1));
    // Grow in width and height; the shallow firebox limits front-to-back depth.
    const depthScale=layout.size<=1?layout.size:THREE.MathUtils.lerp(1,maxDepthScale,growth);
    root.scale.set(layout.size,layout.size,depthScale);
    root.position.y=.075-pileBounds.min.y*layout.size;
    root.position.z=layout.size<=1?.26:THREE.MathUtils.lerp(baseFront,frontLimit,growth)-pileBounds.max.z*depthScale;
    effectsAnchor.scale.set(1/Math.sqrt(layout.size),1/Math.sqrt(layout.size),1);
    for(const material of materials)material.emissiveIntensity=layout.glow;
    root.updateWorldMatrix(true,true);return {...layout};
  }
  apply(layout);
  return {root,effectsAnchor,flame,apply,getLayout:()=>({...layout}),update(seconds){flame.update(seconds);const flicker=flame.active()?1+.055*Math.sin(seconds*9.3)+.025*Math.sin(seconds*19.1):1;for(const material of materials)material.emissiveIntensity=layout.glow*flicker;},getState:()=>({asset:'firewood-burned-web.glb',...layout,arrangement:'small-campfire-cone-v2',logCount:arrangements.length,localPosition:root.position.toArray(),effectsAnchor:{name:'FireEffectsAnchor',localPosition:effectsAnchor.position.toArray()},effects:{flame:flame.getLayout(),audio:false}})};
}
