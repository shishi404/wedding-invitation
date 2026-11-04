import * as THREE from 'three';

// The paper hangs from its own joint; the bell, stem and stand remain in place.
export function createWindchimeBreeze(root,{enabled=()=>true}={}){
  const name='Joint_03_Stem_To_Paper_Tag',joint=root.getObjectByName(name);
  if(!joint)return null;
  const rest=joint.quaternion.clone(),offset=new THREE.Quaternion(),angles=new THREE.Euler();let time=0;
  function reset(target=root){target.getObjectByName(name)?.quaternion.copy(rest);}
  function update(dt){
    if(!enabled()){reset();return;}
    time+=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    // Different slow periods keep the breeze from feeling like a metronome.
    const x=3.2*Math.sin(time*1.25)+.8*Math.sin(time*.47);
    const y=2*Math.sin(time*.71);
    const z=4.4*Math.sin(time*1.04)+.8*Math.sin(time*2.13);
    angles.set(THREE.MathUtils.degToRad(x),THREE.MathUtils.degToRad(y),THREE.MathUtils.degToRad(z));
    joint.quaternion.copy(rest).multiply(offset.setFromEuler(angles));
  }
  return {update,reset,active:()=>!!enabled()};
}
