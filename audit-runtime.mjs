import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,relative,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assetCatalog} from './loft-asset-profile.js';
import {inspectionAssetCatalog} from './loft-inspection-assets.js';

const root=resolve(import.meta.dirname);
export const entryPages=['index.html','invitation.html'];
// These paths are assembled at runtime rather than written as complete URLs.
const dynamicAssets=[
  ...Array.from({length:12},(_,i)=>`windchime-${String(i+1).padStart(2,'0')}.ogg`),
];
const effects=['notebook-open','notebook-tear','notebook-pickup','handheld-pickup','box-pickup','sticky-note','wax','envelope-open','cup-clink','check-success','failure','musicbox-place','unlock','photo','box-open','box-break','box-failure','key','necklace','record-break','record-search','campfire'];

export async function auditRuntime(){
  // Catalogs also describe authoring backups and earlier optimizations. Only
  // the default desktop/mobile profiles are dependencies of the published site.
  const activeModels=new Set(),activeImages=new Set();
  const assetPath=url=>relative(root,resolve(root,url.split(/[?#]/)[0])).split(sep).join('/');
  for(const profile of ['mobile','desktop']){
    const catalog=assetCatalog(profile);
    for(const asset of [...catalog.tableProps,catalog.envelope,catalog.hearthAsh,...Object.values(catalog.roomModels)])activeModels.add(assetPath(asset.url));
    for(const url of Object.values(inspectionAssetCatalog(profile)))activeModels.add(assetPath(url));
    for(const asset of [catalog.stairWood,...catalog.roomImages])activeImages.add(assetPath(asset.url));
  }
  const files=new Set(),missing=new Set(),queue=[...entryPages,...dynamicAssets.map(p=>'assets/'+p),...effects.map(p=>`assets/sfx/${p}.ogg`)];
  const enqueue=async(value,from,{required=false}={})=>{
    if(!value||value.includes('${')||/^(?:data:|blob:|https?:|#|%23)/i.test(value))return;
    const url=value.split(/[?#]/)[0];
    const path=resolve(dirname(resolve(root,from)),decodeURIComponent(url));
    if(!path.startsWith(root+sep))throw Error(`Resource outside project: ${value}`);
    const local=relative(root,path).split(sep).join('/');
    if(local.endsWith('.glb')&&!activeModels.has(local))return;
    if(local.startsWith('output/loft-viewer/')&&/\.(?:jpg|png|webp)$/.test(local)&&!activeImages.has(local))return;
    try{if((await stat(path)).isFile())queue.push(local);}
    catch{if(required||/^(?:\.\.?\/|assets\/|output\/|模型库\/)/.test(url))missing.add(`${from} → ${value}`);}
  };
  while(queue.length){
    const file=queue.pop();if(files.has(file))continue;files.add(file);
    const path=resolve(root,file);let bytes;
    try{bytes=await readFile(path);}catch{missing.add(file);continue;}
    if(extname(file)==='.glb'){
      const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
      for(const item of [...json.images||[],...json.buffers||[]])if(item.uri)await enqueue(item.uri,file,{required:true});
      continue;
    }
    if(!/\.(?:html|css|js|json|svg|gltf)$/.test(file))continue;
    const source=bytes.toString('utf8');
    const text=extname(file)==='.js'?source.replace(/\/\*[\s\S]*?\*\/|^[ \t]*\/\/.*$/gm,''):source;
    const strings=/(['"`])([^'"`\r\n]+?\.(?:html|css|js|json|svg|png|jpe?g|webp|ogg|mp3|wav|woff2?|ttf|glb|gltf|bin|wasm)(?:\?[^'"`\r\n]*)?)\1/g;
    for(const match of text.matchAll(strings))await enqueue(match[2],file);
    if(/\bfrom\s*['"]three['"]/.test(text))queue.push('vendor/three.module.js');
    if(extname(file)==='.css')for(const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))await enqueue(match[1],file,{required:true});
  }
  if(missing.size)throw Error('Missing runtime dependencies:\n'+[...missing].join('\n'));
  return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const files=await auditRuntime();let bytes=0;for(const file of files)bytes+=(await stat(resolve(root,file))).size;
  console.log(`Runtime dependency audit passed: ${entryPages.length} entry pages, ${files.size} referenced files, ${(bytes/1048576).toFixed(2)} MiB. Includes active phone/desktop models, sound effects and the embedded dice component.`);
}
