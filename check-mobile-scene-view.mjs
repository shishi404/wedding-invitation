import assert from 'node:assert/strict';
import {createMobileSceneView,mobileRenderSize,sceneNeedsZoom} from './study-mobile-view.js';

class Surface extends EventTarget{
  dataset={};captures=new Set();
  getBoundingClientRect(){return {left:0,top:0,width:390,height:844};}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  pointer(type,id,x,y=420){
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{pointerId:id,button:0,clientX:x,clientY:y});this.dispatchEvent(event);
  }
}
const surface=new Surface(),canvas={style:{}};let taps=0,blocked=false,last;
const view=createMobileSceneView({surface,canvas,blocked:()=>blocked,onTap:()=>taps++,onChange:value=>last=value});
view.resize(390,390*9/16);
const gesture=(start,end)=>{
  surface.pointer('pointerdown',1,195-start/2);surface.pointer('pointerdown',2,195+start/2);
  surface.pointer('pointermove',1,195-end/2);surface.pointer('pointermove',2,195+end/2);
  surface.pointer('pointerup',1,195-end/2);surface.pointer('pointerup',2,195+end/2);
};
gesture(100,200);assert.equal(last.zoom,2);assert.equal(taps,0);
surface.pointer('pointerdown',1,195);surface.pointer('pointermove',1,2000);surface.pointer('pointerup',1,2000);
assert.equal(last.pan,195,'Pan stops at the edge of the enlarged scene');assert.equal(taps,0);
gesture(100,2000);assert.equal(last.zoom,844/(390*9/16));
assert.equal(last.height*last.zoom,844,'Maximum zoom fills the vertical black bars');
gesture(300,1);assert.equal(last.zoom,1);assert.equal(last.pan,0);
surface.pointer('pointerdown',1,100);surface.pointer('pointerup',1,100);
assert.equal(taps,0,'Releasing the finger must not open a modal before its native click');
surface.pointer('click',1,100);assert.equal(taps,1,'One complete click opens the object once');
surface.pointer('click',1,100);assert.equal(taps,1,'An extra compatibility click must not activate again');
surface.pointer('pointerdown',1,100);surface.pointer('pointercancel',1,100);assert.equal(taps,1);
surface.pointer('click',1,100);assert.equal(taps,1,'Cancelled gestures must not open an object');
surface.pointer('pointerdown',1,100);surface.pointer('pointermove',1,120);surface.pointer('pointerup',1,120);
surface.pointer('click',1,120);assert.equal(taps,1,'Dragging must not turn its final click into a tap');
surface.pointer('pointerdown',1,100);surface.pointer('pointerup',1,100);
blocked=true;surface.pointer('click',1,100);assert.equal(taps,1,'A modal opening between release and click cancels the pending tap');
blocked=true;gesture(100,200);assert.equal(last.zoom,1);assert.equal(taps,1);
blocked=false;gesture(100,200);view.resize(320,180);assert.ok(last.zoom>=1);
view.reset();assert.equal(last.zoom,1);assert.equal(last.pan,0);
view.destroy();gesture(100,200);assert.equal(last.zoom,1);
// Phone framing keeps the lower tabletop above the controls at every zoom.
const framedSurface=new Surface(),framedCanvas={style:{}};let framed;
const framedView=createMobileSceneView({surface:framedSurface,canvas:framedCanvas,blocked:()=>blocked,onTap:()=>{},onChange:value=>framed=value,framing:()=>({top:100,bottom:640})});
framedView.resize(390,390*9/16);
assert.ok(framed.zoom>1,'Phones start enlarged');
assert.equal(844/2+framed.offsetY+framed.height*framed.zoom/2,640);
function wheel(surface,deltaY){const event=new Event('wheel',{cancelable:true});Object.assign(event,{deltaY,deltaMode:0,clientX:195});surface.dispatchEvent(event);return event;}
assert.equal(wheel(framedSurface,-3000).defaultPrevented,true);
assert.equal(framed.zoom,844/(390*9/16));
assert.equal(844/2+framed.offsetY+framed.height*framed.zoom/2,640,'Maximum zoom keeps the tabletop clear of the controls');
blocked=true;wheel(framedSurface,3000);assert.equal(framed.zoom,844/(390*9/16));blocked=false;
framedView.reset();assert.equal(framed.zoom,540/(390*9/16));framedView.destroy();
const fullSurface=new Surface(),fullCanvas={style:{}};let full;
const fullView=createMobileSceneView({surface:fullSurface,canvas:fullCanvas,blocked:()=>false,onTap:()=>{},onChange:value=>full=value,projected:true,zoomLimit:3,framing:()=>({bottom:640,anchor:.74,initialZoom:1.4})});
fullView.resize(390,844);assert.equal(full.zoom,1.4);
assert.equal(fullCanvas.style.transform,'translate(-50%,-50%)','The rendered canvas always covers the viewport');
wheel(fullSurface,-3000);assert.equal(full.zoom,3);
assert.equal(422+(.74-.5)*844*full.zoom+full.offsetY,640,'The real desk edge stays above controls without moving the canvas');
assert.equal(fullCanvas.style.transform,'translate(-50%,-50%)');fullView.destroy();
assert.equal(sceneNeedsZoom(1440,900),false);assert.equal(sceneNeedsZoom(844,390),false);assert.equal(sceneNeedsZoom(390,844),true);
let allowZoom=false,conditional;
const conditionalSurface=new Surface();
const conditionalView=createMobileSceneView({surface:conditionalSurface,canvas:{style:{}},blocked:()=>false,onTap:()=>{},onChange:value=>conditional=value,zoomLimit:3,zoomEnabled:()=>allowZoom});
conditionalView.resize(390,844);assert.equal(conditional.zoom,1);
assert.equal(wheel(conditionalSurface,-3000).defaultPrevented,false,'Full-scene views do not consume the wheel');
assert.equal(conditional.zoom,1);
conditionalSurface.pointer('pointerdown',1,140);conditionalSurface.pointer('pointerdown',2,240);
conditionalSurface.pointer('pointermove',1,40);conditionalSurface.pointer('pointermove',2,340);
assert.equal(conditional.zoom,1,'Pinching is disabled in a full-scene view');
allowZoom=true;conditionalView.resize(390,844);wheel(conditionalSurface,-3000);assert.equal(conditional.zoom,3);
allowZoom=false;conditionalView.resize(390,844);assert.equal(conditional.zoom,1);assert.equal(conditional.pan,0);conditionalView.destroy();
const desktopSurface=new Surface();let desktop;
const desktopView=createMobileSceneView({surface:desktopSurface,canvas:{style:{}},blocked:()=>false,onTap:()=>{},onChange:value=>desktop=value,zoomLimit:3});
desktopView.resize(390,844);wheel(desktopSurface,-3000);assert.equal(desktop.zoom,3);
wheel(desktopSurface,10000);assert.equal(desktop.zoom,1);desktopView.destroy();
for(const [width,height]of [[390,390*9/16],[844,844*9/16],[320,180]]){
  for(const zoom of [1,2,4]){
    const size=mobileRenderSize(width,height,zoom,1.5);
    assert.ok(Math.floor(size.width*1.5)*Math.floor(size.height*1.5)<=786432,'Zoom must respect the GPU pixel budget');
    assert.ok(Math.abs(size.width/size.height-16/9)<.02,'Rendering must preserve the scene aspect ratio');
  }
}
console.log('Mobile scene view passed: pinch limits, horizontal bounds, tap/gesture separation, cancellation, modal blocking, resize, reset and disposal.');
