// Render interaction geometry separately from the artwork: no antialiasing or palette quantization.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const layout=JSON.parse(await readFile('assets/static-room/manifest.json','utf8'));
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const dir='assets/static-room',size=1600;await mkdir('output/static-room/picking-qa',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'reduce'});
 await p.goto(`http://127.0.0.1:${server.address().port}/?bake-room=1`);await p.locator('#start-exploration').click();await p.waitForFunction(()=>!!window.LoftBake,null,{timeout:180000});
 const setup=await p.evaluate(async({layout,size})=>{
  const THREE=await import('./vendor/three.module.js'),{STATIC_PICKING_COLORS:colors}=await import('./static-room-picking.js');
  const b=window.LoftBake;b.stop();b.camera.aspect=layout.camera.aspect;b.camera.fov=layout.camera.fov;b.camera.position.fromArray(layout.camera.position);b.camera.quaternion.fromArray(layout.camera.quaternion);b.camera.updateProjectionMatrix();b.camera.updateMatrixWorld(true);b.scene.updateMatrixWorld(true);
  const items={};b.scene.traverse(o=>{if(o.userData.tablePropId)items[o.userData.tablePropId]=o;});b.items=items;b.originalNotebook=items['alchemical-book'].children[0];
  b.firewood.flame.root.visible=false;b.scene.getObjectByName('Flickering Firelight Reflections').visible=false;
  const render=new THREE.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});render.setPixelRatio(1);render.setSize(size,size,false);render.outputColorSpace=THREE.SRGBColorSpace;render.toneMapping=THREE.NoToneMapping;
  const materials=new Map(),p=new THREE.Vector3(),inv=items['little-prince-pendant'].matrixWorld.clone().invert(),bounds=new THREE.Box3();
  items['little-prince-pendant'].children[0].traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])bounds.expandByPoint(p.set(x,y,z).applyMatrix4(o.matrixWorld).applyMatrix4(inv));});
  const center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3()),points=[];
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2;p.set(center.x+extent.x*.58*Math.cos(a),bounds.max.y,center.z+extent.z*.58*Math.sin(a)).applyMatrix4(items['little-prince-pendant'].matrixWorld).project(b.camera);points.push([(p.x+1)/2,(1-p.y)/2]);}
  const regions=[{id:'little-prince-pendant',points}];
  const palette=new Map(colors.map(c=>[c.id,new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...c.rgb.map(v=>v/255),THREE.SRGBColorSpace),toneMapped:false,side:THREE.DoubleSide,polygonOffset:c.id==='single-sticky-note',polygonOffsetFactor:-3,polygonOffsetUnits:-3})]));
  const black=new THREE.MeshBasicMaterial({color:0,toneMapped:false,side:THREE.DoubleSide});
  b.capturePicking=()=>{
   const saved=[],background=b.scene.background;b.scene.background=new THREE.Color(0);
   b.scene.traverse(o=>{if(!o.isMesh)return;let parent=o;while(parent&&!parent.userData.tablePropId)parent=parent.parent;saved.push([o,o.material,o.visible]);o.material=palette.get(parent?.userData.tablePropId)||black;if(o.name==='桌面接触阴影'||/shadow|Contact/i.test(o.name))o.visible=false;});
   render.render(b.scene,b.camera);const image=render.domElement.toDataURL('image/png');for(const [o,material,visible]of saved){o.material=material;o.visible=visible;}b.scene.background=background;return image;
  };
  // Reference probes come from raycasting real geometry, not from reading the color map.
  const ray=new THREE.Raycaster(),pos=new THREE.Vector2(),projected={};
  const trace=(u,v)=>{ray.setFromCamera(pos.set(u*2-1,1-v*2),b.camera);for(const h of ray.intersectObjects(Object.values(items),true)){let o=h.object,owner=null,visible=true;while(o){if(!o.visible)visible=false;if(o.userData.tablePropId)owner=o.userData.tablePropId;o=o.parent;}if(visible&&owner)return owner;}return null;};
  b.tracePicking=trace;
  const probes=[];
  for(const {id}of colors){const bb=new THREE.Box3().setFromObject(items[id]),ps=[];for(const x of [bb.min.x,bb.max.x])for(const y of [bb.min.y,bb.max.y])for(const z of [bb.min.z,bb.max.z]){p.set(x,y,z).project(b.camera);ps.push([(p.x+1)/2,(1-p.y)/2]);}
   const left=Math.max(0,Math.min(...ps.map(v=>v[0]))),right=Math.min(1,Math.max(...ps.map(v=>v[0]))),top=Math.max(0,Math.min(...ps.map(v=>v[1]))),bottom=Math.min(1,Math.max(...ps.map(v=>v[1]))),candidates=[];
   for(let yy=1;yy<30;yy++)for(let xx=1;xx<30;xx++){const u=left+(right-left)*xx/30,v=top+(bottom-top)*yy/30;if(trace(u,v)!==id)continue;const r=.0008;if([[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dy])=>trace(u+dx,v+dy)===id))candidates.push({point:[u,v],distance:(xx-15)**2+(yy-15)**2});}
   candidates.sort((a,b)=>a.distance-b.distance);if(!candidates.length)throw Error('找不到独立点击验证点：'+id);probes.push({id,point:candidates[0].point});
  }
  return {colors,regions,probes};
 },{layout,size});
 const decode=async value=>sharp(Buffer.from(value.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
 const base=await decode(await p.evaluate(()=>window.LoftBake.capturePicking()));
 // Reproduce the reported pendant-to-notebook failure against the former ID image.
 try{
  const old=await sharp('assets/static-room/hits.png').ensureAlpha().raw().toBuffer(),previous=layout.hitIds||[],color=setup.colors.find(c=>c.id==='little-prince-pendant').rgb,candidates=[];
  for(let i=0;i<base.length&&candidates.length<100;i+=4)if(base[i]===color[0]&&base[i+1]===color[1]&&base[i+2]===color[2]&&previous[old[i]-1]==='alchemical-book')candidates.push([((i/4)%size+.5)/size,(Math.floor(i/4/size)+.5)/size]);
  const point=await p.evaluate(points=>points.find(([u,v])=>window.LoftBake.tracePicking(u,v)==='little-prince-pendant'),candidates);
  if(point)setup.probes.push({id:'little-prince-pendant',point,regression:'Former antialiased ID decoded this pendant pixel as the notebook'});
 }catch{}
 if(!setup.probes.some(p=>p.regression)){
  const rgb=setup.colors.find(c=>c.id==='little-prince-pendant').rgb,points=[];
  for(let y=1;y<size-1&&points.length<100;y++)for(let x=1;x<size-1&&points.length<100;x++){const i=(y*size+x)*4;if(base[i]===rgb[0]&&base[i+1]===rgb[1]&&base[i+2]===rgb[2]&&!base[i-4]&&!base[i-3]&&!base[i-2])points.push([(x+.5)/size,(y+.5)/size]);}
  const point=await p.evaluate(points=>points.find(([u,v])=>window.LoftBake.tracePicking(u,v)==='little-prince-pendant'),points);if(point)setup.probes.push({id:'little-prince-pendant',point,regression:'Pendant silhouette edge, previously vulnerable to antialiased ID colors'});
 }
 const hash=b=>createHash('sha256').update(b).digest('hex').slice(0,12);
 const png=await sharp(base,{raw:{width:size,height:size,channels:4}}).png({compressionLevel:9,palette:false}).toBuffer();
 const mask=`hits-${hash(png)}.png`;await writeFile(`${dir}/${mask}`,png);
 const patches={},stateProbes=[];
 async function capturePatch(name){
  const data=await decode(await p.evaluate(()=>window.LoftBake.capturePicking())),diff=Buffer.alloc(data.length);let left=size,top=size,right=-1,bottom=-1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;if(data[i]!==base[i]||data[i+1]!==base[i+1]||data[i+2]!==base[i+2]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);data.copy(diff,i,i,i+4);}}
  if(right<left)return;
  const width=right-left+1,height=bottom-top+1,bytes=await sharp(diff,{raw:{width:size,height:size,channels:4}}).extract({left,top,width,height}).png({compressionLevel:9,palette:false}).toBuffer();
  const file=`pick-${name}-${hash(bytes)}.png`;await writeFile(`${dir}/${file}`,bytes);patches[name]={url:'./'+file,x:left,y:top,width,height};
  const id={'notebook-open':'alchemical-book','box-open':'painted-lacquer-jewelry-box'}[name];
  if(id){
   const rgb=setup.colors.find(c=>c.id===id).rgb,candidates=[];
   for(let y=top+2;y<bottom-2;y+=2)for(let x=left+2;x<right-2;x+=2){const i=(y*size+x)*4;if(data[i]===rgb[0]&&data[i+1]===rgb[1]&&data[i+2]===rgb[2]&&(base[i]!==rgb[0]||base[i+1]!==rgb[1]||base[i+2]!==rgb[2])&&x>size*.02&&y>size*.22&&y<size*.77)candidates.push([(x+.5)/size,(y+.5)/size]);}
   const point=await p.evaluate(({points,id})=>points.find(([u,v])=>[[0,0],[.001,0],[-.001,0],[0,.001],[0,-.001]].every(([x,y])=>window.LoftBake.tracePicking(u+x,v+y)===id)),{points:candidates,id});
   if(!point)throw Error('缺少状态变化的几何验证点：'+name);stateProbes.push({id,point,state:name==='box-open'?{drawerOpen:true}:{notebookOpen:true,notebookResult:'success'}});
  }
 }
 for(const [key,id]of [['without-musicbox','octagonal-music-box'],['without-pendant','little-prince-pendant'],['without-windchime','windchime']]){await p.evaluate(id=>window.LoftBake.items[id].visible=false,id);await capturePatch(key);await p.evaluate(id=>window.LoftBake.items[id].visible=true,id);}
 await p.evaluate(async()=>{const b=window.LoftBake;b.props.setNotebookOpen({...await b.getInspectionModel('notebook-opening'),result:'success'});});await capturePatch('notebook-open');
 await p.evaluate(()=>{const b=window.LoftBake,root=b.items['alchemical-book'];for(const child of [...root.children])if(child.name!=='桌面接触阴影')root.remove(child);root.add(b.originalNotebook);});
 await p.evaluate(()=>window.LoftBake.props.setJewelryState({open:true}));await capturePatch('box-open');
 const metadata={schema:2,width:size,height:size,mask:'./'+mask,...setup,patches,stateProbes};
 // Verify every rendered pixel has an exact ID/background; blended colors are forbidden.
 const valid=new Set([0,...setup.colors.map(c=>(c.rgb[0]<<16)|(c.rgb[1]<<8)|c.rgb[2])]);
 for(let i=0;i<base.length;i+=4)if(!valid.has((base[i]<<16)|(base[i+1]<<8)|base[i+2]))throw Error('点击图含有混合颜色');
 await writeFile(`${dir}/picking-v2.json`,JSON.stringify(metadata,null,2));console.log(JSON.stringify({mask,patches:Object.keys(patches),probes:setup.probes}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
