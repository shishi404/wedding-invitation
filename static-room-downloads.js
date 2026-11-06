// First-frame assets and inspection files share one download cache.
const downloads=new Map();
const mediaURLs=new Map();
window.InvitationMediaSource=value=>mediaURLs.get(new URL(value,document.baseURI).href)||value;
window.addEventListener('pagehide',()=>{for(const value of mediaURLs.values())URL.revokeObjectURL(value.split('#')[0]);});
// Carry the release through the manifest and every baked image. Reusing an
// unversioned image URL can mix a cached old room with a newly downloaded script.
const roomVersion=new URL(import.meta.url).searchParams.get('v')||'lit-art-ending-20261106-3';
function versionedURL(value,base){const url=new URL(value,base);url.searchParams.set('v',roomVersion);return url.href;}
export const staticManifestURL=versionedURL('./assets/static-room/manifest.json',import.meta.url);
export const staticPickingURL=versionedURL('./assets/static-room/picking-v2.json',import.meta.url);
export function downloadRoomFile(url,{retry=false}={}){
 url=new URL(url,document.baseURI).href;
 if(retry)downloads.delete(url);
 if(!downloads.has(url))downloads.set(url,fetch(url,{signal:AbortSignal.timeout(90000)}).then(r=>{if(!r.ok)throw Error('资源下载失败：'+new URL(url).pathname);return r.arrayBuffer();}).catch(e=>{downloads.delete(url);throw e;}));
 return downloads.get(url);
}
let first;
export function preloadStaticRoom({retry=false}={}){
 if(retry)first=null;
 if(!first)first=(async()=>{
  const [layout,picking]=await Promise.all([staticManifestURL,staticPickingURL].map(async value=>JSON.parse(new TextDecoder().decode(await downloadRoomFile(value)))));
  if(picking.schema!==2)throw Error('点击区域版本不匹配，请刷新页面');
  const manifest={...layout,hitMap:picking.mask,hitIds:picking.colors.map(c=>c.id),picking};
  const url=value=>versionedURL(value,staticManifestURL);
  await Promise.all([manifest.background,manifest.hitMap,manifest.windchime,...Object.values(picking.patches).map(p=>p.url)].map(value=>downloadRoomFile(url(value))));
  return {manifest,url};
 })();
 return first;
}
export function backgroundRoomDownloads(urls,onProgress=()=>{},{strict=false}={}){
 const pending=[...new Set(urls)],total=pending.length;let done=0;
 return Promise.all([0,1].map(async()=>{while(pending.length){const url=pending.shift();try{const data=await downloadRoomFile(url),absolute=new URL(url,document.baseURI).href;if(/\.(?:ogg|wav|mp3|webp)(?:\?|$)/.test(absolute)&&!mediaURLs.has(absolute)){const extension=new URL(absolute).pathname.split('.').pop(),type={ogg:'audio/ogg',wav:'audio/wav',mp3:'audio/mpeg',webp:'image/webp'}[extension];mediaURLs.set(absolute,URL.createObjectURL(new Blob([data],{type}))+'#'+new URL(absolute).pathname.split('/').pop());}}catch(error){if(strict)throw error;}onProgress(++done,total);}}));
}
