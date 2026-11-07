import {readdir,mkdir,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const binaries=await readdir('output/media-tools/imageio_ffmpeg/binaries');
const ffmpeg=join('output/media-tools/imageio_ffmpeg/binaries',binaries.find(name=>/^ffmpeg.*\.exe$/.test(name)));
async function convert(directory){
  let count=0;
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name==='audio-compat')continue;
    const path=join(directory,entry.name);
    if(entry.isDirectory()){count+=await convert(path);continue;}
    if(!path.endsWith('.ogg'))continue;
    const target=path.replace(/^assets[\\/]/,'assets/audio-compat/').replace(/\.ogg$/,'.mp3');
    await mkdir(dirname(target),{recursive:true});
    const sourceTime=(await stat(path)).mtimeMs;
    const existing=await stat(target).catch(()=>null);
    if(!existing||existing.mtimeMs<sourceTime){
      const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',path,'-map_metadata','-1','-vn','-c:a','libmp3lame','-q:a','3',target],{encoding:'utf8',windowsHide:true});
      if(result.status!==0)throw Error(result.stderr);
    }
    count++;
  }
  return count;
}
console.log(`Prepared ${await convert('assets')} MP3 compatibility files; original Ogg files preserved.`);
// One gesture starts both winding and song, avoiding a second media-source
// change from an ended event in Safari/WebViews.
const sequence='assets/audio-compat/musicbox-sequence.mp3';
const result=spawnSync(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i','assets/musicbox-winding.ogg','-i','assets/musicbox-nop.ogg','-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]','-map_metadata','-1','-c:a','libmp3lame','-q:a','3',sequence],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error(result.stderr);
console.log(`Prepared ${sequence}. Keep data.js musicBoxWindingSeconds in sync if replacing the winding clip.`);
