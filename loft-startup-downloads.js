import {assetCatalog} from './loft-asset-profile.js';

export function sceneAssetProfile(){
  const choice=new URLSearchParams(location.search).get('geometry');
  const phone=matchMedia('(max-width:760px)').matches||matchMedia('(pointer:coarse) and (max-height:760px)').matches||navigator.userAgentData?.mobile===true;
  return ['mobile','desktop'].includes(choice)?choice:phone?'mobile':'desktop';
}

const downloads=new Map();
export function preloadSceneDownloads(){
  const {roomModels}=assetCatalog(sceneAssetProfile());
  // Only stage the first batch: bounded memory, no model parsing or WebGL work.
  for(const url of ['./assets/study-loft-layout.json',roomModels.room.url,roomModels.desk.url,roomModels.fireplace.url]){
    if(downloads.has(url))continue;
    // Record failures as values until boot consumes them, including on slow intros.
    downloads.set(url,fetch(url).then(response=>{
      if(!response.ok)throw Error('书房资源下载失败');
      return response.arrayBuffer();
    }).then(data=>({data}),error=>({error})));
  }
}

export function takeSceneDownload(url){
  const pending=downloads.get(url);
  downloads.delete(url);
  return pending;
}
