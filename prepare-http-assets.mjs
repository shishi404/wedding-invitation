import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deliveryFiles} from './runtime-delivery.mjs';
import {compressible,encodeBytes} from './http-compression.mjs';
const directory='output/http-compressed';await mkdir(directory,{recursive:true});
const files={};let original=0,brTotal=0,gzTotal=0;
for(const path of await deliveryFiles()){
 if(!compressible(path)||path==='dice-browser.js')continue;
 const bytes=await readFile(path);if(bytes.length<1024)continue;
 const sha=createHash('sha256').update(bytes).digest('hex'),info=await stat(path);
 const entry={sourceBytes:bytes.length,mtime:info.mtimeMs,etag:`W/"${sha}"`};
 for(const encoding of ['br','gzip']){
  const encoded=await encodeBytes(bytes,encoding),file=`${directory}/${sha}.${encoding==='br'?'br':'gz'}`;await writeFile(file,encoded);entry[encoding]={path:file,bytes:encoded.length};
 }
 files[path]=entry;original+=bytes.length;brTotal+=entry.br.bytes;gzTotal+=entry.gzip.bytes;
}
await writeFile(directory+'/manifest.json',JSON.stringify({created:new Date().toISOString(),files},null,2));
console.log(JSON.stringify({preparedFiles:Object.keys(files).length,rawMB:original/1e6,brotliMB:brTotal/1e6,gzipMB:gzTotal/1e6,audioExcluded:true}));
