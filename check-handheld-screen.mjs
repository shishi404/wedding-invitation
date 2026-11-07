import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage();
  await page.route('**/screen-test',route=>route.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/screen-test`);
  const results=await page.evaluate(async()=>{
    const THREE=await import('/vendor/three.module.js');
    const {GLTFLoader}=await import('/vendor/three-addons/loaders/GLTFLoader.js');
    const {MeshoptDecoder}=await import('/vendor/meshopt_decoder.js');
    const {assetCatalog}=await import('/loft-asset-profile.js');
    const {createHandheldMedia}=await import('/study-handheld.js');
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),results=[];
    // Reproduce browsers that expose this API but never deliver its callbacks
    // for a video used only as a WebGL texture.
    HTMLVideoElement.prototype.requestVideoFrameCallback=()=>1;
    HTMLVideoElement.prototype.cancelVideoFrameCallback=()=>{};
    const renderer=new THREE.WebGLRenderer();renderer.setSize(256,256);
    const target=new THREE.WebGLRenderTarget(256,256),pixel=new Uint8Array(4);target.texture.colorSpace=THREE.SRGBColorSpace;
    for(const profile of ['desktop','mobile']){
      const asset=assetCatalog(profile).tableProps.find(a=>a.id==='white-3ds-xl');
      const root=(await loader.loadAsync(asset.url)).scene;
      const host=document.createElement('div');document.body.append(host);
      const media=createHandheldMedia({requestRender(){}});await media.prepare();media.begin(host);media.bind(root);
      const upper=root.getObjectByName('Screen_Upper'),surface=upper.getObjectByName('Handheld Video Surface');
      root.updateMatrixWorld(true);upper.geometry.computeBoundingBox();
      const center=upper.localToWorld(upper.geometry.boundingBox.getCenter(new THREE.Vector3()));
      const normal=new THREE.Vector3(0,1,0).transformDirection(upper.matrixWorld);
      const size=upper.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(upper.getWorldScale(new THREE.Vector3()));
      const scene=new THREE.Scene();scene.add(root);
      const camera=new THREE.PerspectiveCamera(38,1,.001,20);
      camera.up.copy(new THREE.Vector3(0,0,-1).transformDirection(upper.matrixWorld));
      camera.position.copy(center).addScaledVector(normal,size.x*2);camera.lookAt(center);camera.updateMatrixWorld(true);
      const hits=new THREE.Raycaster(camera.position,normal.clone().negate()).intersectObject(root,true);
      // A solid diagnostic color separates model occlusion from video decoding.
      const map=surface.material.map;surface.material.map=null;surface.material.color.set(0x00ff00);surface.material.needsUpdate=true;
      renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,128,128,1,1,pixel);
      const solid=Array.from(pixel);
      surface.material.map=map;surface.material.color.set(0xffffff);surface.material.needsUpdate=true;
      await new Promise((resolve,reject)=>{if(media.video.readyState>=2)resolve();else {media.video.addEventListener('loadeddata',resolve,{once:true});media.video.addEventListener('error',reject,{once:true});}});
      media.update();renderer.render(scene,camera);
      media.video.currentTime=2;
      await new Promise(resolve=>media.video.addEventListener('seeked',resolve,{once:true}));
      media.video.pause();media.update?.();
      renderer.render(scene,camera);renderer.readRenderTargetPixels(target,128,128,1,1,pixel);
      const canvas=document.createElement('canvas');canvas.width=media.video.videoWidth;canvas.height=media.video.videoHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(media.video,0,0);
      const reference=Array.from(ctx.getImageData(canvas.width/2,canvas.height/2,1,1).data);
      results.push({profile,hits:hits.slice(0,4).map(hit=>hit.object.name),solid,video:Array.from(pixel),reference,display:getComputedStyle(media.video).display});
      media.end();media.video.remove();host.remove();
    }
    target.dispose();renderer.dispose();return results;
  });
  for(const result of results){
    console.log(JSON.stringify(result));
    assert.ok(result.solid[1]>200&&result.solid[0]<20,'Model must not cover the video surface');
    assert.ok(result.video.slice(0,3).some(value=>value>20),'Decoded video must reach the screen texture');
    assert.ok(result.video.slice(0,3).every((value,i)=>Math.abs(value-result.reference[i])<15),'Screen must show the current frame even when video frame callbacks stall');
    assert.notEqual(result.display,'none','Video source stays in the layout for Safari');
  }
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
