/* 轻量 WebGL 文字粒子。真实三维坐标、独立旋转、透视；无引擎或外部运行依赖。 */
export function mountDandelionEnding(host){
 // Inline readers can open in an already loaded room; ensure their own current styles.
 const href=new URL('./launch.css?v=dandelion-mist-blue-4',import.meta.url).href;
 let stylesheet=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>new URL(link.href).pathname===new URL(href).pathname);
 if(!stylesheet){stylesheet=document.createElement('link');stylesheet.rel='stylesheet';document.head.append(stylesheet);}
 if(stylesheet.href!==href)stylesheet.href=href;
 const layer=document.createElement('section');layer.className='dandelion-ending';layer.tabIndex=-1;layer.setAttribute('aria-label','汉字蒲公英 · 期待 婚礼见');
 layer.innerHTML='<canvas class="dandelion-stem" aria-hidden="true"></canvas><canvas class="dandelion-seeds" aria-hidden="true"></canvas><button class="dandelion-touch" type="button" aria-label="轻触，吹散汉字蒲公英">轻触</button><h2 class="sr-only dandelion-title">期待 婚礼见</h2><div class="dandelion-announcement" aria-hidden="true"><div class="dandelion-couple"></div><div class="dandelion-date"></div></div><p class="sr-only dandelion-status" role="status" aria-live="polite"></p>';
 host.append(layer);let animation;
 const observer=new IntersectionObserver(entries=>{
  const visible=entries[0].isIntersecting;
  if(visible&&!animation)animation=animateDandelion(layer);
  animation?.setVisible(visible);
 });observer.observe(layer);
 return ()=>{observer.disconnect();animation?.dispose();layer.remove();};
}
function animateDandelion(layer){
const canvas=layer.querySelector('.dandelion-seeds'),stem=layer.querySelector('.dandelion-stem'),pen=stem.getContext('2d'),trigger=layer.querySelector('.dandelion-touch'),announcement=layer.querySelector('.dandelion-announcement'),status=layer.querySelector('.dandelion-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false});
let fallback=gl?null:canvas.getContext('2d'),W=390,H=422,D=1,VW=4.25,VH=4.6,frame=0,begin=null,epoch=performance.now(),done=false,pausedAt=null;
const chars=Array.from('期待婚礼见永爱心之与你相遇光风花月日木水山云白飞梦禾亻彳氵忄扌艹宀辶纟灬阝彡丿丨乀丶夕竹言雨羽人一二三十口小大子女生长久'),phrase=Array.from('期待 婚礼见');
const phraseWidths=phrase.map(ch=>ch===' '?.5:1),phraseUnits=phraseWidths.reduce((sum,width)=>sum+width,0);
const phraseOffsets=phrase.map((ch,i)=>phraseWidths.slice(0,i).reduce((sum,width)=>sum+width,0)+phraseWidths[i]/2-phraseUnits/2);
let seed=417;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const mix=(a,b,t)=>a+(b-a)*t,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const seeds=Array.from({length:460},(_,i)=>{let y=1-2*(i+.5)/460,a=i*2.3999632297,r=Math.sqrt(1-y*y);return {x:r*Math.cos(a)*.77,y:y*.77,z:r*Math.sin(a)*.77,ch:Math.floor(rand()*chars.length),delay:rand()*2.7,speed:.7+rand()*.8,spin:(rand()-.5)*4,phase:rand()*6.28,size:.095+rand()*.045}});
// 每个字符独立放大 15%～25%，只在初始化时取值，避免动画中字号闪动。
seeds.forEach(p=>{p.size*=1.15+rand()*.1});
// 标题汉字来自花冠种子；中间保留一个空格的位置。
phrase.forEach((ch,slot)=>{
 if(ch===' ')return;
 const targetY=.5-slot*.2;
 const p=seeds.filter(p=>p.z>.25&&p.phraseIndex===undefined).sort((a,b)=>Math.abs(a.y-targetY)-Math.abs(b.y-targetY))[0];
 p.ch=chars.indexOf(ch);p.phraseIndex=slot;
});
let arrivalOrder=[],arrivalTimes=Array(phrase.length).fill(5.2);
function shuffleArrivals(){
 const previous=arrivalOrder.join('');
 do{
  arrivalOrder=phrase.map((ch,i)=>ch===' '?null:i).filter(i=>i!==null);
  for(let i=4;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arrivalOrder[i],arrivalOrder[j]]=[arrivalOrder[j],arrivalOrder[i]]}
 }while(arrivalOrder.join('')==='01345'||arrivalOrder.join('')===previous);
 arrivalOrder.forEach((slot,rank)=>{arrivalTimes[slot]=3.2+rank*.5});
}
const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=512;const ink=atlas.getContext('2d');ink.fillStyle='#fff';ink.font=`400 46px ${getComputedStyle(layer).getPropertyValue('--invitation-type').trim()||'"SimSun","Songti SC","STSong",serif'}`;ink.textAlign='center';ink.textBaseline='middle';chars.forEach((c,i)=>ink.fillText(c,(i%16)*64+32,Math.floor(i/16)*64+33));
let program,buffer,texture,locations,values=new Float32Array((seeds.length+70)*6*12),cursor=0;
if(gl){
 const vs=`attribute vec3 aCenter;attribute vec2 aCorner;attribute vec2 aUV;attribute vec3 aAngle;attribute float aSize;attribute float aAlpha;uniform float uAspect;uniform float uViewHeight;varying vec2 vUV;varying float vAlpha;varying float vBlur;void main(){vec3 p=vec3(aCorner*aSize,0.0);float c=cos(aAngle.x),s=sin(aAngle.x);p.yz=mat2(c,s,-s,c)*p.yz;c=cos(aAngle.y);s=sin(aAngle.y);p.xz=mat2(c,s,-s,c)*p.xz;c=cos(aAngle.z);s=sin(aAngle.z);p.xy=mat2(c,s,-s,c)*p.xy;p+=aCenter;float perspective=8.0/(8.0-p.z);gl_Position=vec4(p.x*2.0/(uViewHeight*uAspect)*perspective,p.y*2.0/uViewHeight*perspective,0.0,1.0);vUV=aUV;vAlpha=aAlpha;vBlur=max(0.0,abs(p.z)-0.65)*0.00065;}`;
 const fs=`precision mediump float;uniform sampler2D uAtlas;varying vec2 vUV;varying float vAlpha;varying float vBlur;void main(){float a=texture2D(uAtlas,vUV).a;if(vBlur>0.0){a=a*.5+.125*(texture2D(uAtlas,vUV+vec2(vBlur,0.0)).a+texture2D(uAtlas,vUV-vec2(vBlur,0.0)).a+texture2D(uAtlas,vUV+vec2(0.0,vBlur)).a+texture2D(uAtlas,vUV-vec2(0.0,vBlur)).a);}gl_FragColor=vec4(1.0,1.0,1.0,a*vAlpha);}`;
 function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh}
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('WebGL program failed');gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);locations=[['aCenter',3,0],['aCorner',2,3],['aUV',2,5],['aAngle',3,7],['aSize',1,10],['aAlpha',1,11]];locations.forEach(([name,n,offset])=>{const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,48,offset*4)});texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
}
const corners=[[-.5,-.5],[.5,-.5],[-.5,.5],[-.5,.5],[.5,-.5],[.5,.5]];
function glyph(x,y,z,index,size,alpha,rx=0,ry=0,rz=0){if(alpha<.005)return;const u=(index%16)/16,v=Math.floor(index/16)/8;if(gl){for(const [cx,cy] of corners){values[cursor++]=x;values[cursor++]=y;values[cursor++]=z;values[cursor++]=cx;values[cursor++]=cy;values[cursor++]=u+(cx+.5)/16;values[cursor++]=v+(.5-cy)/8;values[cursor++]=rx;values[cursor++]=ry;values[cursor++]=rz;values[cursor++]=size;values[cursor++]=alpha}}else{const p=8/(8-z),px=W/2+x*H/VH*p,py=H/2-y*H/VH*p;fallback.save();fallback.translate(px,py);fallback.rotate(-rz);fallback.scale(Math.max(.08,Math.abs(Math.cos(ry))),1);fallback.globalAlpha=alpha;const s=size*H/VH*p;fallback.drawImage(atlas,(index%16)*64,Math.floor(index/16)*64,64,64,-s/2,-s/2,s,s);fallback.restore()}}
function center(clock){const breeze=reduced?0:Math.sin(clock*.52)*.17+Math.sin(clock*.23+1.2)*.045;const swing=reduced?0:Math.sin(clock*.65)*.025;return {x:-VW*.235+breeze+swing,y:.05+(reduced?0:Math.sin(clock*.4)*.012)}}
function drawStem(c){
 pen.clearRect(0,0,W,H);
 const to=(x,y)=>[W/2+x*H/VH,H/2-y*H/VH],head=to(c.x,c.y),root=to(-VW*.235-.58,-VH*.55);
 // 保留原有花茎的起点、弯曲控制点、终点和粗细，只调整截面的受光方向。
 const tip=[head[0]+1,head[1]+8],b1=[root[0]+14,root[1]-H*.12],b2=[head[0]-H*.06,head[1]+H*.18];
 const point=t=>{const s=1-t;return [s*s*s*root[0]+3*s*s*t*b1[0]+3*s*t*t*b2[0]+t*t*t*tip[0],s*s*s*root[1]+3*s*s*t*b1[1]+3*s*t*t*b2[1]+t*t*t*tip[1]]};
 const tangent=t=>{const s=1-t,dx=3*s*s*(b1[0]-root[0])+6*s*t*(b2[0]-b1[0])+3*t*t*(tip[0]-b2[0]),dy=3*s*s*(b1[1]-root[1])+6*s*t*(b2[1]-b1[1])+3*t*t*(tip[1]-b2[1]),length=Math.hypot(dx,dy);return [-dy/length,dx/length]};
 const stemWidth=Math.max(4.2,Math.min(6,H/175)),edge=(t,side)=>{const p=point(t),n=tangent(t),w=stemWidth/2;return [p[0]+n[0]*w*side,p[1]+n[1]*w*side]};
 // 左侧受光、右侧背光；渐变始终跟随花茎截面，不形成独立高光线。
 for(let i=0;i<28;i++){
  const t0=Math.max(0,(i-.18)/28),t1=Math.min(1,(i+1.18)/28),a=edge(t0,-1),b=edge(t0,1),d=edge(t1,-1),e=edge(t1,1);
  const color=pen.createLinearGradient(a[0],a[1],b[0],b[1]);
  color.addColorStop(0,'#999855');color.addColorStop(.22,'#7f8145');color.addColorStop(.55,'#5d6635');color.addColorStop(.82,'#394725');color.addColorStop(1,'#202d1a');
  pen.fillStyle=color;pen.beginPath();pen.moveTo(...a);pen.lineTo(...b);pen.lineTo(...e);pen.lineTo(...d);pen.closePath();pen.fill();
 }
 // 花托下面是一小段暗棕色总苞和茎的连接，阴影向下逐渐并入绿色花茎。
 const neck=pen.createLinearGradient(head[0],head[1]+3,head[0],head[1]+15);
 neck.addColorStop(0,'#231b1bcc');neck.addColorStop(.55,'#332920aa');neck.addColorStop(1,'#302b1d00');
 pen.fillStyle=neck;pen.beginPath();pen.moveTo(head[0]-4.1,head[1]+2.5);
 pen.bezierCurveTo(head[0]-2.6,head[1]+5,head[0]-1.9,head[1]+10,head[0]+.2,head[1]+15);
 pen.bezierCurveTo(head[0]+1.6,head[1]+10,head[0]+3.8,head[1]+7,head[0]+4.7,head[1]+2.5);
 pen.closePath();pen.fill();
 // 近处总苞片较长，左右两侧按透视缩短；根部藏在花托的暗面里。
 const bracts=[[-6.2,4.3,-7.1],[-4.3,6.6,-5.1],[-2.2,9,-1.7],[.1,10.2,.6],[2.5,8.3,3],[5.1,5.5,5.9],[7,3.7,8]];
 for(const [offset,length,lean] of bracts){
  const x=head[0]+offset,y=head[1]+2.4,tipX=head[0]+lean,tipY=head[1]+length;
  const bract=pen.createLinearGradient(x,y,tipX,tipY);
  bract.addColorStop(0,offset<0?'#55583f':'#393c2f');bract.addColorStop(.55,offset<0?'#39392a':'#2d2525');bract.addColorStop(1,'#211b1b');
  pen.fillStyle=bract;pen.beginPath();pen.moveTo(x-1.15,y);
  pen.quadraticCurveTo(x-1.2,head[1]+5,tipX,tipY);
  pen.quadraticCurveTo(x+.35,head[1]+5,x+1.05,y);
  pen.closePath();pen.fill();
 }
 const cap=pen.createRadialGradient(head[0]-4.1,head[1]-1.8,.5,head[0]+1.6,head[1]+1.7,10);
 cap.addColorStop(0,'#c8cab2');cap.addColorStop(.34,'#afb29a');cap.addColorStop(.69,'#808572');cap.addColorStop(1,'#4a5044');
 pen.fillStyle=cap;pen.beginPath();pen.ellipse(head[0],head[1]+.8,9.2,4.2,-.1,0,Math.PI*2);pen.fill();
 pen.save();pen.beginPath();pen.ellipse(head[0],head[1]+.8,9.2,4.2,-.1,0,Math.PI*2);pen.clip();
 const underside=pen.createLinearGradient(head[0],head[1]+.5,head[0],head[1]+5);
 underside.addColorStop(0,'#28251f00');underside.addColorStop(.45,'#28251f44');underside.addColorStop(1,'#201b1be0');
 pen.fillStyle=underside;pen.fillRect(head[0]-10,head[1],20,6);pen.restore();
}
let announcementAt=null;
const driftSources=seeds.filter(p=>p.x>.35&&Math.abs(p.z)<.45);
function render(clock,t){cursor=0;if(gl)gl.clear(gl.COLOR_BUFFER_BIT);else fallback.clearRect(0,0,W,H);const c=center(begin===null?clock:(begin-epoch)/1000);drawStem(center(clock));const titleWidth=Math.min(VW*.54,3.6),titleSize=titleWidth/phraseUnits*.96,titleX=VW*.155;
seeds.forEach((p,i)=>{let x=c.x+p.x,y=c.y+p.y,z=p.z,rx=.1*Math.sin(clock+p.phase),ry=.12*Math.cos(clock+p.phase),rz=.1*Math.sin(clock*.5+p.phase),size=p.size,alpha=.72+.28*(p.z+.77)/1.54;
 const idle=t===null&&!reduced?1:t!==null&&!reduced?1-smooth(t/.7):0;if(idle){x+=idle*Math.sin(clock*.9+p.phase)*.03;y+=idle*Math.cos(clock*.7+p.phase)*.018;rz+=idle*Math.sin(clock*.6+p.phase)*.045}
 if(t!==null&&p.phraseIndex!==undefined){
  // 从点击瞬间的屏幕位置直接移到落点，不叠加其他种子的风向曲线。
  const slot=p.phraseIndex,at=(begin-epoch)/1000,gather=smooth(t/arrivalTimes[slot]);
  const sourceX=c.x+p.x+(reduced?0:Math.sin(at*.9+p.phase)*.03),sourceY=c.y+p.y+(reduced?0:Math.cos(at*.7+p.phase)*.018);
  const sourcePerspective=8/(8-p.z);
  z=mix(p.z,0,gather);const perspective=8/(8-z);
  x=mix(sourceX*sourcePerspective,titleX+phraseOffsets[slot]*titleWidth/phraseUnits,gather)/perspective;
  y=mix(sourceY*sourcePerspective,.05,gather)/perspective;
  rx=.1*Math.sin(at+p.phase)*(1-gather);ry=.12*Math.cos(at+p.phase)*(1-gather);
  rz=(.1*Math.sin(at*.5+p.phase)+(reduced?0:Math.sin(at*.6+p.phase)*.045))*(1-gather);
  size=mix(p.size*sourcePerspective,titleSize,gather)/perspective;alpha=mix(alpha,1,gather);
 }else if(t!==null){const age=Math.max(0,t-p.delay),flow=smooth(age/5.5);x+=flow*(VW*1.35+2+p.speed);y+=Math.sin(age*p.speed+p.phase)*flow*.9+flow*(p.phase-3)*.20;z+=Math.sin(age*.8+p.phase)*flow*2.1;rx+=age*p.spin*.25*flow;ry+=age*p.spin*.7*flow;rz+=age*p.spin*.4*flow;alpha*=1-smooth((age-4.2)/1.6);
 }
 glyph(x,y,z,p.ch,size,alpha,rx,ry,rz);
});
// 复制花冠边缘的字符作独立粒子；出生后的位置不再跟随花冠摇摆。
if(!reduced&&(t===null||t<.8)){
 const emissionClock=begin===null?clock:(begin-epoch)/1000;
 for(let i=0;i<10;i++){
  const offset=.7+i*1.23+Math.sin(i*2.4)*.25,cycle=Math.floor((emissionClock-offset)/13.5);
  if(cycle<0)continue;
  const birth=offset+cycle*13.5,age=clock-birth,life=7.2+(i%3)*.55;
  if(age<0||age>life)continue;
  const p=driftSources[(i*19+cycle*7)%driftSources.length],origin=center(birth),phase=p.phase;
  const drift=(.16*age+.045*age*age)*(.85+(i%4)*.08);
  const x=origin.x+p.x+Math.sin(birth*.9+phase)*.03+drift;
  const y=origin.y+p.y+Math.cos(birth*.7+phase)*.018+age*.045+(Math.sin(age*.8+phase)-Math.sin(phase))*.1;
  const z=p.z+Math.sin(age*.4)*.18;
  const alpha=smooth(age/.35)*(1-smooth((age-life*.55)/(life*.45)))*.7*(t===null?1:1-smooth(t/.8));
  glyph(x,y,z,p.ch,p.size*.9,alpha,.1*Math.sin(birth+phase)+age*.08,.12*Math.cos(birth+phase)+age*.2,.1*Math.sin(birth*.5+phase)+age*(i%2?.12:-.1));
 }
}
if(gl){gl.uniform1f(gl.getUniformLocation(program,'uViewHeight'),VH);gl.uniform1f(gl.getUniformLocation(program,'uAspect'),W/H);gl.bufferData(gl.ARRAY_BUFFER,values.subarray(0,cursor),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,cursor/12)}
}
function resize(){const bounds=layer.getBoundingClientRect();W=bounds.width;H=bounds.height;D=Math.min(devicePixelRatio||1,1.7);VW=VH*W/H;for(const c of [canvas,stem]){c.width=Math.round(W*D);c.height=Math.round(H*D)}pen.setTransform(D,0,0,D,0,0);if(gl)gl.viewport(0,0,canvas.width,canvas.height);else fallback.setTransform(D,0,0,D,0,0)}
function finish(){
 done=true;layer.dataset.state='complete';
 status.textContent='期待 婚礼见';
}
function loop(now){
 if(pausedAt!==null)return;
 if(done){
  drawStem(center((now-epoch)/1000));
  if(!reduced)frame=requestAnimationFrame(loop);
  return;
 }
 const clock=(now-epoch)/1000,t=begin===null?null:(reduced?8.5:(now-begin)/1000);
 if(t!==null&&t>=5.6&&announcementAt===null){announcementAt=clock;announcement.classList.add('show');announcement.setAttribute('aria-hidden','false')}
 render(clock,t);
 if(t!==null&&(reduced||t>=8))finish();
 if(!done||!reduced)frame=requestAnimationFrame(loop);
}
function start(){if(begin!==null||done)return;shuffleArrivals();begin=performance.now();trigger.disabled=true;layer.focus({preventScroll:true});layer.classList.add('playing');layer.dataset.state='playing';status.textContent='汉字随风飘散，汇成：期待 婚礼见';}
trigger.addEventListener('click',start);
layer.addEventListener('click',()=>{if(begin===null)start();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();layer.classList.add('dandelion-fallback');announcement.classList.add('show');announcement.setAttribute('aria-hidden','false');finish();});
const d=window.invitationData||{};layer.querySelector('.dandelion-couple').textContent=`${d.partnerOne||'陈萌'} & ${d.partnerTwo||'叶倩芸'}`;layer.querySelector('.dandelion-date').textContent=d.date||'2026.11.21';
let inView=true;
function visibility(){
 const paused=document.hidden||!inView;
 if(paused&&pausedAt===null){pausedAt=performance.now();cancelAnimationFrame(frame);}
 else if(!paused&&pausedAt!==null){const delta=performance.now()-pausedAt;epoch+=delta;if(begin!==null)begin+=delta;pausedAt=null;if(!done||!reduced)frame=requestAnimationFrame(loop);}
}
document.addEventListener('visibilitychange',visibility);
const resizeObserver=new ResizeObserver(()=>{resize();if(done)render((performance.now()-epoch)/1000,8.5);});resizeObserver.observe(layer);
resize();layer.dataset.state='idle';frame=requestAnimationFrame(loop);
return {setVisible(value){inView=value;visibility();},dispose(){cancelAnimationFrame(frame);resizeObserver.disconnect();document.removeEventListener('visibilitychange',visibility);if(gl){gl.deleteBuffer(buffer);gl.deleteTexture(texture);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}}};
}
