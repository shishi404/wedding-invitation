import {TABLE_PROP_ASSETS,HEARTH_ASH_ASSET,ENVELOPE_ASSET,ROOM_FINISH_WOOD_ASSET,ROOM_IMAGE_ASSETS} from './loft-props-catalog.js';
import {MOBILE_GEOMETRY} from './loft-mobile-assets.js';
import {MOBILE_TEXTURES} from './loft-mobile-textures.js';
import {ROOM_MODEL_ASSETS} from './loft-room-assets.js';
import {MOBILE_COMPRESSED} from './loft-mobile-compressed.js';
import {MOBILE_OPTIMIZED} from './loft-mobile-optimized.js';
import {ENVELOPE_V3} from './loft-envelope-assets.js';
import {MOBILE_REFINED} from './loft-mobile-refined.js';

export function assetCatalog(profile,{textures=true,originalRoom=false,compressed=true,refined=true}={}){
  const mobile=profile==='mobile';
  const texture=id=>mobile&&textures?{...MOBILE_TEXTURES[id],...(compressed?{...MOBILE_COMPRESSED[id],...MOBILE_OPTIMIZED[id],...(refined?MOBILE_REFINED[id]:null)}:null)}:null;
  const tableProps=TABLE_PROP_ASSETS.map(asset=>({...asset,...(mobile?MOBILE_GEOMETRY[asset.id]:null),...texture(asset.id)}));
  const hearthAsh={...HEARTH_ASH_ASSET,...(mobile?MOBILE_GEOMETRY['hearth-ash']:null),...texture('hearth-ash')};
  // Envelope v3 includes the independently modelled, truly seated invitation on every profile.
  const envelope={...ENVELOPE_ASSET,...ENVELOPE_V3[mobile?'mobile':'desktop'],...(mobile&&refined?MOBILE_REFINED.envelope:null)};
  const stairWood={...ROOM_FINISH_WOOD_ASSET,...texture('stair-wood')};
  const roomModels=Object.fromEntries(Object.entries(ROOM_MODEL_ASSETS).map(([id,versions])=>[id,{...versions[originalRoom?'original':'optimized'],...(!originalRoom?texture(id):null)}]));
  const all=[...tableProps,hearthAsh,envelope,stairWood,...ROOM_IMAGE_ASSETS,...Object.values(roomModels)];
  const budget={bytes:all.reduce((n,a)=>n+a.bytes,0),textureBytes:all.reduce((n,a)=>n+a.textureBytes,0)};
  return {tableProps,hearthAsh,envelope,stairWood,roomImages:ROOM_IMAGE_ASSETS,roomModels,budget};
}
