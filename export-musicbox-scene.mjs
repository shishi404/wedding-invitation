import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {data,info}=await sharp('assets/musicbox-source-sprite-v1.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(info.channels,4);
let x0=info.width,y0=info.height,x1=0,y1=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
const prop=await sharp('assets/musicbox-source-sprite-v1.png').extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize({width:50}).png().toBuffer();
await sharp(prop).toFile('assets/musicbox-source-desktop-v1.png');
const meta=await sharp(prop).metadata();
assert.equal(meta.width,50);
const left=57,top=550-meta.height;
const shadow=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="75" height="64"><defs><filter id="s"><feGaussianBlur stdDeviation="1"/></filter></defs><ellipse cx="32" cy="43" rx="24" ry="4" fill="#080b07" opacity=".55" filter="url(#s)"/></svg>');
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v17.png`),dest=`assets/study-source-${kind}-v18`;
 await sharp(base).composite([{input:shadow,left:54,top:504},{input:prop,left,top}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:95,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=54&&x<129&&y>=504&&y<568);
 }
 console.log(`${dest}: octagonal ceramic music box ${meta.width} × ${meta.height}px, matches note width; other pixels unchanged.`);
}
await sharp('assets/study-source-plate-v18.png').extract({left:35,top:490,width:120,height:95}).resize(600,475,{kernel:'nearest'}).png().toFile('output/musicbox-left-desk.png');
