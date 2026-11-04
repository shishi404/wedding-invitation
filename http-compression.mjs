import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompress,gzip,constants} from 'node:zlib';
import {promisify} from 'node:util';
const br=promisify(brotliCompress),gz=promisify(gzip);
export const compressible=path=>/\.(?:html|js|mjs|css|json|svg|gltf|glb|bin|wasm)$/i.test(path);
export async function encodeBytes(bytes,encoding){
 return encoding==='br'?br(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}):gz(bytes,{level:6});
}
function encodingFor(header=''){
 const values=new Map(header.toLowerCase().split(',').map(item=>{const [name,...params]=item.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return [name,q?Number(q.trim().slice(2)):1];}));
 return ['br','gzip'].map(name=>({name,q:values.get(name)??values.get('*')??0})).filter(e=>e.q>0).sort((a,b)=>b.q-a.q)[0]?.name;
}
export function createCompressedSender(root){
 const cache=new Map();let manifestTime=-1,manifest={};
 const manifestPath=resolve(root,'output/http-compressed/manifest.json');
 async function prepared(){
  try{const info=await stat(manifestPath);if(info.mtimeMs!==manifestTime){manifest=JSON.parse(await readFile(manifestPath,'utf8')).files;manifestTime=info.mtimeMs;}}catch{manifest={};}
  return manifest;
 }
 async function resource(path){
  const info=await stat(path),key=path+':'+info.size+':'+info.mtimeMs;
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const local=relative(root,path).split(sep).join('/'),entry=(await prepared())[local];
  const prebuilt=entry?.sourceBytes===info.size&&entry?.mtime===info.mtimeMs?entry:null;
  const bytes=prebuilt?null:await readFile(path),etag=prebuilt?.etag||`W/"${createHash('sha256').update(bytes).digest('hex')}"`;
  const value={bytes,etag,size:info.size,prebuilt,encodings:new Map()};
  cache.set(key,value);
  return value;
 }
 function trim(){
  const used=()=>[...cache.values()].reduce((sum,value)=>sum+(value.bytes?.length||0)+[...value.encodings.values()].reduce((n,data)=>n+(Buffer.isBuffer(data)?data.length:0),0),0);
  while(cache.size>1&&used()>96*1024*1024)cache.delete(cache.keys().next().value);
 }
 return async function send(req,res,path,type){
  const entry=await resource(path),headers={'Content-Type':type,'Cache-Control':'no-cache','Vary':'Accept-Encoding','ETag':entry.etag};
  if(req.headers['if-none-match']?.split(',').map(v=>v.trim()).some(v=>v===entry.etag||v==='*')){res.writeHead(304,headers);res.end();return;}
  const encoding=entry.size>=1024?encodingFor(req.headers['accept-encoding']):null;
  let body;
  if(encoding){
   if(!entry.encodings.has(encoding)){
    const pending=(async()=>{
     const saved=entry.prebuilt?.[encoding];let data;
     try{if(saved)data=await readFile(resolve(root,saved.path));}catch{}
     if(!data){entry.bytes ||= await readFile(path);data=await encodeBytes(entry.bytes,encoding);}
     entry.encodings.set(encoding,data);trim();return data;
    })();entry.encodings.set(encoding,pending);
   }
   body=await entry.encodings.get(encoding);
   if(body.length<entry.size)headers['Content-Encoding']=encoding;else body=null;
  }
  if(!body)body=entry.bytes||await readFile(path);
  headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);trim();
 };
}
