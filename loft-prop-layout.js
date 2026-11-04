const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function sanitizeTableLayout(value={},defaults){
  // Placement deliberately allows overhangs and overlapping objects.
  return {x:finite(value.x,defaults.x),z:finite(value.z,defaults.z),rotation:clamp(finite(value.rotation,defaults.rotation),-180,180),size:clamp(finite(value.size,defaults.size),.4,2),visible:typeof value.visible==='boolean'?value.visible:defaults.visible};
}
