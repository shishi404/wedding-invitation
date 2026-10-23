import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.ogg':'audio/ogg','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    const path=resolve(root,relative);
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
const port=Number(process.env.PORT||4175);
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请关闭旧预览或通过 PORT 设置其他端口。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
