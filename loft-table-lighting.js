import * as THREE from 'three';
import {RectAreaLightUniformsLib} from './vendor/three-addons/lights/RectAreaLightUniformsLib.js';
import {neutralEnvironment} from './loft-fireplace.js';

// The same softbox arrangement supplies direct light and reflected highlights.
// Generate it once; no HDR download or per-frame reflection capture is needed.
const cache=new WeakMap();
const SOFTBOXES=[
  {name:'Window softbox',position:[-2.1,2.6,1.1],width:2.8,height:1.8,color:[1,.94,.85],radiance:2.8,intensity:.45},
  {name:'Camera-side fill',position:[2.3,1.5,1.8],width:1.6,height:2,color:[.90,.95,1],radiance:.9,intensity:.3},
  {name:'Rear reflection strip',position:[.3,.9,-2.8],width:3,height:.65,color:[1,.97,.92],radiance:1.3},
];

export function tabletopEnvironment(renderer){
  if(cache.has(renderer))return cache.get(renderer);
  if(!THREE.UniformsLib.LTC_FLOAT_1)RectAreaLightUniformsLib.init();
  const studio=new THREE.Scene();studio.background=new THREE.Color().setRGB(.19,.20,.22);
  const meshes=[];
  for(const box of SOFTBOXES){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(box.width,box.height),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...box.color).multiplyScalar(box.radiance),side:THREE.DoubleSide,toneMapped:false}));
    panel.position.fromArray(box.position);panel.lookAt(0,0,0);studio.add(panel);meshes.push(panel);
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(.07,.055,.04),side:THREE.DoubleSide,toneMapped:false}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-1.1;studio.add(floor);meshes.push(floor);
  const generator=new THREE.PMREMGenerator(renderer);
  const environment=generator.fromScene(studio,.025,.05,30,{size:128});
  for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}
  generator.dispose();cache.set(renderer,environment);return environment;
}

export function applyTabletopMaterial(material,renderer,{enabled=true,strength=1,yaw=0,reflection=.38}={}){
  if(material.userData.displayImage){material.toneMapped=false;return;}
  if(!material.isMeshStandardMaterial){material.toneMapped=false;return;}
  material.envMap=(enabled?tabletopEnvironment(renderer):neutralEnvironment(renderer)).texture;
  material.envMapIntensity=material.userData.roomEnvironmentIntensity??(enabled?reflection*strength:(material.userData.neutralEnvironmentIntensity??1.1));
  material.envMapRotation.set(0,enabled?yaw:0,0);
  material.userData.originalTableRoughness??=material.roughness;
  const minimum=material.userData.tabletopWood?.38:material.metalness>.5?.28:.26;
  material.roughness=enabled?Math.max(material.userData.originalTableRoughness,minimum):material.userData.originalTableRoughness;
  if(material.userData.tabletopWood&&material.isMeshPhysicalMaterial){
    material.userData.originalTableCoat??={amount:material.clearcoat,roughness:material.clearcoatRoughness};
    const original=material.userData.originalTableCoat;
    material.clearcoat=enabled?Math.min(original.amount,.12):original.amount;
    material.clearcoatRoughness=enabled?.4:original.roughness;
  }
  material.toneMapped=enabled;
  material.needsUpdate=true;
}

// Keep the room's baked illumination and the existing fireplace animation.
// Exclude table lights from baked room materials; retain the fire point light.
export function preserveRoomLighting(root){
  const chunk=THREE.ShaderChunk.lights_fragment_begin.replace('#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )','#if 0').replace('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )','#if 0');
  root.traverse(object=>{
    if(!object.material)return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      material.toneMapped=false;
      if(!material.isMeshStandardMaterial||material.userData.keepBakedLighting)continue;
      const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
      material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',chunk);};
      material.customProgramCacheKey=()=>previousKey+' / no-table-softboxes-v2';
      material.userData.keepBakedLighting=true;material.needsUpdate=true;
    }
  });
}

export function createTableLighting({desk,renderer,onChange=()=>{}}){
  tabletopEnvironment(renderer);
  const root=new THREE.Group();root.name='Shared Tabletop Softboxes';desk.surface.add(root);
  const lights=SOFTBOXES.filter(box=>box.intensity).map(box=>{
    const light=new THREE.RectAreaLight(new THREE.Color().setRGB(...box.color),box.intensity,box.width,box.height);
    light.name=box.name;light.position.fromArray(box.position);light.lookAt(0,0,0);root.add(light);return light;
  });
  // One cached shadow map: static layout changes invalidate it, the fire does not.
  const key=new THREE.DirectionalLight(0xffefd9,1.65);key.name='Window key · real shadows';
  key.position.set(-2.1,3.2,1.1);root.add(key);root.add(key.target);
  key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-1.8,right:1.8,top:1.8,bottom:-1.8,near:.1,far:9});
  key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.00015;key.shadow.normalBias=.003;key.shadow.radius=2;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(5,4),new THREE.ShadowMaterial({opacity:.3,depthWrite:false}));
  ground.name='Realtime floor shadow receiver';ground.rotation.x=-Math.PI/2;ground.position.y=.003;ground.receiveShadow=true;ground.raycast=()=>{};desk.root.add(ground);
  let state={enabled:true,strength:1,shadows:true,reflection:.38},lastYaw=NaN;
  function invalidate(){renderer.shadowMap.needsUpdate=true;}
  function prepare(object){object.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(mesh.name==='桌面接触阴影'){mesh.visible=!(state.enabled&&state.shadows);return;}
    if(mesh===ground)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    mesh.castShadow=state.enabled&&state.shadows&&!materials.every(m=>m.transparent&&m.opacity<.1);
    // Flush, sub-millimetre paper otherwise receives its own coplanar shadow.
    mesh.receiveShadow=state.enabled&&state.shadows&&!mesh.userData.thinContactPaper;
  });invalidate();}
  function refreshMaterials(){
    desk.root.updateWorldMatrix(true,true);prepare(desk.root);
    const yaw=desk.root.rotation.y,seen=new Set();
    desk.root.traverse(object=>{
      if(!object.isMesh)return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(seen.has(material))continue;seen.add(material);
        applyTabletopMaterial(material,renderer,{...state,yaw});
      }
    });lastYaw=yaw;
  }
  function apply(value={}){
    state={enabled:value.enabled!==false,strength:THREE.MathUtils.clamp(Number.isFinite(value.strength)?value.strength:1,.5,1.5),shadows:value.shadows!==false,reflection:THREE.MathUtils.clamp(Number.isFinite(value.reflection)?value.reflection:.38,.1,1)};
    root.visible=state.enabled;key.castShadow=state.enabled&&state.shadows;key.intensity=1.65*state.strength;
    ground.visible=state.enabled&&state.shadows;
    const contact=desk.root.parent?.getObjectByName('Desk Floor Contact');if(contact)contact.visible=desk.root.visible&&!ground.visible;
    invalidate();
    lights.forEach((light,index)=>light.intensity=SOFTBOXES[index].intensity*state.strength);
    // AgX rolls off bright metal/ceramic highlights. Baked surfaces and prints opt out.
    renderer.toneMapping=state.enabled?THREE.AgXToneMapping:THREE.NoToneMapping;
    renderer.toneMappingExposure=state.enabled?1.1:1;
    refreshMaterials();onChange();return getState();
  }
  function getState(){return {...state,areaLights:lights.length,shadowMapSize:2048,shadowMode:'cached PCF / window key',reflectionCapturesPerFrame:0};}
  return {apply,getState,refreshMaterials,prepare,invalidate,sync(){invalidate();const contact=desk.root.parent?.getObjectByName('Desk Floor Contact');if(contact)contact.visible=desk.root.visible&&!ground.visible;if(lastYaw!==desk.root.rotation.y)refreshMaterials();},root};
}
