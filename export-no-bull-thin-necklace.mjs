import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edit=(await readFile('assets/study-no-bull-thin-necklace-v1.png')).toString('base64');
const bounds=[{left:350,top:315,width:265,height:135},{left:882,top:300,width:180,height:175}];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><filter id="edge"><feGaussianBlur stdDeviation="2"/></filter><mask id="area"><g fill="white" filter="url(#edge)"><rect x="361" y="327" width="239" height="111"/><rect x="894" y="312" width="155" height="151"/></g></mask></defs><image href="data:image/png;base64,${edit}" width="1536" height="1024" mask="url(#area)"/></svg>`;
const patches=await Promise.all(bounds.map(async b=>({input:await sharp(Buffer.from(svg)).extract(b).png().toBuffer(),left:b.left,top:b.top})));
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v12.png`),dest=`assets/study-source-${kind}-v13`;
 await sharp(base).composite(patches).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:93,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(bounds.some(r=>x>=r.left&&x<r.left+r.width&&y>=r.top&&y<r.top+r.height));
 }
 console.log(`${dest}: two targeted edits, rest of room unchanged.`);
}
await sharp('assets/study-source-plate-v13.png').extract({left:365,top:320,width:235,height:125}).resize(940,500,{kernel:'nearest'}).png().toFile('output/necklace-light-chain.png');
