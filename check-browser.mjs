// Automated tests run in a fresh headless browser, not in the guest's browser.
import './build-browser.mjs';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/shishi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=import.meta.dirname;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav'};
await mkdir('output',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const errors=[];
async function newPage(digits=[0,2],viewport={width:1440,height:1000},disableWebGL=false){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',locale:'zh-CN'});
  await context.route('http://study.test/**',async route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '')||'index.html';const path=resolve(root,relative);
    if(!path.startsWith(root+sep)){await route.fulfill({status:403,body:''});return;}
    try{await route.fulfill({status:200,body:await readFile(path),contentType:types[extname(path)]||'application/octet-stream'});}catch{if(relative!=='favicon.ico')errors.push(`Missing asset: ${relative}`);await route.fulfill({status:404,body:''});}
  });
  await context.addInitScript(values=>{
    if(location.pathname==='/dice.html'){let i=0;crypto.getRandomValues=array=>{for(let n=0;n<array.length;n++)array[n]=values[i++%values.length];return array;};}
  },digits);
  if(disableWebGL)await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/.test(kind)?null:get.call(this,kind,...args);};});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://study.test/');await page.locator('#start-exploration').waitFor({state:'visible'});
  assert.equal(await page.locator('#study').isVisible(),false);
  assert.equal(await page.locator('#choose-dialog').isVisible(),false);
  assert.equal(await page.locator('#gain-dialog').isVisible(),false);
  if(viewport.width===1440||viewport.width===390)await page.screenshot({path:`output/entry-${viewport.width===1440?'desktop':'mobile'}.png`});
  await page.locator('#start-exploration').click();await page.locator('#choose-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#study').isVisible(),true);
  assert.doesNotMatch(await page.locator('#choose-dialog').innerText(),/力量|智力|意志|加成|增益|\+\s*10/);
  return page;
}
async function click(page,name){const modal=page.locator('dialog[open]');await (await modal.count()?modal:page).getByRole('button',{name,exact:true}).click();}
async function roll(page,label){await click(page,label);await page.waitForFunction(()=>document.querySelector('#check-dialog').hasAttribute('data-outcome'),{},{timeout:22000});const verdict=await page.locator('#check-verdict').innerText();assert.equal(await page.locator('#check-dialog').isVisible(),true);await page.locator('#check-dialog').waitFor({state:'hidden'});await page.locator('#interaction-dialog').waitFor({state:'visible'});return verdict;}
async function choose(page,choice='intelligence'){
  await page.locator(`[data-keepsake="${choice}"]`).click();await page.locator('#gain-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#gain-value').innerText(),`${{strength:'力量',intelligence:'智力',will:'意志'}[choice]} +10`);
  assert.equal(await page.locator('#hotspots').evaluate(el=>el.inert),true);
  if(choice==='intelligence'&&page.viewportSize().width===390)await page.screenshot({path:'output/keepsake-gain-mobile.png'});
  await page.locator('#gain-continue').click();assert.equal(await page.locator('#hotspots').evaluate(el=>el.inert),false);
}
async function desk(page,name){await page.locator(`[data-object="${name}"]`).click();}
async function inspectionScreenshot(page,path){await page.locator('#object-art .inspection-stage.is-ready').waitFor();await page.screenshot({path});}
try{
  const page=await newPage();await choose(page);await page.locator('#world.ready').waitFor({timeout:20000});
  await page.screenshot({path:'output/study-desktop.png'});
  assert.equal(await page.locator('#world canvas').count(),0);
  assert.equal(await page.title(),'旧印 · 无人书房');
  assert.doesNotMatch(await page.locator('body').innerText(),/陈萌|叶倩芸|婚礼|相遇|祝福|温暖/);
  assert.equal(await page.locator('#inventory button').count(),1);
  await desk(page,'notebook');await inspectionScreenshot(page,'output/notebook-closeup.png');assert.match(await roll(page,'尝试读懂笔记 · 智力检定'),/成功/);await click(page,'返回');
  await desk(page,'record');await inspectionScreenshot(page,'output/record-closeup.png');await click(page,'打开暗格');await inspectionScreenshot(page,'output/knife-closeup.png');await click(page,'返回');
  await desk(page,'drawer');await inspectionScreenshot(page,'output/drawer-closeup.png');await click(page,'用钥匙打开');await inspectionScreenshot(page,'output/drawer-open-closeup.png');await click(page,'拿起信封');await inspectionScreenshot(page,'output/envelope-closeup.png');await roll(page,'触碰旧印 · 意志检定');await click(page,'继续拆信');assert.doesNotMatch(await page.locator('body').innerText(),/陈萌|叶倩芸|婚礼|相遇|祝福|温暖/);await click(page,'返回');
  await page.getByRole('button',{name:'查看火漆信封',exact:true}).click();assert.equal(await page.getByRole('button',{name:'触碰旧印 · 意志检定',exact:true}).count(),0);
  await click(page,'用匕首小心地拆开');await click(page,'阅读婚礼请柬');await page.waitForURL('**/invitation.html');assert.match(await page.locator('#invitation').innerText(),/陈萌/);await page.screenshot({path:'output/invitation.png'});
  console.log('PASS: image-layer scene, six photographic closeups, no early wedding spoilers, complete route and original 3D dice.');
  for(const [digits,kind]of [[[9,9],'失败'],[[0,0],'大失败'],[[0,1],'大成功']]){
    const p=await newPage(digits,{width:390,height:844});await choose(p);
    await desk(p,'drawer');const result=await roll(p,'使劲拉开 · 力量极难检定');assert.match(result,new RegExp(kind));await click(p,'返回');
    if(kind!=='大成功'){
      await desk(p,'drawer');assert.equal(await p.getByRole('button',{name:'使劲拉开 · 力量极难检定',exact:true}).count(),0);await click(p,'返回');
      await desk(p,'notebook');await roll(p,'尝试读懂笔记 · 智力检定');await click(p,'返回');await desk(p,'record');await roll(p,'用力撬开底座 · 力量检定');await click(p,'返回');assert.equal(await p.getByRole('button',{name:'查看指虎匕首',exact:true}).count(),1);
      await desk(p,'drawer');await click(p,'用钥匙打开');await click(p,'拿起信封');
    }else{await desk(p,'drawer');await click(p,'查看信封');}
    await roll(p,'触碰旧印 · 意志检定');await click(p,'继续拆信');
    if(kind==='大成功'){await click(p,'先找一件拆信工具 · 返回');await p.getByRole('button',{name:'查看火漆信封',exact:true}).click();await click(p,'直接撕开信封');}
    else await click(p,'用匕首小心地拆开');
    await click(p,'阅读婚礼请柬');await p.waitForURL('**/invitation.html');await p.context().close();
  }
  console.log('PASS: failure, fumble, critical, failed drawer no retry, forced record always yields knife, bare-hands shortcut.');
  const mobile=await newPage([0,2],{width:390,height:844});await mobile.screenshot({path:'output/study-mobile-choice.png'});await choose(mobile);await mobile.locator('#world.ready').waitFor();await mobile.screenshot({path:'output/study-mobile.png'});
  const bounds=await mobile.locator('.hotspot').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));for(const b of bounds){assert.ok(b.x>=0&&b.x+b.w<=390);assert.ok(b.y>180&&b.y+b.h<710);}
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await desk(mobile,'notebook');await inspectionScreenshot(mobile,'output/notebook-closeup-mobile.png');await click(mobile,'返回');
  await desk(mobile,'record');await click(mobile,'播放音乐');await mobile.waitForFunction(()=>window.InvitationAudio.recordPlaying);assert.equal(await mobile.locator('#background-music').evaluate(a=>a.paused),true);await click(mobile,'停止音乐');assert.equal(await mobile.locator('#background-music').evaluate(a=>a.paused),true);await click(mobile,'返回');
  await click(mobile,'播放音乐');await mobile.waitForFunction(()=>!document.querySelector('#background-music').paused);await desk(mobile,'record');await click(mobile,'播放音乐');await mobile.waitForFunction(()=>window.InvitationAudio.recordPlaying);assert.equal(await mobile.locator('#background-music').evaluate(a=>a.paused),true);await click(mobile,'停止音乐');await mobile.waitForFunction(()=>!document.querySelector('#background-music').paused);
  console.log('PASS: phone layout, all hotspots fit, actual background/record audio transitions.');
  for(const viewport of [{width:320,height:568},{width:430,height:932},{width:768,height:1024}]){
    const p=await newPage([0,2],viewport);await choose(p);await p.locator('#world.ready').waitFor();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const buttons=await p.locator('.hotspot').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
    for(const b of buttons){assert.ok(b.left>=0&&b.right<=viewport.width);assert.ok(b.top>70&&b.bottom<viewport.height-80);}
    await p.context().close();
  }
  await mobile.goto('http://study.test/dice.html');await mobile.locator('#roll-button').click();await mobile.locator('#result-number').filter({hasText:'02'}).waitFor();
  console.log('PASS: 320px, 430px and tablet layouts; standalone dice page still works.');
  for(const choice of ['strength','will']){const p=await newPage([0,2],{width:390,height:844});await choose(p,choice);assert.equal(await p.locator('#inventory button').count(),1);await p.context().close();}
  console.log('PASS: hidden room until Start; no bonus shown before choice; correct +10 revealed for all three items.');
  const fallback=await newPage([0,2],{width:390,height:844},true);await choose(fallback);await fallback.locator('#world.ready').waitFor();await desk(fallback,'notebook');await roll(fallback,'尝试读懂笔记 · 智力检定');assert.equal(await fallback.getByRole('button',{name:'查看旧钥匙',exact:true}).count(),1);await fallback.context().close();
  console.log('PASS: scene needs no WebGL; numeric dice fallback still works.');
  await mobile.goto('http://study.test/dandelion.html');await mobile.locator('#launch-canvas').waitFor({state:'attached'});await mobile.locator('#skip').click();await mobile.locator('#launch').waitFor({state:'hidden'});await mobile.locator('#replay').click();await mobile.locator('#launch').waitFor({state:'visible'});await mobile.screenshot({path:'output/dandelion-preserved.png'});
  console.log('PASS: preserved original dandelion page, skipping and replaying.');
  const localContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  const local=await localContext.newPage();const localErrors=[];
  local.on('pageerror',e=>localErrors.push(e.message));local.on('console',m=>{if(m.type()==='error')localErrors.push(m.text());});
  await local.goto(pathToFileURL(resolve(root,'index.html')).href);
  assert.equal(await local.locator('#study').isVisible(),false);await local.locator('#start-exploration').click();
  await local.locator('#choose-dialog').waitFor({state:'visible'});await choose(local);
  await desk(local,'notebook');await roll(local,'尝试读懂笔记 · 智力检定');assert.equal(await local.locator('#dice-frame').isVisible(),false);assert.equal(await local.frameLocator('#dice-frame').locator('canvas').count(),1);assert.doesNotMatch(await local.locator('#check-context').textContent(),/暂时不可用/);await click(local,'返回');
  assert.equal(await local.getByRole('button',{name:'查看旧钥匙',exact:true}).count(),1);
  await desk(local,'drawer');await click(local,'用钥匙打开');await click(local,'拿起信封');await roll(local,'触碰旧印 · 意志检定');await click(local,'继续拆信');await click(local,'直接撕开信封');await click(local,'阅读婚礼请柬');await local.waitForURL('**/invitation.html');
  assert.deepEqual(localErrors,[]);await localContext.close();
  console.log('PASS: direct file:// opening, Start, choice, bonus, real 3D dice, inventory and complete invitation route.');
  assert.deepEqual(errors,[]);console.log('PASS: no JavaScript errors or missing local assets. Screenshots in output/.');
}finally{await browser.close();}
