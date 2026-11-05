// Room zoom uses camera projection on phones and canvas scaling on desktop.
// Keep zoomed phone views within a fixed GPU pixel budget.
export function mobileRenderSize(width,height,zoom=1,pixelRatio=1.5){
  const scale=Math.min(zoom,Math.sqrt(786432/(width*height*pixelRatio**2)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export const sceneNeedsZoom=(width,height)=>width<height;
export function createMobileSceneView({surface,canvas,blocked,onTap,onChange,framing=null,zoomLimit=null,projected=false,zoomEnabled=()=>true}){
  let width=0,height=0,zoom=1,pan=0,maxZoom=1,gesture=null,pendingTap=null,initialized=false,wheelTimer;
  let wasEnabled;
  const points=new Map();
  const listeners=new AbortController(),listen=(type,handler,options={})=>surface.addEventListener(type,handler,{...options,signal:listeners.signal});
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function update(settled=false){
    const bounds=surface.getBoundingClientRect();
    const enabled=zoomEnabled();
    if(enabled!==wasEnabled){initialized=false;pan=0;wasEnabled=enabled;}
    maxZoom=enabled&&width&&height?Math.max(1,zoomLimit??Math.max(bounds.width/width,bounds.height/height)):1;
    const frame=enabled?framing?.(bounds):null;
    const initialZoom=frame&&height?clamp(frame.initialZoom??(frame.bottom-frame.top)/height,1,maxZoom):1;
    if(!initialized&&width&&height){zoom=initialZoom;initialized=true;}
    zoom=clamp(zoom,1,maxZoom);
    const limit=Math.max(0,(width*zoom-bounds.width)/2);
    pan=clamp(pan,-limit,limit);
    // Projection mode anchors the real tabletop while rendering the room behind all UI.
    const offsetY=frame?(projected?frame.bottom-bounds.height/2-(frame.anchor-.5)*height*zoom:Math.min((frame.top+frame.bottom-bounds.height)/2,frame.bottom-bounds.height/2-height*zoom/2)):0;
    canvas.style.transform=projected?'translate(-50%,-50%)':`translate(-50%,-50%) translate(${pan}px,${offsetY}px) scale(${zoom})`;
    surface.dataset.sceneZoom=String(zoom);surface.dataset.scenePan=String(pan);surface.dataset.sceneMaxZoom=String(maxZoom);
    surface.dataset.sceneOffsetY=String(offsetY);surface.dataset.sceneInitialZoom=String(initialZoom);
    surface.dataset.sceneZoomEnabled=String(enabled);
    delete surface.dataset.sceneDeskEdge;
    if(projected&&frame)surface.dataset.sceneDeskEdge=String(bounds.height/2+(frame.anchor-.5)*height*zoom+offsetY);
    onChange({zoom,pan,offsetY,width,height,settled,gesturing:points.size>0});
  }
  function rebase(){
    const values=[...points.values()];
    if(values.length>=2){
      const [a,b]=values;gesture={zoom,pan,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),center:(a.x+b.x)/2};
      for(const point of values)point.moved=true;
    }else if(values.length){gesture={pan,x:values[0].x};}
    else gesture=null;
  }
  function cancel(){points.clear();gesture=null;pendingTap=null;}
  listen('pointerdown',event=>{
    pendingTap=null;
    if(event.button!==0||blocked())return;
    event.preventDefault();
    points.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false});
    surface.setPointerCapture(event.pointerId);rebase();update();
  });
  listen('pointermove',event=>{
    const point=points.get(event.pointerId);if(!point)return;
    if(blocked()){cancel();update(true);return;}
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
    if(!cancelled&&!point.moved&&!blocked())pendingTap={x:event.clientX,y:event.clientY};
  }
  // Opening a modal on pointerup can retarget the following native click onto
  // its new buttons. Wait until that click already has its scene target.
  listen('click',event=>{
    const tap=pendingTap;pendingTap=null;
    if(!tap||blocked()||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8)return;
    event.preventDefault();event.stopPropagation();onTap(event);
  });
  listen('pointerup',event=>end(event,false));
  listen('pointercancel',event=>end(event,true));
  listen('lostpointercapture',event=>end(event,true));
  listen('wheel',event=>{
    if(blocked()||!height||!zoomEnabled())return;
    event.preventDefault();pendingTap=null;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?surface.getBoundingClientRect().height:1);
    const next=clamp(zoom*Math.exp(-delta*.0015),1,maxZoom);
    const bounds=surface.getBoundingClientRect(),x=event.clientX-bounds.left-bounds.width/2;
    pan=x-(x-pan)*next/zoom;zoom=next;update();
    clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>update(true),120);
  },{passive:false});
  return {
    destroy(){cancel();clearTimeout(wheelTimer);listeners.abort();},
    resize(w,h){cancel();width=w;height=h;update(true);},
    reset(){cancel();initialized=false;pan=0;update(true);},
    key(event){
      if(blocked())return;
      if(event.key==='Home'){event.preventDefault();this.reset();}
      else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();pan+=event.key==='ArrowLeft'?40:-40;update(true);
      }
    },
  };
}
