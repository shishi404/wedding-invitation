import {readFile,writeFile,mkdir,copyFile,stat,rm} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {deliveryFiles} from './runtime-delivery.mjs';
import {compressible,encodeBytes} from './http-compression.mjs';
const root=import.meta.dirname,output=resolve(root,'output/site-release');
// The old standalone dandelion invitation is no longer a published page.
for(const name of ['dandelion.html','dandelion.html.br','dandelion.html.gz'])await rm(resolve(output,name),{force:true});
const sourceManifest=JSON.parse(await readFile(resolve(root,'output/http-compressed/manifest.json'),'utf8')).files;
const files=await deliveryFiles();files.add('preview.mjs');files.add('http-compression.mjs');
const manifest={},inventory=[];
for(const path of files){
 const source=resolve(root,path),target=resolve(output,path);if(!target.startsWith(output+sep))throw Error('Invalid release path');
 await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
 const bytes=await readFile(source),sha=createHash('sha256').update(bytes).digest('hex');
 inventory.push({path,bytes:bytes.length,sha256:sha});
 if(!compressible(path)||bytes.length<1024||path==='dice-browser.js')continue;
 const entry={sourceBytes:bytes.length,mtime:(await stat(target)).mtimeMs,etag:`W/"${sha}"`};
 for(const encoding of ['br','gzip']){
  const saved=sourceManifest[path],valid=saved?.etag===entry.etag,encoded=valid?await readFile(resolve(root,saved[encoding].path)):await encodeBytes(bytes,encoding);
  const name=path+(encoding==='br'?'.br':'.gz');await writeFile(resolve(output,name),encoded);entry[encoding]={path:name,bytes:encoded.length};
 }
 manifest[path]=entry;
}
await mkdir(resolve(output,'output/http-compressed'),{recursive:true});
await writeFile(resolve(output,'output/http-compressed/manifest.json'),JSON.stringify({files:manifest},null,2));
await writeFile(resolve(output,'release-files.json'),JSON.stringify({created:new Date().toISOString(),files:inventory,audioReencoded:false},null,2));
console.log(JSON.stringify({release:'output/site-release',files:files.size,rawMB:inventory.reduce((n,f)=>n+f.bytes,0)/1e6,precompressedFiles:Object.keys(manifest).length,audioUnchanged:true}));
