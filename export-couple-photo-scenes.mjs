// Place the imagegen Source-style portrait into the existing editable scene.
// A local affine transform follows the four inner edges of the photo frame.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const portrait=(await readFile('assets/couple-source-portrait-v1.png')).toString('base64');
const bounds={left:648,top:342,width:59,height:77};
for(const kind of ['plate','open']){
  const base=await readFile(`assets/study-source-${kind}-v6.png`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <defs><clipPath id="photo"><path d="M649 344L703 342.5L706 415L651 417Z"/></clipPath>
  <filter id="photo-light" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".65"/><feComponentTransfer><feFuncR type="linear" slope=".66"/><feFuncG type="linear" slope=".64"/><feFuncB type="linear" slope=".56"/></feComponentTransfer></filter>
  <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#c2b784" stop-opacity=".08"/><stop offset=".6" stop-color="#c2b784" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".07"/></linearGradient></defs>
  <image href="data:image/png;base64,${base.toString('base64')}" width="1536" height="1024"/>
  <g clip-path="url(#photo)"><g transform="matrix(.1,-.00277778,.00277778,.10138889,649,344)"><image href="data:image/png;base64,${portrait}" width="540" height="720" filter="url(#photo-light)"/></g><path d="M649 344L703 342.5L706 415L651 417Z" fill="url(#glass)"/></g></svg>`;
  const dest=`assets/study-source-${kind}-v7`;
  await writeFile(`${dest}.svg`,svg);
  const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
  await sharp(base).composite([{input:patch,left:bounds.left,top:bounds.top}]).png().toFile(`${dest}.png`);
  await sharp(`${dest}.png`).webp({quality:91,effort:5}).toFile(`${dest}.webp`);
  const a=await sharp(base).removeAlpha().raw().toBuffer();
  const b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
  let count=0;
  for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
    const n=(y*1536+x)*3;
    if(a[n]!==b[n]||a[n+1]!==b[n+1]||a[n+2]!==b[n+2]){
      assert.ok(x>=648&&x<707&&y>=342&&y<419);count++;
    }
  }
  console.log(`Exported ${dest}: ${count} changed pixels, no changes outside the photo frame interior.`);
}
await sharp('assets/study-source-plate-v7.png').extract({left:625,top:320,width:106,height:120}).resize(636,720).png().toFile('output/frame-couple-source.png');
