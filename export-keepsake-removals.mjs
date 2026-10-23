// Small background patches remove picked-up props without replacing the room.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
for(const [name,source,bounds] of [
 ['musicbox','assets/study-source-plate-v17.png',{left:297,top:404,width:75,height:64}],
 ['windchime','assets/study-source-plate-v14.png',{left:925,top:298,width:85,height:165}]
]){
 await sharp(source).extract(bounds).webp({lossless:true}).toFile(`assets/${name}-cleared-v1.webp`);
 console.log(`${name}: original background restored, including the old shadow.`);
}
const bounds={left:360,top:325,width:240,height:120};
const original=await sharp('assets/study-source-plate-v20.png').extract(bounds).png().toBuffer();
const mask=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><defs><filter id="edge"><feGaussianBlur stdDeviation="1.6"/></filter></defs><rect x="4" y="4" width="232" height="112" fill="white" filter="url(#edge)"/></svg>');
const clean=await sharp('assets/books-without-pendant-source-v1.png').resize(240,120).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
await sharp(original).composite([{input:clean}]).webp({lossless:true}).toFile('assets/pendant-cleared-v1.webp');
console.log('pendant: clean book surfaces restored; small patch blends at the outside of the books.');
