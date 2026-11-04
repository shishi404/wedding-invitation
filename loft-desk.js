import * as THREE from 'three';
import {contactTexture,neutralEnvironment} from './loft-fireplace.js';

export const DESK_DEFAULTS=Object.freeze({side:0,distance:2.55,rotation:0,width:1.87,visible:true});
export const DESK_LIMITS=Object.freeze({side:[-2.5,2.5],distance:[1.2,5.5],rotation:[-180,180],width:[1.2,2.4]});
const FLOOR_Y=.01;
// Keep the established desk-local placement frame when replacing the Source mesh.
const PLACEMENT_SIZE=new THREE.Vector3(.9373555779457092-(-.9313986897468567),.7047167420387268-.000044428263208828866,.49471229314804077-(-.49299532175064087));

export function deskFrameFromCamera(camera){
  const direction=camera.getWorldDirection(new THREE.Vector3());direction.y=0;
  if(direction.lengthSq()<.001)direction.set(-1,0,-1);
  direction.normalize();
  return {origin:[camera.position.x,0,camera.position.z],forward:direction.toArray()};
}

export function sanitizeDesk(value={}){
  const result={};
  for(const key of Object.keys(DESK_LIMITS))result[key]=THREE.MathUtils.clamp(Number.isFinite(value[key])?value[key]:DESK_DEFAULTS[key],...DESK_LIMITS[key]);
  result.visible=typeof value.visible==='boolean'?value.visible:true;
  return result;
}

function validFrame(frame){return ['origin','forward'].every(key=>Array.isArray(frame?.[key])&&frame[key].length===3&&frame[key].every(Number.isFinite))&&Math.hypot(frame.forward[0],frame.forward[2])>.01;}

export function createDesk(asset,scene,renderer,camera){
  const root=new THREE.Group();root.name='Placed Interaction Desk';
  const box=new THREE.Box3().setFromObject(asset),sourceSize=box.getSize(new THREE.Vector3()),nativeSize=PLACEMENT_SIZE.clone();
  asset.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2));
  const fitted=new THREE.Group();fitted.name='Original Desk · Preserved Placement';
  fitted.scale.copy(nativeSize).divide(sourceSize);fitted.add(asset);
  root.add(fitted);scene.add(root);
  const environment=neutralEnvironment(renderer);
  asset.traverse(object=>{if(!object.isMesh)return;for(const material of Array.isArray(object.material)?object.material:[object.material]){material.envMap=environment.texture;material.envMapIntensity=1.2;material.userData.tabletopWood=true;material.userData.neutralEnvironmentIntensity=1.2;material.needsUpdate=true;}});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,depthWrite:false,opacity:.72}));
  shadow.name='Desk Floor Contact';shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  // This is the real tabletop, not a clearance plane above it.
  const surface=new THREE.Group();surface.name='DeskSurface';surface.position.y=nativeSize.y;root.add(surface);
  const usableWidth=Math.max(.1,nativeSize.x-.12),usableDepth=Math.max(.1,nativeSize.z-.12);
  const surfaceGuide=new THREE.Mesh(new THREE.PlaneGeometry(usableWidth,usableDepth),new THREE.MeshBasicMaterial({color:0xa6bd77,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
  surfaceGuide.rotation.x=-Math.PI/2;surfaceGuide.position.y=.0005;surface.add(surfaceGuide);
  const outline=new THREE.Box3Helper(new THREE.Box3(),0xa1a56d);scene.add(outline);
  let frame=deskFrameFromCamera(camera),layout=sanitizeDesk(),selected=false,showSurface=true;
  const fwd=new THREE.Vector3(),right=new THREE.Vector3();
  function basis(){fwd.fromArray(frame.forward).setY(0).normalize();right.set(-fwd.z,0,fwd.x);}
  function getSurface(){
    surface.updateWorldMatrix(true,false);
    const position=surface.getWorldPosition(new THREE.Vector3());
    return {name:'DeskSurface',coordinateSystem:'desk-local',worldPosition:position.toArray(),worldQuaternion:surface.getWorldQuaternion(new THREE.Quaternion()).toArray(),width:usableWidth*root.scale.x,depth:usableDepth*root.scale.x,localBounds:{min:[-usableWidth/2,0,-usableDepth/2],max:[usableWidth/2,0,usableDepth/2]},matrixWorld:surface.matrixWorld.toArray()};
  }
  function apply(value){
    if(validFrame(value?.frame))frame={origin:[value.frame.origin[0],0,value.frame.origin[2]],forward:[value.frame.forward[0],0,value.frame.forward[2]]};
    basis();layout=sanitizeDesk(value);
    const scale=layout.width/nativeSize.x,depth=nativeSize.z*scale;
    root.scale.setScalar(scale);root.rotation.y=Math.atan2(-fwd.x,-fwd.z)+THREE.MathUtils.degToRad(layout.rotation);
    root.position.fromArray(frame.origin).addScaledVector(fwd,layout.distance).addScaledVector(right,layout.side);root.position.y=FLOOR_Y;
    const halfX=(Math.abs(Math.cos(root.rotation.y))*layout.width+Math.abs(Math.sin(root.rotation.y))*depth)/2;
    const halfZ=(Math.abs(Math.sin(root.rotation.y))*layout.width+Math.abs(Math.cos(root.rotation.y))*depth)/2;
    root.position.x=THREE.MathUtils.clamp(root.position.x,-2.85+halfX,5.16-halfX);
    root.position.z=THREE.MathUtils.clamp(root.position.z,-4.92+halfZ,2.78-halfZ);
    const delta=root.position.clone().sub(new THREE.Vector3().fromArray(frame.origin));
    layout.side=delta.dot(right);layout.distance=delta.dot(fwd);
    root.visible=layout.visible;root.updateMatrixWorld(true);
    shadow.visible=layout.visible;shadow.position.set(root.position.x,FLOOR_Y+.008,root.position.z);shadow.rotation.z=root.rotation.y;shadow.scale.set(layout.width*1.12,depth*1.12,1);
    outline.box.setFromObject(root);outline.visible=selected&&layout.visible;surfaceGuide.visible=selected&&showSurface&&layout.visible;
    return {...layout,frame:structuredClone(frame),height:FLOOR_Y+nativeSize.y*scale,depth};
  }
  apply(layout);
  return {root,surface,nativeSize,apply,getLayout:()=>({...layout,frame:structuredClone(frame)}),getSurface,setSelected(value){selected=value;outline.visible=value&&layout.visible;surfaceGuide.visible=value&&showSurface&&layout.visible;},showSurface(value){showSurface=value;surfaceGuide.visible=selected&&value&&layout.visible;},centerInFront(){frame=deskFrameFromCamera(camera);return apply(DESK_DEFAULTS);},reset(){return apply(DESK_DEFAULTS);},moveByWorldDelta(delta,start){basis();return apply({...start,side:start.side+delta.dot(right),distance:start.distance+delta.dot(fwd)});}};
}
