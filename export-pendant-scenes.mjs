// Integrate only the generated necklace region, preserving the existing room.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edit=(await readFile('assets/pendant-source-scene-edit-v1.png')).toString('base64');
const bounds={left:424,top:329,width:100,height:100};
const patchSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><clipPath id="necklace"><path d="M429 332 L487 330 L492 339 L515 347 L521 365 L513 375 L495 377 L487 412 L479 425 L465 427 L455 412 L452 367 L447 356 L428 350 Z"/></clipPath></defs><image href="data:image/png;base64,${edit}" width="1536" height="1024" clip-path="url(#necklace)"/></svg>`;
const patch=await sharp(Buffer.from(patchSvg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v7.png`);
 const dest=`assets/study-source-${kind}-v8`;
 await sharp(base).composite([{input:patch,left:bounds.left,top:bounds.top}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:93,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer();
 const b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 let changes=0;
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){
   assert.ok(x>=424&&x<524&&y>=329&&y<429);changes++;
  }
 }
 console.log(`${dest}: ${changes} changed pixels; all outside necklace region unchanged.`);
}
await writeFile('assets/pendant-source-region-v1.svg',patchSvg);
await sharp('assets/study-source-plate-v8.png').extract({left:365,top:320,width:235,height:125}).resize(940,500,{kernel:'nearest'}).png().toFile('output/pendant-on-books.png');
