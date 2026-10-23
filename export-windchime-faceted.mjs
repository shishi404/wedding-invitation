import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source=(await readFile('assets/windchime-source-faceted-v2.png')).toString('base64');
// Scale the generated complete prop back to the same tabletop footprint.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><clipPath id="prop"><path d="M199 1490 L229 160 L240 139 L471 106 L488 111 L488 125 L529 126 L550 94 L563 94 L563 127 L530 171 L510 173 L508 402 L490 402 L495 167 L481 168 L470 140 L244 166 L227 1490Z"/><path d="M349 584 L417 424 L491 396 L512 397 L563 425 L615 585 L595 602 L522 603 L522 662 L502 663 L501 734 L479 734 L478 665 L435 662 L435 603 L351 600Z"/><path d="M398 700 L582 704 L563 1447 L379 1441Z"/><path d="M105 1517 L266 1468 L656 1516 L656 1632 L533 1686 L104 1612Z"/><ellipse cx="641" cy="1629" rx="122" ry="41"/></clipPath></defs><g transform="translate(925 298) scale(${85/900} ${165/1748})"><image href="data:image/png;base64,${source}" width="900" height="1748" clip-path="url(#prop)"/></g></svg>`;
const bounds={left:925,top:298,width:85,height:165};
const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 // Start from the room without a chime to avoid ghost edges of the rounded version.
 const base=await readFile(`assets/study-source-${kind}-v14.png`),dest=`assets/study-source-${kind}-v17`;
 await sharp(base).composite([{input:patch,left:925,top:298}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:95,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=925&&x<1010&&y>=298&&y<463);
 }
 console.log(`${dest}: hard flat-shaded chime; other room pixels unchanged.`);
}
await sharp('assets/study-source-plate-v17.png').extract({left:925,top:298,width:85,height:165}).resize(340,660,{kernel:'nearest'}).png().toFile('output/windchime-faceted.png');
