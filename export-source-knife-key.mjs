// Export the generated Source-style inspection images and matching thumbnails.
// Keep their PNG masters and previous art versions intact.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
for(const item of ['knife','key']){
  const source=`assets/${item}-source-detail-v1.png`;
  await sharp(source).webp({quality:92,effort:5}).toFile(`assets/${item}-source-detail-v1.webp`);
  await sharp(source).resize(320,213).webp({quality:88,effort:5}).toFile(`assets/${item}-source-thumbnail-v1.webp`);
  console.log(`Exported ${item} inspection and thumbnail.`);
}
