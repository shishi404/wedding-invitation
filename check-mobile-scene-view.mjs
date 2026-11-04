import assert from 'node:assert/strict';
import {createMobileSceneView} from './study-mobile-view.js';

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
console.log('Mobile scene view passed: pinch limits, horizontal bounds, tap/gesture separation, cancellation, modal blocking, resize, reset and disposal.');
