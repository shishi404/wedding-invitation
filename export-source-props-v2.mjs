// Export new Source-era prop inspection renders. Retain the exact Elder Sign
// as an editable layer on the drawer envelope's otherwise blank wax seal.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=(await readFile('assets/drawer-source-open-detail-v2-blank.png')).toString('base64');
const seal=(await readFile('assets/elder-sign.png')).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><defs><filter id="wax-ink"><feFlood flood-color="#b87b61"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><image href="data:image/png;base64,${base}" width="1536" height="1024"/><g transform="matrix(.13,0,0,.09,754,421.7)"><image href="data:image/png;base64,${seal}" width="300" height="239" filter="url(#wax-ink)" opacity=".42"/></g></svg>`;
await writeFile('assets/drawer-source-open-detail-v2.svg',svg);
await sharp(Buffer.from(svg)).png().toFile('assets/drawer-source-open-detail-v2.png');
for(const name of ['record-source-detail-v2','bull-source-detail-v2','drawer-source-closed-detail-v2','drawer-source-open-detail-v2','drawer-source-empty-detail-v2']){
  const meta=await sharp(`assets/${name}.png`).metadata();
  assert.equal(meta.width,1536);assert.equal(meta.height,1024);
  await sharp(`assets/${name}.png`).webp({quality:92,effort:5}).toFile(`assets/${name}.webp`);
  console.log(`Exported ${name}: fresh full-object closeup, 1536 × 1024.`);
}
