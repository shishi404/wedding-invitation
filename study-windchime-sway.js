import * as THREE from 'three';

// Rotate the existing nested suspension joints: the whole hanging assembly
// follows the bell, while the post and base keep their original transforms.
export function createWindchimeSway(root,{reducedMotion=()=>false}={}){
  const names=['Joint_01_Upper_Ring','Joint_02_Cap_To_Wooden_Stem','Joint_03_Stem_To_Paper_Tag'];
  const joints=names.map(name=>root.getObjectByName(name));if(joints.some(joint=>!joint))return null;
  const springs=joints.map((joint,i)=>({joint,rest:joint.quaternion.clone(),angle:new THREE.Vector3(),velocity:new THREE.Vector3(),frequency:[6.8,8.7,7.6][i],damping:[2.5,2.8,2.6][i],limit:THREE.MathUtils.degToRad([4,2.5,4.5][i])}));
  const euler=new THREE.Euler(),offset=new THREE.Quaternion();let playing=false,elapsed=0,gentle=false;
  function stop(){
    playing=false;elapsed=0;
    springs.forEach(s=>{s.angle.set(0,0,0);s.velocity.set(0,0,0);s.joint.quaternion.copy(s.rest);});
  }
  function trigger(){
    gentle=!!reducedMotion();playing=true;elapsed=0;
    for(const [i,s]of springs.entries()){
      const strength=(gentle?.3:1)*[.46,.32,.5][i];
      // Preserve the current pose and boost its current direction on re-click.
      for(const [axis,ratio]of [['x',.5],['y',.12],['z',1]]){
        const direction=Math.sign(s.velocity[axis])||((i===1?-1:1)*(axis==='x'?-1:1));
        s.velocity[axis]=direction*strength*ratio;
      }
    }
  }
  function update(dt){
    if(!playing)return;
    const delta=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;elapsed+=delta;
    if(elapsed>=(gentle?1.8:4)){stop();return;}
    const steps=Math.max(1,Math.ceil(delta/(1/120))),step=delta/steps;
    for(const s of springs){
      const limit=s.limit*(gentle?.3:1);
      for(let i=0;i<steps;i++)for(const axis of ['x','y','z']){
        s.velocity[axis]+=(-s.frequency*s.frequency*s.angle[axis]-s.damping*s.velocity[axis])*step;
        s.angle[axis]=THREE.MathUtils.clamp(s.angle[axis]+s.velocity[axis]*step,-limit,limit);
      }
      s.joint.quaternion.copy(s.rest).multiply(offset.setFromEuler(euler.set(s.angle.x,s.angle.y,s.angle.z)));
    }
  }
  return {trigger,update,stop,active:()=>playing};
}
