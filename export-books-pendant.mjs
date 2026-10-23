// Use the complete newly rendered books/necklace assembly, with no internal cuts.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edit=(await readFile('assets/books-pendant-source-redraw-v2.png')).toString('base64');
const bounds={left:350,top:315,width:265,height:135};
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><filter id="edge"><feGaussianBlur stdDeviation="2"/></filter><mask id="area"><rect x="361" y="327" width="239" height="111" fill="white" filter="url(#edge)"/></mask></defs><image href="data:image/png;base64,${edit}" width="1536" height="1024" mask="url(#area)"/></svg>`;
const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v7.png`);
 const dest=`assets/study-source-${kind}-v11`;
 await sharp(base).composite([{input:patch,left:bounds.left,top:bounds.top}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:93,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=350&&x<615&&y>=315&&y<450);
 }
 console.log(`${dest}: complete prop redraw; unchanged outside book region.`);
}
await sharp('assets/study-source-plate-v11.png').extract({left:365,top:320,width:235,height:125}).resize(940,500,{kernel:'nearest'}).png().toFile('output/books-pendant-redrawn.png');
