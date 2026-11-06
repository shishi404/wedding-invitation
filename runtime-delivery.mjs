import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditRuntime} from './audit-runtime.mjs';
import {assetCatalog} from './loft-asset-profile.js';
import {inspectionAssetCatalog} from './loft-inspection-assets.js';
export async function deliveryFiles(){
 const models=new Set(),local=url=>relative(import.meta.dirname,fileURLToPath(new URL(url,import.meta.url))).replaceAll('\\','/');
 models.add('assets/static-room/windchime.glb');
 for(const profile of ['mobile','desktop']){
  const c=assetCatalog(profile);for(const a of [...c.tableProps,c.envelope,c.hearthAsh,...Object.values(c.roomModels)])models.add(local(a.url));
  for(const url of Object.values(inspectionAssetCatalog(profile)))models.add(local(url));
 }
 const files=new Set([...(await auditRuntime())].filter(path=>!path.endsWith('.glb')||models.has(path)));
 for(const path of ['vendor/THREE-LICENSE.txt','vendor/MESHOPT-LICENSE.md'])files.add(path);
 return files;
}
