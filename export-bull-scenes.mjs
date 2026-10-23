// Keep the existing scene and Elder Sign intact; composite only the imagegen
// bull adjustment into the existing native SVG scene source.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const edited=await readFile('assets/source-bull-adjustment-v5.png');
const meta=await sharp(edited).metadata();
assert.equal(meta.width,1536);assert.equal(meta.height,1024);
const patchBounds={left:884,top:245,width:194,height:254};
for(const kind of ['plate','open']){
  const source=`assets/study-source-${kind}-v4.png`;
  const base=await readFile(source);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <defs><clipPath id="local"><rect x="884" y="245" width="194" height="254"/></clipPath><filter id="soft"><feGaussianBlur stdDeviation="3"/></filter><mask id="bull-region"><rect width="1536" height="1024" fill="black"/><rect x="893" y="254" width="176" height="236" fill="white" filter="url(#soft)"/><rect x="879" y="367" width="35" height="70" fill="white" filter="url(#soft)"/></mask></defs>
  <image href="data:image/png;base64,${base.toString('base64')}" width="1536" height="1024"/>
  <g clip-path="url(#local)" mask="url(#bull-region)"><image href="data:image/png;base64,${edited.toString('base64')}" width="1536" height="1024"/></g></svg>`;
  const destination=`assets/study-source-${kind}-v5`;
  await writeFile(`${destination}.svg`,svg);
  // Render the generated local edit, then insert its bounded region into the
  // original pixels. Pixels outside the bull region remain exactly identical.
  const local=await sharp(Buffer.from(svg)).extract(patchBounds).png().toBuffer();
  await sharp(base).composite([{input:local,left:patchBounds.left,top:patchBounds.top}]).png().toFile(`${destination}.png`);
  await sharp(`${destination}.png`).webp({quality:91,effort:5}).toFile(`${destination}.webp`);
  const a=await sharp(base).removeAlpha().raw().toBuffer();
  const b=await sharp(`${destination}.png`).removeAlpha().raw().toBuffer();
  let changed=0;
  for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
    const offset=(y*1536+x)*3;
    const diff=a[offset]!==b[offset]||a[offset+1]!==b[offset+1]||a[offset+2]!==b[offset+2];
    if(diff){assert.ok(x>=884&&x<1078&&y>=245&&y<499,'Unexpected scene change outside bull region');changed++;}
  }
  console.log(`Exported ${destination}: ${changed} changed pixels, no changes outside the bull region.`);
}
