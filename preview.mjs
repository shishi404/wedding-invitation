import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,extname,sep} from 'node:path';
import {execFile} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {compressible,createCompressedSender} from './http-compression.mjs';
const root=resolve(import.meta.dirname);
// A live process can still run an old server while serving newly edited files.
// Reuse a port only when the server implementation and checkout both match.
const previewVersion=createHash('sha256').update(await readFile(new URL(import.meta.url))).update(root).digest('hex').slice(0,16);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2','.ttf':'font/ttf'};
export function createPreviewServer({compression=true}={}){const send=createCompressedSender(root);return http.createServer(async(req,res)=>{
  res.setHeader('X-Study-Preview',previewVersion);
  try{
    const url=new URL(req.url,'http://localhost');
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    const path=resolve(root,relative);
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    if(/\.(?:mp4|mp3|ogg|wav)$/i.test(path)){
      const {size}=await stat(path),headers={'Content-Type':extname(path)==='.mp4'?'video/mp4':types[extname(path)],'Content-Disposition':'inline','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
      let start=0,end=size-1,status=200;
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!match||!match[1]&&!match[2]){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
        start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
        end=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
        if(start>=size||start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
      }
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);
      if(req.method==='HEAD')res.end();
      else createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
      return;
    }
    if(compression&&compressible(path)){await send(req,res,path,types[extname(path)]||'application/octet-stream');return;}
    const bytes=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});}
function openBrowser(url){
  const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
  execFile(command,args,{windowsHide:true},error=>{if(error)console.error(`无法自动打开浏览器，请手动访问 ${url}`);});
}
export async function samePreview(url){
  try{
    const response=await fetch(new URL('index.html',url),{signal:AbortSignal.timeout(2000)});
    return response.ok&&response.headers.get('x-study-preview')===previewVersion&&await response.text()===await readFile(resolve(root,'index.html'),'utf8');
  }catch{return false;}
}
export function startPreview({port=4175,open=false,launch=openBrowser}={}){
  const server=createPreviewServer();
  server.on('listening',()=>{
    const url=`http://127.0.0.1:${server.address().port}/`;console.log(`Local: ${url}`);
    if(open)launch(url);
  });
  server.on('error',async error=>{
    if(error.code==='EADDRINUSE'&&open){
      const url=`http://127.0.0.1:${port}/`;
      if(await samePreview(url)){console.log(`Local: ${url} (already running)`);launch(url);return;}
      // A different application owns the preferred port; choose a free one.
      server.listen(0,'127.0.0.1');return;
    }
    console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请关闭旧预览或通过 PORT 设置其他端口。`:error.message);process.exitCode=1;
  });
  server.listen(port,'127.0.0.1');return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
const port=Number(process.env.PORT||4175);
startPreview({port,open:process.argv.includes('--open')});
}
