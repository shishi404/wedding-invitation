// Export the existing code-native SVG seal layer together with the scene plate.
// No symbol regeneration: the original alpha silhouette is rendered verbatim.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const seal=(await readFile('assets/elder-sign.png')).toString('base64');
const symbol=`<defs>
  <filter id="seal-ink"><feFlood flood-color="#b7a17b"/><feComposite in2="SourceAlpha" operator="in"/></filter>
  <mask id="seal-wear"><rect width="400" height="300" fill="white"/><path d="M0 67h380M0 132h380M0 207h380" stroke="black" stroke-width="4" opacity=".65"/><path d="M60 0l30 300M211 0l-20 300" stroke="black" stroke-width="3" opacity=".35"/></mask>
</defs><g style="filter:saturate(.8) brightness(.8)"><g transform="matrix(.24,-.025,.12,.17,340,516)"><image href="data:image/png;base64,${seal}" width="320" height="254" filter="url(#seal-ink)" opacity=".6" mask="url(#seal-wear)"/></g></g>`;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
  for(const [source,destination]of [['study-source-plate-v3','study-source-plate-v4'],['study-source-open-v3','study-source-open-v4']]){
    const base=(await readFile(`assets/${source}.png`)).toString('base64');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><image href="data:image/png;base64,${base}" width="1536" height="1024"/>${symbol}</svg>`;
    await writeFile(`assets/${destination}.svg`,svg);
    await page.setContent(`<html><head><style>html,body{margin:0;width:1536px;height:1024px}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('svg image')].map(el=>{const img=new Image();img.src=el.getAttribute('href');return img.decode();}));});
    await page.locator('svg').screenshot({path:`assets/${destination}.png`});
    await sharp(`assets/${destination}.png`).webp({quality:91,effort:5}).toFile(`assets/${destination}.webp`);
    console.log(`Exported ${destination}: source plate plus original Elder Sign SVG layer.`);
  }
}finally{await browser.close();}
