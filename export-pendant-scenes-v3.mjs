import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edit=(await readFile('assets/pendant-source-scene-edit-v2.png')).toString('base64');
const outline='M489 350 L477 347 L454 347 Q433 346 433 340 Q439 332 458 335 L477 337 Q490 338 483 342 L469 348 L459 359 L459 381 L461 402 Q463 420 469 421 Q477 422 480 409 L486 385 L491 371';
// Restore the original book exactly. Copy only a narrow traced chain silhouette,
// never a broad patch containing generated book geometry.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><mask id="chain"><path d="${outline}" fill="none" stroke="white" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="502" cy="362" rx="21" ry="16" fill="black"/></mask><clipPath id="coin"><ellipse cx="502" cy="362" rx="16" ry="12"/></clipPath></defs><image href="data:image/png;base64,${edit}" width="1536" height="1024" mask="url(#chain)"/><g transform="translate(175.7 126.7) scale(.65)"><image href="data:image/png;base64,${edit}" width="1536" height="1024" clip-path="url(#coin)"/></g><path d="M487 350 Q491 353 495 357 M498 368 Q493 371 491 377" fill="none" stroke="#3b3925" stroke-width="2.2"/><path d="M487 350 Q491 353 495 357 M498 368 Q493 371 491 377" fill="none" stroke="#b6ad7d" stroke-width="1.1" stroke-dasharray="1.5 .7"/></svg>`;
const bounds={left:424,top:329,width:100,height:100};
const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v7.png`);
 const dest=`assets/study-source-${kind}-v10`;
 await sharp(base).composite([{input:patch,left:424,top:329}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:93,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=424&&x<524&&y>=329&&y<429);
 }
 console.log(`${dest}: coin 65% size, unchanged outside necklace region.`);
}
await sharp('assets/note-source-detail-v2.png').webp({quality:95}).toFile('assets/note-source-detail-v2.webp');
await sharp('assets/study-source-plate-v10.png').extract({left:365,top:320,width:235,height:125}).resize(940,500,{kernel:'nearest'}).png().toFile('output/pendant-on-books-v3.png');
