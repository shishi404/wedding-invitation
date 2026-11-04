import * as THREE from 'three';

export const FLAME_DEFAULTS=Object.freeze({enabled:true,intensity:1,light:1});
export function sanitizeFlame(value={}){
  return {enabled:typeof value.enabled==='boolean'?value.enabled:true,intensity:THREE.MathUtils.clamp(Number.isFinite(value.intensity)?value.intensity:1,.4,1.6),light:THREE.MathUtils.clamp(Number.isFinite(value.light)?value.light:1,0,3)};
}

// Three intersecting ribbons give the small fire volume without texture downloads.
const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader=`
  uniform float time;uniform float seed;uniform float strength;varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
  float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03)+.15*noise(p*4.07);}
  void main(){
    float y=vUv.y,x=vUv.x*2.0-1.0;
    float t=time*1.65+seed;
    float flow=fbm(vec2(x*3.2+seed,y*5.8-t*2.4));
    float sway=sin(y*6.0-t*2.3+seed)*.12*y+(flow-.5)*.48*y;
    float width=mix(.88,.035,pow(y,.72));
    float tongues=fbm(vec2(x*5.5+seed,y*7.0-t*3.0));
    float body=1.0-smoothstep(width-.18,width+.06,abs(x-sway)+(tongues-.48)*.33);
    float tip=1.0-smoothstep(.48+flow*.40,.96,y);
    float alpha=body*tip*smoothstep(0.0,.08,y)*(.52+.42*flow);
    float core=(1.0-smoothstep(.0,.48,abs(x-sway)))*(1.0-smoothstep(.05,.63,y));
    vec3 color=mix(vec3(1.0,.13,.012),vec3(1.0,.52,.045),flow*.65+core*.35);
    color=mix(color,vec3(1.0,.86,.35),core*.8);
    alpha*=strength*.72;if(alpha<.012)discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createFlame(anchor,fireplace,woodRoot){
  const root=new THREE.Group();root.name='Animated Fireplace Flame';anchor.add(root);
  const geometry=new THREE.PlaneGeometry(.35,.40);geometry.translate(0,.16,0);
  const materials=[];
  for(let i=0;i<3;i++){
    const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{time:{value:0},seed:{value:i*2.731},strength:{value:1}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
    materials.push(material);
    const ribbon=new THREE.Mesh(geometry,material);ribbon.rotation.y=i*Math.PI/3+.15;ribbon.position.set((i-1)*.018,0,(i-1)*.015);ribbon.scale.set(1-i*.12,1-i*.09,1);root.add(ribbon);
  }
  const light=new THREE.PointLight(0xffa044,.30,2.6,2);light.position.set(0,.10,.12);root.add(light);
  // The apartment uses baked unlit materials. Soft additive spill makes reflected
  // firelight visible there without changing the room's original material setup.
  const spill=new THREE.Group();spill.name='Flickering Firelight Reflections';fireplace.root.add(spill);
  const spillGeometry=new THREE.PlaneGeometry(1,1);
  function reflection(width,height,opacity){
    const material=new THREE.ShaderMaterial({vertexShader,fragmentShader:`
      varying vec2 vUv;uniform float brightness;
      void main(){
        float r=length((vUv-.5)*2.0);
        float a=pow(max(0.,1.-r),2.3)*brightness;
        if(a<.001)discard;
        gl_FragColor=vec4(1.,.34,.065,a);
        #include <colorspace_fragment>
      }`,uniforms:{brightness:{value:0}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(spillGeometry,material);mesh.scale.set(width,height,1);mesh.userData.opacity=opacity;spill.add(mesh);return mesh;
  }
  const floorGlow=reflection(1.75,1.65,.23);floorGlow.rotation.x=-Math.PI/2;floorGlow.position.set(0,.005,.98);
  const wallGlow=reflection(2.2,1.8,.10);wallGlow.position.set(0,.62,0);
  let layout=sanitizeFlame();
  function active(){return layout.enabled&&woodRoot.visible&&fireplace.root.visible;}
  function apply(value){layout=sanitizeFlame(value);root.visible=spill.visible=active();root.scale.set(1,.75+layout.intensity*.25,1);for(const material of materials)material.uniforms.strength.value=.65+layout.intensity*.35;return {...layout};}
  function update(seconds){
    root.visible=spill.visible=active();if(!root.visible)return;
    for(const material of materials)material.uniforms.time.value=seconds;
    const flicker=.90+.22*Math.sin(seconds*4.1)+.14*Math.sin(seconds*7.7+1.2)+.07*Math.sin(seconds*13.3+.5);
    const brightness=layout.light*(.85+.15*layout.intensity)*flicker;
    light.intensity=.30*brightness;
    light.position.set(.025*Math.sin(seconds*3.2)+.012*Math.sin(seconds*6.1),.10+.018*Math.sin(seconds*4.6),.12+.014*Math.sin(seconds*2.9));
    for(const glow of [floorGlow,wallGlow])glow.material.uniforms.brightness.value=glow.userData.opacity*brightness;
    floorGlow.position.x=light.position.x*.8;wallGlow.position.x=light.position.x*2;
    wallGlow.position.z=-fireplace.getLayout().gap/fireplace.root.scale.z+.004;
  }
  apply(layout);
  return {root,apply,update,active,getLayout:()=>({...layout})};
}
