// Scale only the rendered room. The camera and sibling dialogs stay unchanged.
export function createMobileSceneView({surface,canvas,blocked,onTap,onChange}){
  let width=0,height=0,zoom=1,pan=0,maxZoom=1,gesture=null;
  const points=new Map();
  const listeners=new AbortController(),listen=(type,handler)=>surface.addEventListener(type,handler,{signal:listeners.signal});
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function update(settled=false){
    const bounds=surface.getBoundingClientRect();
    maxZoom=width&&height?Math.max(1,bounds.width/width,bounds.height/height):1;
    zoom=clamp(zoom,1,maxZoom);
    const limit=Math.max(0,(width*zoom-bounds.width)/2);
    pan=clamp(pan,-limit,limit);
    canvas.style.transform=`translate(-50%,-50%) translateX(${pan}px) scale(${zoom})`;
    surface.dataset.sceneZoom=String(zoom);surface.dataset.scenePan=String(pan);surface.dataset.sceneMaxZoom=String(maxZoom);
    onChange({zoom,pan,width,height,settled});
  }
  function rebase(){
    const values=[...points.values()];
    if(values.length>=2){
      const [a,b]=values;gesture={zoom,pan,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),center:(a.x+b.x)/2};
      for(const point of values)point.moved=true;
    }else if(values.length){gesture={pan,x:values[0].x};}
    else gesture=null;
  }
  function cancel(){points.clear();gesture=null;}
  listen('pointerdown',event=>{
    if(event.button!==0||blocked())return;
    event.preventDefault();
    points.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false});
    surface.setPointerCapture(event.pointerId);rebase();
  });
  listen('pointermove',event=>{
    const point=points.get(event.pointerId);if(!point)return;
    if(blocked()){cancel();return;}
    event.preventDefault();point.x=event.clientX;point.y=event.clientY;
    if(Math.hypot(point.x-point.startX,point.y-point.startY)>8)point.moved=true;
    const values=[...points.values()];
    if(values.length>=2){
      const [a,b]=values,newZoom=clamp(gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,1,maxZoom);
      const bounds=surface.getBoundingClientRect(),center=bounds.left+bounds.width/2;
      pan=(a.x+b.x)/2-center-(gesture.center-center-gesture.pan)*newZoom/gesture.zoom;
      zoom=newZoom;update();
    }else if(point.moved){pan=gesture.pan+point.x-gesture.x;update();}
  });
  function end(event,cancelled){
    const point=points.get(event.pointerId);if(!point)return;
    points.delete(event.pointerId);
    if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);
    rebase();update(points.size===0);
    if(!cancelled&&!point.moved&&!blocked())onTap(event);
  }
  listen('pointerup',event=>end(event,false));
  listen('pointercancel',event=>end(event,true));
  listen('lostpointercapture',event=>end(event,true));
  return {
    destroy(){cancel();listeners.abort();},
    resize(w,h){cancel();width=w;height=h;update(true);},
    reset(){cancel();zoom=1;pan=0;update(true);},
    key(event){
      if(blocked())return;
      if(event.key==='Home'){event.preventDefault();this.reset();}
      else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();pan+=event.key==='ArrowLeft'?40:-40;update(true);
      }
    },
  };
}
