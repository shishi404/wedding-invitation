import * as THREE from 'three';
import {JewelryBoxController,setJewelryLockVisible} from './模型库/14_彩绘漆面首饰盒_Source/青蓝写实旧铜锁版_v7/jewelry-box-controller.js';

export function createJewelryContents(content,clips,envelope,{saved,onChange=()=>{}}={}){
  const anchor=content.getObjectByName('JewelryBox_Contents_Anchor');
  if(!anchor)throw new Error('首饰盒缺少盒内挂点');
  const bounds=new THREE.Box3().setFromObject(envelope);
  envelope.position.add(new THREE.Vector3(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2));
  const holder=new THREE.Group();holder.name='Sealed Envelope Inside Jewelry Box';
  holder.position.y=.0015;holder.rotation.y=THREE.MathUtils.degToRad(-6);holder.add(envelope);anchor.add(holder);
  let controller,lockBroken=false;
  function reset(value={}){
    controller?.dispose();
    // This room viewer previews the supplied key animation. Inventory rules can be
    // connected to the original controller when the invitation game is assembled.
    controller=new JewelryBoxController(content,clips,{canUseKey:()=>true,onChange});
    lockBroken=!!value.lockBroken;setJewelryLockVisible(content,!lockBroken);
    if(value.open){
      for(const name of ['Unlock','OpenLid']){
        const action=controller.actions[name];action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();controller.mixer.update(action.getClip().duration+.001);
      }
      controller.state='open';controller.notify();
    }
  }
  reset(saved);
  async function open(){
    if(controller.busy||controller.state==='open')return false;
    if(controller.state==='locked'&&!await controller.unlock(controller.keyId))return false;
    return controller.attemptOpen();
  }
  function getState(){return {state:controller.state,busy:controller.busy,open:['unlocking','unlocked','opening','open'].includes(controller.state),envelopeLoaded:true,lockBroken};}
  return {open,reset,getState,update:dt=>controller.update(dt),active:()=>controller.busy,holder,anchor};
}
