import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edit=(await readFile('assets/windchime-source-scene-edit-v1.png')).toString('base64');
// Globe base about 102 px; generated chime base 75 px, scaled to 51 px.
const scale=51/75;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><mask id="chime"><g fill="white"><path d="M938 431 L944 249 L946 245 L970 241 L976 243 L983 239" fill="none" stroke="white" stroke-width="3" stroke-linejoin="round"/><path d="M975 243 L976 250 L979 248 L981 242 M977 250 L976 289" fill="none" stroke="white" stroke-width="1.7"/><path d="M962 306 L963 295 L969 287 L979 287 L986 294 L990 306 L982 309 L968 309Z"/><path d="M970 307 L980 307 L980 317 L974 321 L969 315Z"/><path d="M975 316 L974 324" fill="none" stroke="white" stroke-width="2"/><path d="M969 322 L982 323 L985 425 L962 426Z"/><path d="M924 435 L939 429 L998 437 L1001 450 L985 458 L923 447Z"/><ellipse cx="974" cy="450" rx="42" ry="9"/></g></mask></defs><g transform="translate(${960*(1-scale)} ${455*(1-scale)}) scale(${scale})"><image href="data:image/png;base64,${edit}" width="1536" height="1024" mask="url(#chime)"/></g></svg>`;
await writeFile('assets/windchime-source-layer-v1.svg',svg);
const bounds={left:930,top:303,width:70,height:156};
const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v14.png`),dest=`assets/study-source-${kind}-v15`;
 await sharp(base).composite([{input:patch,left:bounds.left,top:bounds.top}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:95,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=930&&x<1000&&y>=303&&y<459);
 }
 console.log(`${dest}: chime base 51px / globe base 102px; other objects unchanged.`);
}
await sharp('assets/study-source-plate-v15.png').extract({left:720,top:220,width:315,height:255}).resize(945,765,{kernel:'nearest'}).png().toFile('output/windchime-beside-globe.png');
