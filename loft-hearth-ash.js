import * as THREE from 'three';
import {neutralEnvironment} from './loft-fireplace.js';

// Fireplace-local metres. The grate rear is z=.443 and the hearth is y≈.071.
export const ASH_LIMITS=Object.freeze({width:.58,depth:.324,height:.024,back:.104,bottom:.071,grate:.443});
export function createHearthAsh(asset,fireplace,renderer){
  const box=new THREE.Box3().setFromObject(asset),size=box.getSize(new THREE.Vector3());
  asset.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2));
  const root=new THREE.Group();root.name='Hearth Ash · Inside Grate';
  root.scale.set(ASH_LIMITS.width/size.x,ASH_LIMITS.height/size.y,ASH_LIMITS.depth/size.z);
  root.position.set(0,ASH_LIMITS.bottom,ASH_LIMITS.back+ASH_LIMITS.depth/2);root.add(asset);fireplace.root.add(root);
  asset.traverse(object=>{if(!object.isMesh)return;for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if('envMap' in material){material.envMap=neutralEnvironment(renderer).texture;material.envMapIntensity=.65;}
    // Blend the scanned patch into the existing stone rather than showing its cut edge.
    object.geometry.computeBoundingBox();const meshBox=object.geometry.boundingBox,meshSize=meshBox.getSize(new THREE.Vector3()),center=meshBox.getCenter(new THREE.Vector3());
    material.transparent=true;material.alphaTest=.01;
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 vAshEdge;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvAshEdge=(position.xz-vec2(${center.x},${center.z}))/vec2(${meshSize.x/2},${meshSize.z/2});`);
      shader.fragmentShader='varying vec2 vAshEdge;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.0-smoothstep(.80,1.0,max(abs(vAshEdge.x),abs(vAshEdge.y)));');
    };
    material.customProgramCacheKey=()=> 'hearth-ash-edge-fade-v1';material.needsUpdate=true;
  }});
  function getState(){
    root.updateMatrix();asset.updateMatrix();
    const localBounds=box.clone().applyMatrix4(asset.matrix).applyMatrix4(root.matrix);
    return {asset:'hearth-ash-web.glb',localBounds:{min:localBounds.min.toArray(),max:localBounds.max.toArray()},clearanceToGrate:ASH_LIMITS.grate-localBounds.max.z};
  }
  return {root,getState};
}
