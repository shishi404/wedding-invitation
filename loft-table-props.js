import * as THREE from 'three';
import {contactTexture} from './loft-fireplace.js';
import {sanitizeTableLayout} from './loft-prop-layout.js';
import {TABLE_PROP_ASSETS,ENVELOPE_ASSET} from './loft-props-catalog.js';
import {createJewelryContents} from './loft-jewelry-contents.js';
import {applyFramedPhoto} from './loft-artwork.js';
import {applyTabletopMaterial} from './loft-table-lighting.js';
import {clone} from './vendor/three-addons/utils/SkeletonUtils.js';
import {applyNotebookPages,setNotebookPose} from './study-notebook.js';
import {notebookPagesFor} from './notebook-page-copy.js';
import {applyStickyNoteMessage} from './study-sticky-note.js';
import {createWindchimeBreeze} from './loft-windchime-breeze.js';
export {TABLE_PROP_ASSETS};

export function createTableProps({desk,scene,renderer,loader,saved,onChange,lighting,assets=TABLE_PROP_ASSETS,envelopeAsset=ENVELOPE_ASSET}){
  const entries=new Map(assets.map(asset=>[asset.id,{asset,status:'waiting',layout:{...asset.defaults,...saved?.items?.[asset.id]}}]));
  const outline=new THREE.Box3Helper(new THREE.Box3(),0xd6b971);outline.visible=false;scene.add(outline);
  const shadowTexture=contactTexture();
  const reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  let selected=entries.has(saved?.selected)?saved.selected:assets[0].id,editing=false,taken=null,recordPlaying=false,recordMixer=null;
  function selectedEntry(){return entries.get(selected);}
  function refreshOutline(){const entry=selectedEntry();outline.visible=editing&&desk.root.visible&&entry?.status==='ready'&&entry.root.visible;if(outline.visible)outline.box.setFromObject(entry.content);}
  function notify(){refreshOutline();lighting?.invalidate();onChange?.();}
  function apply(id,value){
    const entry=entries.get(id);if(!entry)return null;
    if(entry.status!=='ready'){entry.layout={...entry.layout,...value};return {...entry.layout};}
    entry.layout=sanitizeTableLayout(value,entry.asset.defaults);
    const layout=entry.layout;entry.root.position.set(layout.x,0,layout.z);entry.root.rotation.y=THREE.MathUtils.degToRad(layout.rotation);entry.root.scale.setScalar(layout.size);entry.root.visible=layout.visible&&id!==taken;entry.root.updateWorldMatrix(true,true);notify();return {...layout};
  }
  async function load(id){
    const entry=entries.get(id);if(!entry||entry.status==='loading'||entry.status==='ready')return;
    entry.status='loading';entry.error='';notify();
    try{
      const gltf=await loader.loadAsync(entry.asset.url),content=gltf.scene;
      // Placement uses the neutral rest pose. Original hierarchy and clips remain available.
      const placement=entry.asset.placementBounds;
      const box=placement?new THREE.Box3(new THREE.Vector3().fromArray(placement.min),new THREE.Vector3().fromArray(placement.max)):new THREE.Box3().setFromObject(content),size=box.getSize(new THREE.Vector3());
      const span=Math.max(size.x,size.z);if(!Number.isFinite(span)||span<=0)throw Error('模型没有有效尺寸');
      const factor=entry.asset.span/span;
      const normalized=new THREE.Group();normalized.name=entry.asset.name+' · 模型';
      content.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2));
      normalized.add(content);normalized.scale.setScalar(factor);
      if(id==='square-wood-photo-frame')await applyFramedPhoto(content);
      if(id==='single-sticky-note')applyStickyNoteMessage(content);
      if(id==='painted-lacquer-jewelry-box'){
        const envelope=await loader.loadAsync(envelopeAsset.url);
        entry.interaction=createJewelryContents(content,gltf.animations,envelope.scene,{saved:saved?.interactions?.jewelryBox,onChange:notify});
      }
      // Optimized/mobile geometry can differ slightly from placementBounds.
      // Seat the actual rest-pose geometry on the surface, including chain instances.
      normalized.position.y-=new THREE.Box3().setFromObject(normalized).min.y;
      // Fill the chain's empty interior for picking without adding geometry to
      // the rendered model, its contact shadow or the inspection copy.
      const pendantBounds=id==='little-prince-pendant'?new THREE.Box3().setFromObject(normalized):null;
      const hitArea=pendantBounds?{x:(pendantBounds.min.x+pendantBounds.max.x)/2,z:(pendantBounds.min.z+pendantBounds.max.z)/2,
        radiusX:Math.max(.001,(pendantBounds.max.x-pendantBounds.min.x)*.58),radiusZ:Math.max(.001,(pendantBounds.max.z-pendantBounds.min.z)*.58),
        plane:new THREE.Plane(new THREE.Vector3(0,1,0),-pendantBounds.max.y)}:null;
      content.traverse(object=>{if(!object.isMesh)return;object.userData.thinContactPaper=id==='single-sticky-note';for(const material of Array.isArray(object.material)?object.material:[object.material]){
        applyTabletopMaterial(material,renderer,{...lighting?.getState(),yaw:desk.root.rotation.y});
        // Resolve coplanar paper/wood depth without lifting the paper off the table.
        if(object.userData.thinContactPaper){material.polygonOffset=true;material.polygonOffsetFactor=object.userData.stickyNoteText?-3:-1;material.polygonOffsetUnits=object.userData.stickyNoteText?-3:-1;}
      }});
      const root=new THREE.Group();root.name=entry.asset.name;root.userData.tablePropId=id;root.add(normalized);desk.surface.add(root);
      const footprint={width:size.x*factor,depth:size.z*factor};
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(footprint.width*1.12,footprint.depth*1.12),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));shadow.name='桌面接触阴影';shadow.rotation.x=-Math.PI/2;shadow.raycast=()=>{};root.add(shadow);
      Object.assign(entry,{root,content:normalized,footprint,hitArea,height:size.y*factor,clips:gltf.animations,status:'ready'});
      if(id==='windchime')entry.breeze=createWindchimeBreeze(content,{enabled:()=>!reducedMotion?.matches});
      lighting?.prepare(root);
      apply(id,entry.layout);
    }catch(error){entry.status='error';entry.error=String(error.message||error);console.error('桌面模型加载失败',id,error);notify();}
  }
  function select(id){if(entries.has(id)){selected=id;notify();}}
  function getSelected(){const entry=selectedEntry();return {id:selected,name:entry.asset.name,status:entry.status,error:entry.error,layout:{...entry.layout},height:entry.height,footprint:entry.footprint,animationCount:entry.clips?.length||0,interaction:entry.interaction?.getState()};}
  function pick(raycaster){const hits=raycaster.intersectObjects([...entries.values()].filter(entry=>entry.status==='ready'&&entry.root.visible).map(entry=>entry.content),true);for(const hit of hits){let object=hit.object;while(object&&!object.userData.tablePropId)object=object.parent;if(object){select(object.userData.tablePropId);return object.userData.tablePropId;}}return null;}
  function getState(){return {version:1,coordinateSystem:'DeskSurface local / Y up',selected,items:Object.fromEntries([...entries].map(([id,entry])=>[id,{...entry.layout}])),interactions:{jewelryBox:entries.get('painted-lacquer-jewelry-box')?.interaction?.getState()??{open:false}}};}
  function restore(value){for(const asset of assets)apply(asset.id,value?.items?.[asset.id]||asset.defaults);entries.get('painted-lacquer-jewelry-box')?.interaction?.reset(value?.interactions?.jewelryBox);select(value?.selected||assets[0].id);notify();}
  function resetAll(){restore(null);}
  function moveFromWorldDelta(delta,start){const inverse=desk.surface.matrixWorld.clone().invert(),origin=new THREE.Vector3().applyMatrix4(inverse),local=delta.clone().applyMatrix4(inverse).sub(origin);return apply(selected,{...start,x:start.x+local.x,z:start.z+local.z});}
  function getProgress(){const values=[...entries.values()];return {loaded:values.filter(entry=>entry.status==='ready').length,failed:values.filter(entry=>entry.status==='error').length,total:values.length,settled:values.every(entry=>['ready','error'].includes(entry.status))};}
  function setTaken(id){taken=id||null;for(const [key,entry]of entries)if(entry.root)entry.root.visible=entry.layout.visible&&key!==taken;notify();}
  function setJewelryState({open=false,envelopeVisible=true,lockBroken=false}={}){const interaction=entries.get('painted-lacquer-jewelry-box')?.interaction;if(interaction){interaction.reset({open,lockBroken});interaction.holder.visible=envelopeVisible;notify();}}
  function setRecordPlaying(value){recordPlaying=!!value;const entry=entries.get('gramophone');if(entry?.status==='ready'&&!recordMixer){const clip=entry.clips.find(c=>c.name==='RecordSpin');if(clip){recordMixer=new THREE.AnimationMixer(entry.content);recordMixer.clipAction(clip).play();}}notify();}
  function setNotebookOpen({object,clips,result='success'}){
    const entry=entries.get('alchemical-book');if(entry?.status!=='ready')return false;
    setNotebookPose(object,clips,false);
    const closed=new THREE.Box3().setFromObject(object,true),size=closed.getSize(new THREE.Vector3());
    const normalized=new THREE.Group();normalized.name=entry.asset.name+' · 已翻开';
    object.position.add(new THREE.Vector3(-(closed.min.x+closed.max.x)/2,-closed.min.y,-(closed.min.z+closed.max.z)/2));
    normalized.add(object);normalized.scale.setScalar(entry.asset.span/Math.max(size.x,size.z));
    setNotebookPose(object,clips,true);
    object.traverse(node=>{if(!node.isMesh)return;const prepare=material=>{const copy=material.clone();applyTabletopMaterial(copy,renderer,{...lighting?.getState(),yaw:desk.root.rotation.y});return copy;};node.material=Array.isArray(node.material)?node.material.map(prepare):prepare(node.material);});
    applyNotebookPages(object,result);
    normalized.position.y-=new THREE.Box3().setFromObject(normalized,true).min.y;
    entry.root.remove(entry.content);entry.root.add(normalized);entry.content=normalized;entry.clips=clips;entry.notebookOpen=true;entry.notebookResult=result;
    entry.root.userData.notebookState={open:true,result,pages:notebookPagesFor(result)};
    const bounds=new THREE.Box3().setFromObject(object,true).getSize(new THREE.Vector3()).multiplyScalar(normalized.scale.x);
    const shadow=entry.root.children.find(child=>child.name==='桌面接触阴影');if(shadow){shadow.geometry.dispose();shadow.geometry=new THREE.PlaneGeometry(bounds.x*1.12,bounds.z*1.12);}
    lighting?.prepare(entry.root);notify();return true;
  }
  const hitRay=new THREE.Ray(),hitInverse=new THREE.Matrix4(),hitPoint=new THREE.Vector3();
  function findHit(raycaster){
    const hits=raycaster.intersectObjects([...entries.values()].filter(e=>e.status==='ready'&&e.root.visible).map(e=>e.content),true);
    for(const hit of hits){let object=hit.object;while(object&&!object.userData.tablePropId)object=object.parent;if(object)return object.userData.tablePropId;}
    // Real item surfaces keep priority over the expanded pendant area.
    const pendant=entries.get('little-prince-pendant'),area=pendant?.hitArea;
    if(pendant?.status!=='ready'||!area||!pendant.root.visible||!desk.root.visible)return null;
    hitRay.copy(raycaster.ray).applyMatrix4(hitInverse.copy(pendant.root.matrixWorld).invert());
    if(!hitRay.intersectPlane(area.plane,hitPoint))return null;
    if(((hitPoint.x-area.x)/area.radiusX)**2+((hitPoint.z-area.z)/area.radiusZ)**2>1)return null;
    const distance=raycaster.ray.origin.distanceTo(hitPoint.applyMatrix4(pendant.root.matrixWorld));
    return distance>=raycaster.near&&distance<=raycaster.far?'little-prince-pendant':null;
  }
  function inspectionModel(id){
    const entry=entries.get(id==='envelope'?'painted-lacquer-jewelry-box':id);
    if(entry?.status!=='ready')return null;
    const source=id==='envelope'?entry.interaction?.holder:entry.content;
    if(!source)return null;
    const object=clone(source);object.visible=true;
    if(id==='windchime')entry.breeze?.reset(object);
    return {object,clips:id==='envelope'?[]:entry.clips,notebookOpen:!!entry.notebookOpen,notebookResult:entry.notebookResult};
  }
  // Limit simultaneous decodes on mobile devices.
  const pending=[...entries.keys()];const ready=Promise.all([0,1].map(async()=>{while(pending.length)await load(pending.shift());}));
  const windchime=entries.get('windchime');
  const windchimeVisible=()=>windchime?.status==='ready'&&windchime.root.visible&&desk.root.visible;
  return {ready,select,getSelected,getState,getProgress,pick,findHit,inspectionModel,setNotebookOpen,setTaken,setJewelryState,setRecordPlaying,applySelected:value=>apply(selected,value),moveFromWorldDelta,restore,resetAll,retrySelected:()=>load(selected),resetSelected:()=>apply(selected,selectedEntry().asset.defaults),setEditing(value){editing=value;refreshOutline();},refreshOutline,openJewelryBox:()=>entries.get('painted-lacquer-jewelry-box')?.interaction?.open(),resetJewelryBox:()=>entries.get('painted-lacquer-jewelry-box')?.interaction?.reset(),active:()=>recordPlaying||!!(windchimeVisible()&&windchime.breeze?.active())||!!entries.get('painted-lacquer-jewelry-box')?.interaction?.active(),update(dt){if(windchimeVisible())windchime.breeze?.update(dt);if(recordPlaying)recordMixer?.update(dt);const interaction=entries.get('painted-lacquer-jewelry-box')?.interaction;if(interaction){interaction.update(dt);if(interaction.active()){lighting?.invalidate();refreshOutline();}}}};
}
