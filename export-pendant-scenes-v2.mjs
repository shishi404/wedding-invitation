import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edit=(await readFile('assets/pendant-source-scene-edit-v2.png')).toString('base64');
const outline='M429 332 L487 330 L492 339 L515 347 L521 365 L513 375 L495 377 L487 412 L479 425 L465 427 L455 412 L452 367 L447 356 L428 350 Z';
// Preserve chain drape, shrink only the coin around its original center.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><mask id="chain"><path d="${outline}" fill="white"/><ellipse cx="502" cy="362" rx="21" ry="16" fill="black"/></mask><clipPath id="coin"><ellipse cx="502" cy="362" rx="16" ry="12"/></clipPath></defs><image href="data:image/png;base64,${edit}" width="1536" height="1024" mask="url(#chain)"/><g transform="translate(175.7 126.7) scale(.65)"><image href="data:image/png;base64,${edit}" width="1536" height="1024" clip-path="url(#coin)"/></g><path d="M487 350 Q491 353 495 357 M498 368 Q493 371 491 377" fill="none" stroke="#3b3925" stroke-width="2.2"/><path d="M487 350 Q491 353 495 357 M498 368 Q493 371 491 377" fill="none" stroke="#b6ad7d" stroke-width="1.1" stroke-dasharray="1.5 .7"/></svg>`;
const bounds={left:424,top:329,width:100,height:100};
const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v7.png`);
 const dest=`assets/study-source-${kind}-v9`;
 await sharp(base).composite([{input:patch,left:424,top:329}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:93,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=424&&x<524&&y>=329&&y<429);
 }
 console.log(`${dest}: coin 65% size, unchanged outside necklace region.`);
}
await sharp('assets/study-source-plate-v9.png').extract({left:365,top:320,width:235,height:125}).resize(940,500,{kernel:'nearest'}).png().toFile('output/pendant-on-books-v2.png');
