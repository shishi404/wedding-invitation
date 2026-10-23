// Apply the actual reference drawing as a decal, avoiding AI reinterpretation.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
await sharp('assets/pendant-original-reference.png').extract({left:460,top:625,width:275,height:275}).resize(32,32).png().toFile('assets/pendant-original-face-32.png');
const face=(await readFile('assets/pendant-original-face-32.png')).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><clipPath id="face"><path d="M466.5 401.5 L471.5 401.5 L475.4 404.3 L477 409.3 L475.4 414.3 L471.5 417.5 L466.5 417.5 L462.6 414.3 L461 409.3 L462.6 404.3Z"/></clipPath><filter id="lamp" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".25"/><feComponentTransfer><feFuncR type="linear" slope=".83"/><feFuncG type="linear" slope=".77"/><feFuncB type="linear" slope=".59"/></feComponentTransfer></filter></defs><image href="data:image/png;base64,${face}" x="460.5" y="400.5" width="17" height="18" preserveAspectRatio="none" clip-path="url(#face)" filter="url(#lamp)"/></svg>`;
await writeFile('assets/pendant-original-face-decal.svg',svg);
const bounds={left:460,top:400,width:18,height:19};
const patch=await sharp(Buffer.from(svg)).extract(bounds).png().toBuffer();
for(const kind of ['plate','open']){
 const base=await readFile(`assets/study-source-${kind}-v13.png`),dest=`assets/study-source-${kind}-v14`;
 await sharp(base).composite([{input:patch,left:460,top:400}]).png().toFile(`${dest}.png`);
 await sharp(`${dest}.png`).webp({quality:95,effort:5}).toFile(`${dest}.webp`);
 const a=await sharp(base).removeAlpha().raw().toBuffer(),b=await sharp(`${dest}.png`).removeAlpha().raw().toBuffer();
 for(let y=0;y<1024;y++)for(let x=0;x<1536;x++){
  const i=(y*1536+x)*3;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])assert.ok(x>=460&&x<478&&y>=400&&y<419);
 }
 console.log(`${dest}: original reference face; all pixels outside coin unchanged.`);
}
await sharp('assets/pendant-original-face-32.png').resize(256,256,{kernel:'nearest'}).png().toFile('output/pendant-original-face-preview.png');
await sharp('assets/study-source-plate-v14.png').extract({left:445,top:388,width:48,height:43}).resize(384,344,{kernel:'nearest'}).png().toFile('output/pendant-correct-pattern.png');
