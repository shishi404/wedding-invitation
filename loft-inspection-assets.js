import {MOBILE_INSPECTION_ASSETS} from './loft-mobile-optimized.js';
import {MOBILE_REFINED_INSPECTION} from './loft-mobile-refined.js';
export function inspectionAssetCatalog(profile,{refined=true}={}){
  const assets={'notebook-opening':'./output/loft-viewer/notebook-opening-web.glb',key:'./output/loft-viewer/key-pickup-web.glb',knife:'./模型库/09_匕首拆信刀_Source/整木握把写实版_v6/dagger-letter-opener-realistic-v6.glb'};
  if(profile==='mobile')for(const [id,asset]of Object.entries(MOBILE_INSPECTION_ASSETS))assets[id]=asset.url;
  if(profile==='mobile'&&refined)for(const [id,asset]of Object.entries(MOBILE_REFINED_INSPECTION))assets[id]=asset.url;
  return assets;
}
