import * as THREE from 'three';
import {ROOM_FINISH_WOOD_ASSET} from './loft-props-catalog.js';

// A slightly lighter variation of the jewelry box teal, retaining the cloth finish.
export const SOFA_TEAL=Object.freeze([.0483441,.3477658,.3664797]);
export const STAIR_OAK=Object.freeze([.58,.37,.185]);
export function tintFabric(material){
  const result=material.clone();result.name='Teal Cloth · '+material.name;
  result.onBeforeCompile=shader=>{
    shader.uniforms.uFabricTeal={value:new THREE.Color().setRGB(...SOFA_TEAL)};
    shader.fragmentShader='uniform vec3 uFabricTeal;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
      float fabricLight=dot(outgoingLight,vec3(.2126,.7152,.0722));
      outgoingLight=uFabricTeal*(fabricLight/.24);
      #include <opaque_fragment>
    `);
  };
  result.customProgramCacheKey=()=> 'room-teal-fabric-v1';return result;
}
export function woodStairMaterial(material,wood){
  const result=material.clone();result.name='Light Natural Oak · '+material.name;
  result.onBeforeCompile=shader=>{
    shader.uniforms.uDeskWood={value:wood};
    shader.uniforms.uLightOak={value:new THREE.Color().setRGB(...STAIR_OAK)};
    shader.vertexShader='varying vec3 vFinishPosition;\nvarying vec3 vFinishNormal;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',`
      #include <worldpos_vertex>
      vFinishPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
      vFinishNormal=normalize(mat3(modelMatrix)*objectNormal);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        diffuseColor*=texture2D(map,vMapUv,1.5);
      #endif
    `).replace('#include <emissivemap_fragment>',`
      #ifdef USE_EMISSIVEMAP
        totalEmissiveRadiance*=texture2D(emissiveMap,vEmissiveMapUv,1.5).rgb;
      #endif
    `);
    shader.fragmentShader='uniform sampler2D uDeskWood;\nuniform vec3 uLightOak;\nvarying vec3 vFinishPosition;\nvarying vec3 vFinishNormal;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 woodNormal=normalize(vFinishNormal);
      vec2 radial=vFinishPosition.xz/max(length(vFinishPosition.xz),.0001);
      float radius=length(vFinishPosition.xz);
      float angle=atan(vFinishPosition.z,vFinishPosition.x);
      if(angle<0.0)angle+=6.28318530718;
      // The spiral is centred on the room origin and descends .827 m per radian.
      // Keep long grain along its rising side panels, and across each tread.
      vec2 panelUV=vec2((vFinishPosition.y+.827*angle)*2.8,angle*.80);
      vec2 riserUV=vec2(vFinishPosition.y*2.8,radius*.65);
      float radialFacing=pow(abs(dot(woodNormal.xz/max(length(woodNormal.xz),.0001),radial)),4.0);
      vec2 sideUV=mix(riserUV,panelUV,radialFacing);
      vec2 treadUV=vec2(angle*2.8,radius*.65);
      vec3 woodSide=texture2D(uDeskWood,sideUV).rgb;
      vec3 woodTop=texture2D(uDeskWood,treadUV).rgb;
      vec3 woodSample=mix(woodSide,woodTop,smoothstep(.55,.95,abs(woodNormal.y)));
      float oakGrain=clamp(dot(woodSample,vec3(.2126,.7152,.0722))/.20,.55,1.45);
      vec3 lightOak=uLightOak*mix(1.0,oakGrain,.65);
      float stairLight=dot(outgoingLight,vec3(.2126,.7152,.0722));
      outgoingLight=lightOak*(stairLight/.30);
      #include <opaque_fragment>
    `);
  };
  result.customProgramCacheKey=()=> 'room-light-oak-stairs-v3';return result;
}
export async function applyRoomFinishes(room,{woodAsset=ROOM_FINISH_WOOD_ASSET}={}){
  let sofaMeshes=0;const stairs=[];
  room.traverse(object=>{
    if(!object.isMesh)return;
    if(/^(sofa_|piping_)/i.test(object.name)){
      object.material=Array.isArray(object.material)?object.material.map(tintFabric):tintFabric(object.material);sofaMeshes++;
    }
    if(/^Stairs_/i.test(object.name))stairs.push(object);
  });
  if(!sofaMeshes||!stairs.length)throw new Error('未找到独立沙发或楼梯材质');
  const wood=await new THREE.TextureLoader().loadAsync(woodAsset.url);
  wood.colorSpace=THREE.SRGBColorSpace;wood.wrapS=wood.wrapT=THREE.MirroredRepeatWrapping;
  wood.anisotropy=4;
  for(const object of stairs)object.material=Array.isArray(object.material)?object.material.map(material=>woodStairMaterial(material,wood)):woodStairMaterial(object.material,wood);
  return {sofaMeshes,stairMeshes:stairs.length,sofaColor:SOFA_TEAL,stairFinish:'light-oak-reference',stairColor:STAIR_OAK,extraTextureBytes:woodAsset.bytes};
}
