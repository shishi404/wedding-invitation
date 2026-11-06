// Bake the approved desktop scene; source models and mobile inspection assets stay intact.
import {createRequire} from 'node:module';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {assetCatalog} from './loft-asset-profile.js';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir='assets/static-room';await mkdir(dir,{recursive:true});await mkdir('output/static-room',{recursive:true});
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const bytes=data=>Buffer.from(data.split(',')[1],'base64');
try{
 const p=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>console.error(e.message));
 await p.goto(`http://127.0.0.1:${server.address().port}/?bake-room=1`);await p.locator('#start-exploration').click();
 await p.waitForFunction(()=>!!window.LoftBake,null,{timeout:180000});
 const metadata=await p.evaluate(async()=>{
  const THREE=await import('./vendor/three.module.js'),b=window.LoftBake;b.stop();
  b.renderer.setPixelRatio(1);b.renderer.setSize(3200,3200,false);b.camera.aspect=1;b.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(49)/2)*16/9));b.camera.updateProjectionMatrix();b.camera.projectionMatrix.elements[8]=b.camera.projectionMatrix.elements[9]=0;b.camera.projectionMatrixInverse.copy(b.camera.projectionMatrix).invert();b.scene.updateMatrixWorld(true);b.camera.updateMatrixWorld(true);
  const items={};b.scene.traverse(o=>{if(o.userData.tablePropId)items[o.userData.tablePropId]=o;});b.items=items;
  const project=o=>{const box=new THREE.Box3().setFromObject(o),ps=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).project(b.camera);ps.push([(v.x+1)/2,(1-v.y)/2]);}return {x:Math.min(...ps.map(p=>p[0])),y:Math.min(...ps.map(p=>p[1])),right:Math.max(...ps.map(p=>p[0])),bottom:Math.max(...ps.map(p=>p[1]))};};
  const wind=items.windchime.children[0].children[0];
  const fire=b.scene.getObjectByName('Placed Fireplace');
  const metadata={version:1,width:3200,height:3200,camera:{position:b.camera.position.toArray(),quaternion:b.camera.quaternion.toArray(),fov:b.camera.fov,aspect:1},desk:{root:b.desk.root.matrixWorld.toArray(),surface:b.desk.surface.matrixWorld.toArray(),nativeSize:b.desk.nativeSize.toArray()},windchimeMatrix:wind.matrixWorld.toArray(),flameAnchor:b.firewood.root.getObjectByName('FireEffectsAnchor').matrixWorld.toArray(),fireplaceMatrix:fire.matrixWorld.toArray(),fireplaceGap:b.firewood.getState().effects?JSON.parse(JSON.stringify(b.firewood.getState())):null,hits:Object.fromEntries(Object.entries(items).map(([id,o])=>[id,project(o)]))};
  metadata.fireplaceGap=(await fetch('./assets/study-loft-layout.json').then(r=>r.json())).fireplace.gap;
  metadata.flame=b.firewood.flame.getLayout();
  items.windchime.visible=false;b.firewood.flame.root.visible=false;b.scene.getObjectByName('Flickering Firelight Reflections').visible=false;
  b.firewood.flame.root.traverse(o=>{if(o.isLight)o.intensity=0;});
  b.capture=()=>{b.stop();b.lighting.invalidate();b.renderer.render(b.scene,b.camera);return b.renderer.domElement.toDataURL('image/png');};
  return metadata;
 });
 const base=bytes(await p.evaluate(()=>window.LoftBake.capture()));
 await writeFile('output/static-room/desktop-source.png',base);
 await sharp(base).webp({quality:94,effort:6}).toFile(`${dir}/room.webp`);
 const baseRaw=await sharp(base).ensureAlpha().raw().toBuffer();
 const layers={};
 async function patch(name,action){
  const png=bytes(await p.evaluate(action));const raw=await sharp(png).ensureAlpha().raw().toBuffer();
  let left=3200,top=3200,right=0,bottom=0;const output=Buffer.alloc(raw.length);
  for(let y=0;y<3200;y++)for(let x=0;x<3200;x++){const i=(y*3200+x)*4;if(Math.max(...[0,1,2].map(k=>Math.abs(raw[i+k]-baseRaw[i+k])))>3){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);raw.copy(output,i,i,i+3);output[i+3]=255;}}
  if(right<=left||bottom<=top)throw Error('Empty state layer: '+name);
  const width=right-left+1,height=bottom-top+1;await sharp(output,{raw:{width:3200,height:3200,channels:4}}).extract({left,top,width,height}).webp({lossless:true,effort:6}).toFile(`${dir}/${name}.webp`);
  layers[name]={url:`./${name}.webp`,x:left/3200,y:top/3200,width:width/3200,height:height/3200};console.log(name,width,height);
 }
 await patch('without-musicbox',()=>{const b=window.LoftBake;b.items['octagonal-music-box'].visible=false;const v=b.capture();b.items['octagonal-music-box'].visible=true;return v;});
 await patch('without-pendant',()=>{const b=window.LoftBake;b.items['little-prince-pendant'].visible=false;const v=b.capture();b.items['little-prince-pendant'].visible=true;return v;});
 for(const [name,state]of Object.entries({'box-open':{open:true},'box-empty':{open:true,envelopeVisible:false},'box-broken':{lockBroken:true},'box-open-broken':{open:true,lockBroken:true},'box-empty-broken':{open:true,envelopeVisible:false,lockBroken:true}})){
  await p.evaluate(state=>window.LoftBake.props.setJewelryState(state),state);
  await patch(name,()=>window.LoftBake.capture());
 }
 await p.evaluate(()=>window.LoftBake.props.setJewelryState({open:false}));
 for(const result of ['critical','success','failure','fumble']){
  await p.evaluate(async result=>{const b=window.LoftBake;const model=await b.getInspectionModel('notebook-opening');b.props.setNotebookOpen({...model,result});},result);
  await patch(`notebook-${result}`,()=>window.LoftBake.capture());
 }
 // The color ID image makes picking independent of downloading any object model.
 const hits=bytes(await p.evaluate(async()=>{
  const THREE=await import('./vendor/three.module.js'),b=window.LoftBake,ids=Object.keys(b.items),bg=b.scene.background;b.items.windchime.visible=true;
  b.props.setJewelryState({open:false});
  b.scene.background=new THREE.Color(0);b.renderer.toneMapping=THREE.NoToneMapping;b.renderer.shadowMap.enabled=false;
  b.scene.traverse(o=>{if(!o.isMesh)return;let parent=o;while(parent&&!parent.userData.tablePropId)parent=parent.parent;const index=parent?ids.indexOf(parent.userData.tablePropId)+1:0;const color=new THREE.Color().setRGB(index/255,0,0,THREE.SRGBColorSpace);o.material=new THREE.MeshBasicMaterial({color,toneMapped:false,side:THREE.DoubleSide});if(o.name==='桌面接触阴影'||o.name.includes('shadow')||o.name.includes('Contact'))o.visible=false;});
  b.renderer.render(b.scene,b.camera);return b.renderer.domElement.toDataURL('image/png');
 }));
 await sharp(hits).resize(1600,1600,{kernel:'nearest'}).png({palette:true}).toFile(`${dir}/hits.png`);
 metadata.hitMapSize=1600;metadata.hitIds=Object.keys(metadata.hits);metadata.layers=layers;metadata.background='./room.webp';metadata.hitMap='./hits.png';metadata.windchime='./windchime.glb';
 await writeFile(`${dir}/manifest.json`,JSON.stringify(metadata,null,2));
 // Compress the full desktop windchime without simplifying geometry or animation.
 const {NodeIO}=await import('./output/loft-viewer/mobile-tools/node_modules/@gltf-transform/core/dist/index.js');
 const {ALL_EXTENSIONS,EXTMeshoptCompression}=await import('./output/loft-viewer/mobile-tools/node_modules/@gltf-transform/extensions/dist/index.js');
 const {MeshoptEncoder,MeshoptDecoder}=await import('./output/loft-viewer/mobile-tools/node_modules/meshoptimizer/index.js');await MeshoptEncoder.ready;await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
 const source=assetCatalog('desktop').tableProps.find(a=>a.id==='windchime').url;
 const doc=await io.read(source.split('?')[0]);
 for(const texture of doc.getRoot().listTextures()){const data=texture.getImage();if(data){texture.setImage(await sharp(data).webp({quality:92,effort:6}).toBuffer());texture.setMimeType('image/webp');}}
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.FILTER});
 await io.write(`${dir}/windchime.glb`,doc);
 console.log('Static room baked with full desktop geometry, shared lighting, independent state patches and losslessly compressed windchime geometry.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
