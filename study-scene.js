import * as THREE from 'three';

// All geometry and textures are local. Fixed camera, modest polygon counts and
// warm baked-looking materials keep the room close to an early Source-era scene.
const world=document.querySelector('#world');
const status=document.querySelector('#render-status');
const mobile=()=>innerWidth<=700;
let renderer, scene, camera, raf=0, last=0, recordPlaying=false, suspended=false;
const targets={}, anchors={}, glows=[];
const drawerGroup=new THREE.Group(), recordDisc=new THREE.Group();
let seed=14021;
const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0,...extra});
function texture(draw,size=512){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function woodTexture(dark=false){return texture((c,s)=>{
  c.fillStyle=dark?'#30271e':'#60422c';c.fillRect(0,0,s,s);
  for(let i=0;i<1700;i++){const y=rand()*s;c.strokeStyle=`rgba(${rand()>.45?'161,115,65':'12,10,6'},${.03+rand()*.17})`;c.lineWidth=rand()*2+.3;c.beginPath();c.moveTo(0,y);for(let x=0;x<=s;x+=16)c.lineTo(x,y+Math.sin(x*.019+i)*(.4+rand()*2));c.stroke();}
  for(let i=0;i<650;i++){const x=rand()*s,y=rand()*s;c.strokeStyle=`rgba(216,183,113,${rand()*.16})`;c.lineWidth=.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*34,y+(rand()-.5)*5);c.stroke();}
  const g=c.createRadialGradient(240,180,30,256,256,340);g.addColorStop(0,'#0000');g.addColorStop(1,'#09070377');c.fillStyle=g;c.fillRect(0,0,s,s);
});}
const grain=woodTexture(),darkGrain=woodTexture(true);
const wood=mat(0xffffff,{map:grain,bumpMap:grain,bumpScale:.028,roughness:.87});
const darkWood=mat(0xffffff,{map:darkGrain,bumpMap:darkGrain,bumpScale:.022});
const brass=mat(0x9c7b43,{metalness:.68,roughness:.45});
const darkBrass=mat(0x625537,{metalness:.55,roughness:.62});
const black=mat(0x141511,{roughness:.68});
const paper=mat(0xb2a27a),leather=mat(0x332b20);
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,material,parent,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z);}
function cylinder(rt,rb,h,material,parent,x=0,y=0,z=0,n=20){return mesh(new THREE.CylinderGeometry(rt,rb,h,n),material,parent,x,y,z);}
function ball(rx,ry,rz,material,parent,x=0,y=0,z=0){const b=mesh(new THREE.SphereGeometry(1,16,12),material,parent,x,y,z);b.scale.set(rx,ry,rz);return b;}
function rod(a,b,r,material,parent){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);const m=cylinder(r,r,dir.length(),material,parent,...start.clone().add(end).multiplyScalar(.5).toArray(),10);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return m;}
function ring(radius,tube,material,parent,x=0,y=0,z=0){return mesh(new THREE.TorusGeometry(radius,tube,6,40),material,parent,x,y,z);}
function outline(w,h,d,parent,x=0,y=0,z=0){const material=new THREE.LineBasicMaterial({color:0xe6bb65,transparent:true,opacity:.78});const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)),material);line.position.set(x,y,z);parent.add(line);glows.push(material);return line;}
function setTarget(name,group,point){targets[name]=group;anchors[name]=point;group.traverse(o=>{if(o.isMesh)o.userData.target=name;});}

function makeDesk(){
  box(7.2,.2,3.3,wood,scene,0,2.4,0);
  box(7.25,.07,3.36,darkWood,scene,0,2.29,0);
  box(7,.53,3.1,darkWood,scene,0,1.99,-.06);
  for(const x of [-2.5,2.5]){
    box(1.88,.43,.07,wood,scene,x,2.02,1.53);box(1.72,.29,.03,darkWood,scene,x,2.02,1.575);
    for(const off of [-.91,.91])box(.035,.47,.1,wood,scene,x+off,2.02,1.59);
  }
  for(const x of [-3.16,3.16])for(const z of [-1.19,1.19]){
    cylinder(.14,.09,1.58,darkWood,scene,x,.89,z,8);cylinder(.2,.2,.1,wood,scene,x,1.65,z,12);cylinder(.17,.14,.13,wood,scene,x,.18,z,12);box(.3,.35,.3,darkWood,scene,x,1.95,z);
  }
  rod([-3.16,.47,-1.19],[3.16,.47,-1.19],.065,darkWood,scene);
  drawerGroup.position.set(0,2.02,1.57);scene.add(drawerGroup);
  box(3.01,.45,.09,wood,drawerGroup);box(2.8,.28,.04,darkWood,drawerGroup,0,0,.07);
  for(const y of [-.2,.2])box(2.99,.024,.035,brass,drawerGroup,0,y,.065);
  for(const x of [-1.48,1.48])box(.025,.42,.035,brass,drawerGroup,x,0,.065);
  const plate=cylinder(.065,.075,.02,brass,drawerGroup,0,.07,.11,12);plate.rotation.x=Math.PI/2;
  const hole=ball(.018,.035,.006,black,drawerGroup,0,.075,.126);
  for(const x of [-.22,.22]){const knob=cylinder(.055,.065,.045,brass,drawerGroup,x,-.045,.15);knob.rotation.x=Math.PI/2;}
  const handle=ring(.22,.025,brass,drawerGroup,0,-.04,.16);handle.scale.y=.5;
  outline(3.025,.46,.11,drawerGroup,0,0,.04);setTarget('drawer',drawerGroup,new THREE.Vector3(0,2.06,1.71));
}

async function makeNotebook(){
  const group=new THREE.Group();group.position.set(-1.8,2.53,.62);group.rotation.y=-.16;scene.add(group);
  const pages=texture((c,s)=>{c.fillStyle='#b3a47c';c.fillRect(0,0,s,s);for(let i=0;i<120;i++){c.fillStyle=`rgba(48,35,15,${rand()*.3})`;c.fillRect(0,rand()*s,s,1+rand());}for(let i=0;i<60;i++){c.fillStyle='#4d351420';c.fillRect(rand()*s,rand()*s,rand()*40,rand()*10);}});
  box(1.1,.1,1.38,mat(0xffffff,{map:pages}),group,0,0,0);
  box(1.16,.04,1.45,leather,group,0,-.065,0);
  const cover=texture((c,s)=>{
    c.fillStyle='#2b241b';c.fillRect(0,0,s,s);
    for(let i=0;i<19000;i++){const shade=rand()>.5?'151,124,80':'0,0,0';c.fillStyle=`rgba(${shade},${rand()*.16})`;c.fillRect(rand()*s,rand()*s,rand()*3+1,rand()*2+1);}
    c.strokeStyle='#8c775559';c.lineWidth=2;c.strokeRect(18,15,s-36,s-30);
    for(let i=0;i<90;i++){c.strokeStyle=`rgba(191,160,104,${.08+rand()*.18})`;c.beginPath();let x=rand()*s,y=rand()*s;c.moveTo(x,y);c.lineTo(x+rand()*45,y+rand()*12-6);c.stroke();}
    for(let i=0;i<23;i++){const x=rand()>.5?s-rand()*20:rand()*20,y=rand()*s;c.fillStyle='#8a7352';c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*25,y+9);c.lineTo(x-rand()*15,y+21);c.fill();}
  });
  const coverShape=new THREE.Shape();
  [[-.585,-.73],[.3,-.73],[.34,-.69],[.43,-.72],[.55,-.67],[.585,-.52],[.56,-.46],[.585,-.4],[.585,.57],[.53,.61],[.55,.68],[.43,.73],[-.585,.73]].forEach(([x,y],i)=>i?coverShape.lineTo(x,y):coverShape.moveTo(x,y));coverShape.closePath();
  const coverGeometry=new THREE.ExtrudeGeometry(coverShape,{depth:.045,bevelEnabled:false});
  const positions=coverGeometry.attributes.position,uv=coverGeometry.attributes.uv;
  for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)+.585)/1.17,(positions.getY(i)+.73)/1.46);
  const wornCover=mesh(coverGeometry,mat(0x9d8b6c,{map:cover,bumpMap:cover,bumpScale:.015}),group,0,.052,0);wornCover.rotation.x=-Math.PI/2;
  box(.07,.18,1.46,leather,group,-.55,0,0);
  for(let i=0;i<6;i++){const stitch=ring(.06,.006,mat(0x8e7953),group,-.55,.03,-.58+i*.23);stitch.rotation.x=Math.PI/2;stitch.scale.x=.7;}
  for(let i=0;i<4;i++){const slip=box(.26,.007,.3,paper,group,.2+i*.07,.004+i*.012,.64+i*.025);slip.rotation.y=(rand()-.5)*.5;}
  outline(1.19,.19,1.48,group,0,.015,0);setTarget('notebook',group,new THREE.Vector3(-1.8,2.75,.64));
  try{
    const img=new Image();img.src='assets/elder-sign.png';await img.decode();
    const seal=texture((c,s)=>{
      c.drawImage(img,0,0,s,s);c.globalCompositeOperation='source-in';c.fillStyle='#9e8a62';c.fillRect(0,0,s,s);
      c.globalCompositeOperation='destination-out';
      for(let i=0;i<90;i++){c.globalAlpha=.3+rand()*.65;c.fillRect(rand()*s,rand()*s,rand()*36+2,rand()*4+1);}
      c.globalAlpha=1;
    });
    const symbol=mesh(new THREE.PlaneGeometry(.79,.65),new THREE.MeshBasicMaterial({map:seal,transparent:true,opacity:.57,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),group,0,.106,-.02);symbol.rotation.x=-Math.PI/2;
  }catch(error){console.warn('Notebook seal could not be loaded.',error);}
}

function makeRecord(){
  const group=new THREE.Group();group.position.set(1.87,2.52,-.35);scene.add(group);
  box(1.9,.38,1.46,wood,group,0,.12,0);box(1.96,.05,1.5,darkWood,group,0,.34,0);box(1.75,.025,1.3,mat(0x3a3528),group,0,.38,0);
  for(const x of [-.74,.74])for(const z of [-.53,.53])cylinder(.065,.065,.09,black,group,x,-.1,z);
  recordDisc.position.set(-.22,.42,0);group.add(recordDisc);
  cylinder(.61,.61,.035,black,recordDisc,0,0,0,56);
  for(let i=0;i<17;i++){const r=ring(.21+i*.022,.0025,mat(i%2?0x36362e:0x242820),recordDisc,0,.02,0);r.rotation.x=Math.PI/2;}
  cylinder(.17,.17,.006,mat(0x8e633f),recordDisc,0,.025,0,32);cylinder(.019,.019,.05,brass,recordDisc,0,.05,0);
  cylinder(.09,.09,.08,brass,group,.7,.43,-.46);
  rod([.7,.49,-.46],[.57,.49,.25],.02,brass,group);rod([.57,.49,.25],[.39,.48,.35],.02,brass,group);box(.11,.055,.07,black,group,.37,.46,.36);
  cylinder(.07,.07,.05,brass,group,.74,.43,.49);
  for(const x of [-.76,.76]){const screw=cylinder(.013,.013,.012,brass,group,x,.41,-.56,8);}
  box(1.4,.022,.025,darkBrass,group,0,.06,.741);
  outline(1.98,.5,1.52,group,0,.18,0);setTarget('record',group,new THREE.Vector3(1.87,3.06,-.28));
}

function makeLamp(){
  const group=new THREE.Group();group.position.set(-2.73,2.5,-1.02);scene.add(group);
  cylinder(.34,.4,.08,brass,group);cylinder(.24,.3,.06,darkBrass,group,0,.07,0);rod([0,.08,0],[0,1.32,0],.04,brass,group);rod([0,1.32,0],[.4,1.5,0],.04,brass,group);
  const shade=new THREE.Group();shade.position.set(.49,1.42,0);shade.rotation.z=.09;group.add(shade);
  const shape=new THREE.SphereGeometry(.48,24,10,0,Math.PI*2,0,Math.PI/2);const hood=mesh(shape,new THREE.MeshStandardMaterial({color:0x4d5739,metalness:.55,roughness:.45,side:THREE.DoubleSide}),shade);hood.scale.set(1,.65,.72);
  const lightmat=new THREE.MeshBasicMaterial({color:0xffd69b});const bulb=ball(.14,.065,.12,lightmat,shade,0,.04,0);
  const spot=new THREE.SpotLight(0xffd097,20,9,Math.PI/2.8,.65,1.5);spot.position.set(-2.24,3.93,-1.02);spot.target.position.set(-.9,2.4,.55);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.001;scene.add(spot,spot.target);
  const glow=new THREE.PointLight(0xffc47f,4,3,1.8);glow.position.copy(spot.position);glow.position.y-=.16;scene.add(glow);
}

function makeSphere(){
  const group=new THREE.Group();group.position.set(-.1,2.51,-1.05);scene.add(group);
  cylinder(.2,.26,.07,darkBrass,group);cylinder(.08,.16,.12,brass,group,0,.09,0);cylinder(.035,.07,.31,brass,group,0,.28,0);
  for(let i=0;i<4;i++){const r=ring(.33,.013,i%2?brass:darkBrass,group,0,.71,0);r.rotation.set(i*.45,Math.PI/3*i,i*.32);}
  ball(.055,.055,.055,brass,group,0,.71,0);rod([0,.31,0],[0,1.1,0],.012,brass,group);
}

function makeBull(){
  const group=new THREE.Group();group.position.set(.76,2.5,-1.02);group.rotation.y=-.12;scene.add(group);
  const furTex=texture((c,s)=>{c.fillStyle='#ca852e';c.fillRect(0,0,s,s);for(let i=0;i<11000;i++){const x=rand()*s,y=rand()*s;c.strokeStyle=rand()>.5?'#f2b65b55':'#69391144';c.lineWidth=1+rand();c.beginPath();c.moveTo(x,y);c.lineTo(x+(rand()-.5)*4,y+rand()*10+3);c.stroke();}},256);
  const fur=mat(0xffffff,{map:furTex,bumpMap:furTex,bumpScale:.008,roughness:.9});
  const cream=mat(0xd7c6a6),horn=mat(0x4e3a31),eye=mat(0x1c1712),brow=mat(0x583621);
  ball(.205,.285,.14,fur,group,0,.43,0);ball(.19,.21,.14,fur,group,0,.79,0);
  for(const side of [-1,1]){
    const arm=ball(.067,.2,.068,fur,group,side*.22,.46,0);arm.rotation.z=side*.16;
    ball(.052,.065,.045,cream,group,side*.248,.29,.015);
    ball(.075,.15,.075,fur,group,side*.094,.17,0);ball(.076,.048,.097,cream,group,side*.096,.047,.025);
    const ear=ball(.1,.044,.04,fur,group,side*.23,.86,.005);ear.rotation.z=side*.3;
    ball(.062,.025,.032,mat(0xb47a58),group,side*.24,.865,.025);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.12,.92,-.015),new THREE.Vector3(side*.22,1.005,-.025),new THREE.Vector3(side*.27,1.11,-.055)]);
    mesh(new THREE.TubeGeometry(curve,8,.037,8,false),horn,group);
    const tip=mesh(new THREE.ConeGeometry(.037,.12,8),horn,group,side*.278,1.125,-.056);tip.rotation.z=-side*.22;
    ball(.044,.025,.025,cream,group,side*.074,.805,.132);ball(.023,.011,.01,eye,group,side*.074,.8,.154);
    const eyebrow=box(.077,.018,.015,brow,group,side*.076,.859,.134);eyebrow.rotation.z=side*.12;
  }
  ball(.133,.087,.08,cream,group,0,.7,.135);
  for(const side of [-1,1])ball(.023,.017,.008,horn,group,side*.047,.72,.207);
  rod([-.075,.659,.194],[.075,.659,.194],.004,brow,group);
  rod([0,.39,-.12],[0,.2,-.19],.015,fur,group);ball(.024,.044,.024,horn,group,0,.18,-.19);
  // Deliberately no target tag, interaction outline or click handler on this gift.
}

function makeProps(){
  const bookColors=[0x333c2c,0x573b2a];
  for(let i=0;i<2;i++){
    const g=new THREE.Group();g.position.set(-1.77,2.52+i*.17,-1);g.rotation.y=i?.04:-.1;scene.add(g);
    const cover=mat(bookColors[i]);box(1.05,.12,.64,paper,g,0,.07,0);box(1.12,.025,.7,cover,g,0,.145,0);box(1.12,.025,.7,cover,g);box(1.1,.16,.035,cover,g,0,.075,.34);
    for(const x of [-.4,.4])box(.015,.15,.006,brass,g,x,.07,.363);
  }
  cylinder(.12,.105,.32,darkBrass,scene,-2.39,2.66,-.61);
  for(let i=0;i<4;i++)rod([-2.45+i*.035,2.68,-.6],[-2.48+i*.065,3.13+rand()*.1,-.6],.009,mat(0x9c7750),scene);
  const frame=new THREE.Group();frame.position.set(-.91,2.91,-1.22);frame.rotation.x=-.1;frame.rotation.y=.06;scene.add(frame);
  box(.57,.78,.045,darkWood,frame);box(.51,.72,.015,brass,frame,0,0,.03);
  const photograph=texture((c,s)=>{c.fillStyle='#807963';c.fillRect(0,0,s,s);const g=c.createRadialGradient(250,180,30,256,256,300);g.addColorStop(0,'#bbb29a');g.addColorStop(1,'#403e32');c.fillStyle=g;c.fillRect(0,0,s,s);c.fillStyle='#484c3c';c.fillRect(0,350,s,170);for(const [x,y] of [[220,240],[300,250]]){c.beginPath();c.ellipse(x,y,25,32,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(x-20,y+30);c.lineTo(x-45,420);c.lineTo(x+45,420);c.lineTo(x+20,y+30);c.fill();}for(let i=0;i<3000;i++){c.fillStyle=`rgba(20,18,9,${rand()*.1})`;c.fillRect(rand()*s,rand()*s,2,2);}},256);
  const image=mesh(new THREE.PlaneGeometry(.44,.64),mat(0xffffff,{map:photograph}),frame,0,0,.042);
}

function makeRoom(){
  const wallTex=texture((c,s)=>{c.fillStyle='#3d4136';c.fillRect(0,0,s,s);for(let i=0;i<18000;i++){c.fillStyle=`rgba(${rand()>.5?'160,144,108':'0,0,0'},${rand()*.06})`;c.fillRect(rand()*s,rand()*s,rand()*8+1,rand()*3+1);}},256);
  box(24,9,.2,mat(0xffffff,{map:wallTex}),scene,0,3,-2.25);
  box(24,1.9,.13,darkWood,scene,0,.95,-2.06);
  box(24,.07,.17,wood,scene,0,1.94,-2.03);
  for(let x=-10;x<11;x+=1.2)box(.055,1.8,.09,wood,scene,x,1,-1.97);
  const floorTexture=woodTexture(true);floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(4,6);
  box(24,.1,24,mat(0xffffff,{map:floorTexture}),scene,0,-.07,0);
  const carpet=texture((c,s)=>{c.fillStyle='#3f3028';c.fillRect(0,0,s,s);for(let i=0;i<9;i++){c.strokeStyle=i%2?'#6c583c':'#353b2b';c.lineWidth=5;c.strokeRect(i*8+8,i*8+8,s-i*16-16,s-i*16-16);}for(let x=90;x<s-80;x+=35)for(let y=90;y<s-80;y+=35){c.fillStyle='#78634444';c.beginPath();c.moveTo(x,y-12);c.lineTo(x+9,y);c.lineTo(x,y+12);c.lineTo(x-9,y);c.fill();}});
  const rug=mesh(new THREE.PlaneGeometry(8,5),mat(0xffffff,{map:carpet}),scene,0,.001,.7);rug.rotation.x=-Math.PI/2;
  // Bookshelf silhouette at the edge of the camera frame.
  box(2.4,4.7,.5,darkWood,scene,4.5,2.35,-1.82);
  for(const y of [.45,1.4,2.35,3.3,4.25]){box(2.4,.08,.57,wood,scene,4.5,y,-1.64);for(let i=0;i<11;i++){const h=.48+rand()*.32;box(.11+rand()*.05,h,.27,mat([0x4c3829,0x353b2c,0x554631,0x2b3029][i%4]),scene,3.5+i*.19,y+h/2+.05,-1.61);}}
  const painting=new THREE.Group();painting.position.set(0,4.5,-2.06);scene.add(painting);box(2,1.15,.09,darkWood,painting);box(1.83,.98,.025,mat(0x353d32),painting,0,0,.06);for(const x of [-.96,.96])box(.035,1.09,.03,brass,painting,x,0,.08);
  const win=mesh(new THREE.PlaneGeometry(1.5,2.8),new THREE.MeshBasicMaterial({color:0x495a61}),scene,-4.3,3.7,-2.12);
  for(const x of [-5.05,-4.3,-3.55])box(.055,2.8,.08,darkWood,scene,x,3.7,-2.04);for(const y of [2.3,3.7,5.1])box(1.55,.055,.08,darkWood,scene,-4.3,y,-2.04);
}

function positionHotspots(){
  for(const [name,point]of Object.entries(anchors)){
    const p=point.clone().project(camera);const b=document.querySelector(`[data-object="${name}"]`);
    b.style.setProperty('--x',`${(p.x*.5+.5)*100}%`);b.style.setProperty('--y',`${(-p.y*.5+.5)*100}%`);
  }
}
function resize(){if(!renderer)return;const w=world.clientWidth,h=world.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  if(mobile()){
    camera.fov=68;camera.position.set(0,5.75,7.6);camera.lookAt(0,2.15,-.1);
    targets.notebook?.position.set(-1.28,2.53,.6);targets.notebook?.scale.setScalar(.95);
    targets.record?.position.set(1.35,2.52,-.3);targets.record?.scale.setScalar(.85);
    anchors.notebook?.set(-1.28,2.75,.65);anchors.record?.set(1.35,3,-.23);
  }else{
    camera.fov=43;camera.position.set(.12,5.35,7.8);camera.lookAt(0,2.24,-.12);
    targets.notebook?.position.set(-1.8,2.53,.62);targets.notebook?.scale.setScalar(1);
    targets.record?.position.set(1.87,2.52,-.35);targets.record?.scale.setScalar(1);
    anchors.notebook?.set(-1.8,2.75,.64);anchors.record?.set(1.87,3.06,-.28);
  }
  camera.updateProjectionMatrix();camera.updateMatrixWorld();positionHotspots();render();
}
function render(){if(renderer&&!suspended)renderer.render(scene,camera);}
async function loadSurfaceTextures(){
  // Sample only bare tabletop from the approved art reference. The mark on the
  // pictured book is never sampled; the actual seal uses the user's original PNG.
  try{
    const image=new Image();image.src='assets/study-reference.png';await image.decode();
    const surface=texture((c,s)=>{c.drawImage(image,610,443,270,103,0,0,s,s);c.fillStyle='#291d1638';c.fillRect(0,0,s,s);});
    wood.map=surface;wood.bumpMap=surface;wood.bumpScale=.018;wood.needsUpdate=true;
    const darkSurface=texture((c,s)=>{c.drawImage(image,610,443,270,103,0,0,s,s);c.fillStyle='#12170fb0';c.fillRect(0,0,s,s);});
    darkWood.map=darkSurface;darkWood.bumpMap=darkSurface;darkWood.bumpScale=.01;darkWood.needsUpdate=true;render();
  }catch(error){console.warn('Using procedural wood textures.',error);}
}
function animate(time){raf=0;if(document.hidden||suspended)return;if(recordPlaying){const dt=Math.min((time-last)/1000,.08);recordDisc.rotation.y+=dt*1.7;render();}last=time;if(recordPlaying)raf=requestAnimationFrame(animate);}
function startAnimation(){last=performance.now();if(!raf)raf=requestAnimationFrame(animate);}
function positionFallback(){
  const w=world.clientWidth,h=world.clientHeight,scale=Math.min(w/1536,h/1024),iw=1536*scale,ih=1024*scale;
  for(const [name,x,y]of [['notebook',.23,.47],['record',.78,.36],['drawer',.5,.65]]){
    const button=document.querySelector(`[data-object="${name}"]`);button.style.setProperty('--x',`${((w-iw)/2+x*iw)/w*100}%`);button.style.setProperty('--y',`${((h-ih)/2+y*ih)/h*100}%`);
  }
}
function fallback(message){world.classList.remove('ready');world.classList.add('fallback');status.hidden=false;status.textContent=message;positionFallback();}
addEventListener('resize',()=>{if(world.classList.contains('fallback'))positionFallback();});

try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile()?1.5:1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;world.append(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x262a22);scene.fog=new THREE.Fog(0x25271f,12,25);camera=new THREE.PerspectiveCamera(43,1,.1,40);
  scene.add(new THREE.HemisphereLight(0xa7b6b6,0x45351d,1.45));
  const moon=new THREE.DirectionalLight(0xb3c9d9,1.35);moon.position.set(-4,6,4);scene.add(moon);
  const fill=new THREE.DirectionalLight(0xf8d8a2,.8);fill.position.set(3,4,5);scene.add(fill);
  makeRoom();makeDesk();const notebookReady=makeNotebook();makeRecord();makeLamp();makeSphere();makeBull();makeProps();
  resize();world.classList.add('ready');notebookReady.then(render);loadSurfaceTextures();
  addEventListener('resize',resize);
  addEventListener('study-state',event=>{drawerGroup.position.z=event.detail.drawerOpen?1.83:1.57;anchors.drawer.z=drawerGroup.position.z+.14;positionHotspots();render();});
  addEventListener('record-state',()=>{recordPlaying=!!window.InvitationAudio?.recordPlaying;if(recordPlaying)startAnimation();else render();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(recordPlaying)startAnimation();else render();});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();suspended=true;cancelAnimationFrame(raf);fallback('画面已切换为静态预览，仍可点击物品继续探索。');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{suspended=false;status.hidden=true;world.classList.remove('fallback');world.classList.add('ready');resize();if(recordPlaying)startAnimation();});
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function pick(event){const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(scene.children,true)[0]?.object.userData.target;}
  renderer.domElement.addEventListener('pointermove',event=>{renderer.domElement.style.cursor=pick(event)?'pointer':'default';});
  renderer.domElement.addEventListener('click',event=>{const target=pick(event);if(target)window.dispatchEvent(new CustomEvent('study-object',{detail:target}));});
}catch(error){console.warn('Study 3D unavailable; using image-backed interaction.',error);fallback('此设备使用静态场景，仍可点击三个标记继续探索。');}
