import {createRequire} from 'node:module';
import {writeFile,readFile} from 'node:fs/promises';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const p=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>console.error(e.message));
 await p.goto(`http://127.0.0.1:${server.address().port}/?bake-room=1`);await p.locator('#start-exploration').click();await p.waitForFunction(()=>!!window.LoftBake,null,{timeout:180000});
 const data=await p.evaluate(async()=>{
  const THREE=await import('./vendor/three.module.js'),m=await fetch('./assets/static-room/manifest.json').then(r=>r.json()),b=window.LoftBake;b.stop();
  b.camera.position.fromArray(m.camera.position);b.camera.quaternion.fromArray(m.camera.quaternion);b.camera.aspect=1/3;b.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(3*Math.tan(THREE.MathUtils.degToRad(m.camera.fov)/2)));b.camera.updateProjectionMatrix();b.camera.updateMatrixWorld(true);
  b.renderer.setPixelRatio(1);b.renderer.setSize(1600,4800,false);
  b.scene.traverse(o=>{if(o.userData.tablePropId==='windchime')o.visible=false;});b.firewood.flame.root.visible=false;b.scene.getObjectByName('Flickering Firelight Reflections').visible=false;b.firewood.flame.root.traverse(o=>{if(o.isLight)o.intensity=0;});
  b.lighting.invalidate();b.renderer.render(b.scene,b.camera);return b.renderer.domElement.toDataURL('image/png');
 });
 await sharp(Buffer.from(data.split(',')[1],'base64')).webp({quality:92,effort:6}).toFile('assets/static-room/room-surround.webp');
 console.log('Saved ceiling and floor at the existing horizontal field of view.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
