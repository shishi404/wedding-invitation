// Reposition the original editable Elder Sign layer, preserving the v5 scene.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const seal=(await readFile('assets/elder-sign.png')).toString('base64');
const bounds={left:330,top:485,width:140,height:85};
// The ink centroid maps to (401,520), the intersection of the cover diagonals.
const symbol=`<defs>
<filter id="seal-ink"><feFlood flood-color="#8f8169"/><feComposite in2="SourceAlpha" operator="in"/></filter>
<mask id="seal-wear"><rect width="400" height="300" fill="white"/><path d="M0 67h380M0 132h380M0 207h380" stroke="black" stroke-width="4" opacity=".65"/><path d="M60 0l30 300M211 0l-20 300" stroke="black" stroke-width="3" opacity=".35"/></mask>
<clipPath id="notebook"><rect x="330" y="485" width="140" height="85"/></clipPath>
</defs><g><g transform="matrix(.24,-.029,.10,.18,353.5,502.3)"><image href="data:image/png;base64,${seal}" width="320" height="254" filter="url(#seal-ink)" opacity=".6" mask="url(#seal-wear)"/></g></g>`;
for(const kind of ['plate','open']){
  const base=await readFile(`assets/study-source-${kind}-v5.png`);
  const blank=await readFile(`assets/study-source-${kind}-v3.png`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><image href="data:image/png;base64,${base.toString('base64')}" width="1536" height="1024"/><defs><clipPath id="restore"><rect x="330" y="485" width="140" height="85"/></clipPath></defs><image href="data:image/png;base64,${blank.toString('base64')}" width="1536" height="1024" clip-path="url(#restore)"/>${symbol}</svg>`;
  const dest=`assets/study-source-${kind}-v6`;
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
      assert.ok(x>=330&&x<470&&y>=485&&y<570);count++;
    }
  }
  console.log(`Exported ${dest}: ${count} changed pixels, no changes outside the notebook seal area.`);
}
await sharp('assets/study-source-plate-v6.png').extract({left:290,top:455,width:245,height:170}).resize(980,680).png().toFile('output/notebook-seal-centered.png');
