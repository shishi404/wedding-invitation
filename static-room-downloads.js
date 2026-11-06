// First-frame assets and inspection files share one download cache.
const downloads=new Map();
const mediaURLs=new Map();
window.InvitationMediaSource=value=>mediaURLs.get(new URL(value,document.baseURI).href)||value;
window.addEventListener('pagehide',()=>{for(const value of mediaURLs.values())URL.revokeObjectURL(value.split('#')[0]);});
export const staticManifestURL=new URL('./assets/static-room/manifest.json',import.meta.url).href;
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
  const manifest=JSON.parse(new TextDecoder().decode(await downloadRoomFile(staticManifestURL)));
  const url=value=>new URL(value,staticManifestURL).href;
  await Promise.all([manifest.background,manifest.hitMap,manifest.windchime].map(value=>downloadRoomFile(url(value))));
  return {manifest,url};
 })();
 return first;
}
export function backgroundRoomDownloads(urls,onProgress=()=>{}){
 const pending=[...new Set(urls)],total=pending.length;let done=0;
 return Promise.all([0,1].map(async()=>{while(pending.length){const url=pending.shift();try{const data=await downloadRoomFile(url),absolute=new URL(url,document.baseURI).href;if(/\.(?:ogg|webp)(?:\?|$)/.test(absolute)&&!mediaURLs.has(absolute)){const type=absolute.includes('.ogg')?'audio/ogg':'image/webp';mediaURLs.set(absolute,URL.createObjectURL(new Blob([data],{type}))+'#'+new URL(absolute).pathname.split('/').pop());}}catch{}onProgress(++done,total);}}));
}
