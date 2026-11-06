// Fixed, widely separated colors; never infer an ID from a blended color channel.
export const STATIC_PICKING_COLORS=Object.freeze([
 {id:'coffee-cup',rgb:[255,32,32]},
 {id:'windchime',rgb:[32,255,32]},
 {id:'alchemical-book',rgb:[32,32,255]},
 {id:'octagonal-music-box',rgb:[255,255,32]},
 {id:'gramophone',rgb:[255,32,255]},
 {id:'little-prince-pendant',rgb:[32,255,255]},
 {id:'white-3ds-xl',rgb:[255,128,32]},
 {id:'painted-lacquer-jewelry-box',rgb:[128,32,255]},
 {id:'square-wood-photo-frame',rgb:[128,255,32]},
 {id:'single-sticky-note',rgb:[255,255,255]},
]);
export function createPickingDecoder(colors){
 const table=new Map(colors.map(({id,rgb:[r,g,b]})=>[(r<<16)|(g<<8)|b,id]));
 return (pixels,i)=>pixels[i+3]===255?table.get((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2])||null:null;
}
export function insidePickingPolygon(u,v,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [xi,yi]=points[i],[xj,yj]=points[j];
  if((yi>v)!==(yj>v)&&u<(xj-xi)*(v-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
export function pickStaticRoom({pixels,width,height,u,v,decode,regions=[],canUse=()=>true,radius=0}){
 const x=Math.floor(u*width),y=Math.floor(v*height);
 if(x<0||y<0||x>=width||y>=height)return null;
 const i=(y*width+x)*4,direct=decode(pixels,i);
 if(direct)return canUse(direct)?direct:null;
 // Unknown colors must not turn into an unrelated object, even at an edge.
 if(pixels[i]||pixels[i+1]||pixels[i+2])return null;
 for(const region of regions)if(insidePickingPolygon(u,v,region.points))return canUse(region.id)?region.id:null;
 let closest=null,distance=Infinity;
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const d=dx*dx+dy*dy,xx=x+dx,yy=y+dy;
  if(d>radius*radius||d>=distance||xx<0||yy<0||xx>=width||yy>=height)continue;
  const id=decode(pixels,(yy*width+xx)*4);if(id){closest=id;distance=d;}
 }
 return closest&&canUse(closest)?closest:null;
}
export function applyPickingPatches(base,width,height,patches){
 if(!patches.length)return base;
 const result=new Uint8ClampedArray(base);
 for(const patch of patches){const {x,y,width:w,height:h,pixels}=patch;
  if(x<0||y<0||x+w>width||y+h>height||pixels.length!==w*h*4)throw Error('点击区域尺寸不匹配');
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
   const from=(yy*w+xx)*4;if(!pixels[from+3])continue;
   const to=((y+yy)*width+x+xx)*4;result[to]=pixels[from];result[to+1]=pixels[from+1];result[to+2]=pixels[from+2];result[to+3]=255;
  }
 }
 return result;
}
