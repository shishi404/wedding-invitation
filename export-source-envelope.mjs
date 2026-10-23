// Keep the generated Source-style prop and the game's exact Elder Sign separate
// in an editable SVG master, then export matching inspection/inventory assets.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=(await readFile('assets/envelope-source-detail-v1-blank.png')).toString('base64');
const seal=(await readFile('assets/elder-sign.png')).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><defs><filter id="wax-ink"><feFlood flood-color="#b87b61"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><image href="data:image/png;base64,${base}" width="1536" height="1024"/><image href="data:image/png;base64,${seal}" x="716" y="431" width="96" height="76.5" filter="url(#wax-ink)" opacity=".42"/></svg>`;
await writeFile('assets/envelope-source-detail-v1.svg',svg);
await sharp(Buffer.from(svg)).png().toFile('assets/envelope-source-detail-v1.png');
await sharp(Buffer.from(svg)).webp({quality:92,effort:5}).toFile('assets/envelope-source-detail-v1.webp');
await sharp(Buffer.from(svg)).resize(320,213).webp({quality:88,effort:5}).toFile('assets/envelope-source-thumbnail-v1.webp');
console.log('Exported Source-style envelope closeup and matching inventory thumbnail, with the exact Elder Sign.');
