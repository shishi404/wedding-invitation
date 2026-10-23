// Export the transparent perspective-corrected prop into the existing room.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source='assets/windchime-source-perspective-v3.png';
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let x0=info.width,y0=info.height,x1=0,y1=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
const prop=await sharp(source).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize({height:150}).png().toBuffer();
await sharp(prop).toFile('assets/windchime-source-desktop-v3.png');
const bounds={left:925,top:298,width:85,height:165};
for(const kind of ['plate','open']){
  const base=await readFile(`assets/study-source-${kind}-v20.png`);
  const clear=await sharp(`assets/study-source-${kind}-v14.png`).extract(bounds).png().toBuffer();
  const dest=`assets/study-source-${kind}-v21`;
  await sharp(base).composite([{input:clear,left:bounds.left,top:bounds.top},{input:prop,left:934,top:306}]).png().toFile(`${dest}.png`);
  await sharp(`${dest}.png`).webp({quality:95,effort:5}).toFile(`${dest}.webp`);
  const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
  for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
    const i=(y*1536+x)*3;
    if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=bounds.left&&x<bounds.left+bounds.width&&y>=bounds.top&&y<bounds.top+bounds.height);
  }
  console.log(`${dest}: only the wind chime region changed.`);
}
await sharp('assets/study-source-plate-v21.png').extract({left:710,top:220,width:350,height:270}).resize(1050,810,{kernel:'nearest'}).png().toFile('output/windchime-perspective-v3-context.png');
console.log('Desktop sprite:',await sharp(prop).metadata());
