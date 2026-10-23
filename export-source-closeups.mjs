// Re-rendered Source-style props, with the exact original editable Elder Sign.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=(await readFile('assets/notebook-source-detail-v2-blank.png')).toString('base64');
const seal=(await readFile('assets/elder-sign.png')).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
<defs><filter id="ink"><feFlood flood-color="#b7a17b"/><feComposite in2="SourceAlpha" operator="in"/></filter><mask id="wear"><rect width="300" height="239" fill="white"/><path d="M0 64H300M0 125H300M0 196H300" stroke="black" stroke-width="3" opacity=".6"/><path d="M55 0l28 239M199 0l-19 239" stroke="black" stroke-width="2" opacity=".35"/></mask></defs>
<image href="data:image/png;base64,${base}" width="1536" height="1024"/>
<g transform="matrix(.9,-.13,.45,.78,544,325)"><image href="data:image/png;base64,${seal}" width="300" height="239" filter="url(#ink)" opacity=".48" mask="url(#wear)"/></g></svg>`;
await writeFile('assets/notebook-source-detail-v2.svg',svg);
await sharp(Buffer.from(svg)).png().toFile('assets/notebook-source-detail-v2.png');
for(const name of ['notebook-source-detail-v2','photo-source-detail-v2']){
  await sharp(`assets/${name}.png`).webp({quality:92,effort:5}).toFile(`assets/${name}.webp`);
  console.log(`Exported ${name}: independently rendered Source-style inspection view.`);
}
