import * as THREE from './vendor/three.module.js';

const stage = document.querySelector('#dice-stage');
const button = document.querySelector('#roll-button');
const buttonLabel = document.querySelector('#button-label');
const resultNumber = document.querySelector('#result-number');
const resultBreakdown = document.querySelector('#result-breakdown');
const hint = document.querySelector('#hint');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const embedded = parent !== window;
// srcdoc inherits the parent origin, while location.origin itself is "null".
const messageOrigin = new URL(document.baseURI).origin;
let embeddedRollId = null;

// A pentagonal trapezohedron: ten planar kite faces, one number per face.
const R = 1;
// Keep each kite broad enough for the reference engraving without stretching it.
const beltHeight = .10;
const tipHeight = beltHeight * (1 + Math.cos(Math.PI / 5)) / (1 - Math.cos(Math.PI / 5));
const vertex = (angle, z) => new THREE.Vector3(Math.cos(angle) * R, Math.sin(angle) * R, z);
const top = new THREE.Vector3(0, 0, tipHeight);
const bottom = new THREE.Vector3(0, 0, -tipHeight);
const upper = Array.from({length: 5}, (_, i) => vertex((i + .5) * Math.PI * 2 / 5, beltHeight));
const lower = Array.from({length: 5}, (_, i) => vertex(i * Math.PI * 2 / 5, -beltHeight));
const facePoints = [];
for (let i = 0; i < 5; i++) {
  facePoints.push([top, upper[i], lower[i], upper[(i + 4) % 5]]);
  facePoints.push([bottom, lower[(i + 1) % 5], upper[i], lower[i]]);
}

function randomDigit() {
  const values = new Uint32Array(1);
  const limit = Math.floor(4294967296 / 10) * 10;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % 10;
}

const engravingImage = new Image();
engravingImage.src = './dice-engraving-reference.png';
let motifReady = false;
try {
  await engravingImage.decode();
  motifReady = true;
} catch (error) {
  console.warn('Engraving reference could not be loaded.', error);
}

function foilColor(x, y, detail) {
  const ripple = (Math.sin(y * .065 + x * .023) + 1) / 2;
  const glint = Math.max(0, 1 - Math.abs(y - (240 + x * .22)) / 95);
  const shine = Math.min(1, .23 + .34 * detail + .22 * ripple + .25 * glint);
  return [145 + 109 * shine, 78 + 140 * shine, 23 + 89 * shine];
}

function makeMotifMask() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  if (motifReady) {
    // Crop only the gold ornament. The black backdrop and "Dice 8" caption
    // from the supplied reference are not part of the dice face.
    const scale = 1.35;
    c.drawImage(engravingImage, 95, 25, 230, 300,
      (512 - 230 * scale) / 2, 72, 230 * scale, 300 * scale);
    const pixels = c.getImageData(0, 0, 512, 512);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const red = pixels.data[i];
      const ink = Math.max(0, Math.min(1, (red - 12) / 115));
      const detail = Math.max(0, Math.min(1, (red - 35) / 165));
      const [r, g, b] = foilColor((i / 4) % 512, Math.floor(i / 2048), detail);
      pixels.data[i] = r;
      pixels.data[i + 1] = g;
      pixels.data[i + 2] = b;
      pixels.data[i + 3] = Math.round(ink * 255);
    }
    c.putImageData(pixels, 0, 0);
  } else {
    c.strokeStyle = '#dfb55d';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(256, 87); c.lineTo(110, 389);
    c.lineTo(256, 457); c.lineTo(402, 389); c.closePath(); c.stroke();
    c.beginPath(); c.arc(256, 334, 92, 0, Math.PI * 2); c.stroke();
  }
  return canvas;
}

const motifMask = makeMotifMask();

const oldSealImage = new Image();
oldSealImage.src = './dice-old-seal-reference.png';
let oldSealReady = false;
try {
  await oldSealImage.decode();
  oldSealReady = true;
} catch (error) {
  console.warn('Old seal reference could not be loaded.', error);
}

function makeOldSealMask() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  if (!oldSealReady) return canvas;
  // Only the mark inside the white square: omit its border and watermark.
  c.drawImage(oldSealImage, 15, 18, 249, 197, 167, 263, 178, 141);
  const pixels = c.getImageData(0, 0, 512, 512);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const luminance = (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
    const sourceAlpha = pixels.data[i + 3] / 255;
    const ink = Math.max(0, Math.min(1, (180 - luminance) / 135));
    const [r, g, b] = foilColor((i / 4) % 512, Math.floor(i / 2048), ink);
    pixels.data[i] = r;
    pixels.data[i + 1] = g;
    pixels.data[i + 2] = b;
    pixels.data[i + 3] = Math.round(ink * sourceAlpha * 255);
  }
  c.putImageData(pixels, 0, 0);
  return canvas;
}

const oldSealMask = makeOldSealMask();

const numberImage = new Image();
numberImage.src = './dice-number-reference.png';
let numberReady = false;
try {
  await numberImage.decode();
  numberReady = true;
} catch (error) {
  console.warn('Number reference could not be loaded.', error);
}

const digitRanges = [
  [722, 744], [52, 65], [121, 143], [196, 218], [267, 290],
  [342, 366], [417, 440], [491, 515], [566, 590], [642, 662]
];

function makeNumberMask(label) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  if (!numberReady) return canvas;
  const height = label.length > 1 ? 96 : 114;
  const scale = height / 49;
  const gap = label.length > 1 ? 11 : 0;
  const widths = [...label].map(digit => (digitRanges[Number(digit)][1] - digitRanges[Number(digit)][0] + 5) * scale);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (label.length - 1);
  let x = 256 - totalWidth / 2;
  for (let i = 0; i < label.length; i++) {
    const [start, end] = digitRanges[Number(label[i])];
    c.drawImage(numberImage, start - 2, 24, end - start + 5, 49,
      x, 334 - height / 2, widths[i], height);
    x += widths[i] + gap;
  }
  const pixels = c.getImageData(0, 0, 512, 512);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i];
    const sourceAlpha = pixels.data[i + 3] / 255;
    const ink = Math.max(0, Math.min(1, (red - 20) / 115));
    const detail = Math.max(0, Math.min(1, (red - 45) / 190));
    const [r, g, b] = foilColor((i / 4) % 512, Math.floor(i / 2048), detail);
    pixels.data[i] = r;
    pixels.data[i + 1] = g;
    pixels.data[i + 2] = b;
    pixels.data[i + 3] = Math.round(ink * sourceAlpha * 255);
  }
  c.putImageData(pixels, 0, 0);
  return canvas;
}

function paintNightSky(c, seed) {
  let state = 0x9e3779b9 ^ (seed * 0x85ebca6b);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const haze = c.createRadialGradient(286, 280, 18, 286, 280, 225);
  haze.addColorStop(0, 'rgba(48, 61, 113, .19)');
  haze.addColorStop(.55, 'rgba(33, 37, 79, .10)');
  haze.addColorStop(1, 'rgba(8, 12, 29, 0)');
  c.fillStyle = haze;
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 48; i++) {
    const x = 105 + random() * 302;
    const y = 112 + random() * 330;
    const bright = random();
    const radius = bright > .88 ? 5 : 2 + random() * 2.2;
    const glow = c.createRadialGradient(x, y, 0, x, y, radius * 4);
    glow.addColorStop(0, `rgba(238, 246, 255, ${bright > .88 ? .77 : .43})`);
    glow.addColorStop(.25, `rgba(177, 200, 239, ${bright > .88 ? .29 : .12})`);
    glow.addColorStop(1, 'rgba(156, 177, 231, 0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(x, y, radius * 4, 0, Math.PI * 2); c.fill();
    if (bright > .96) {
      c.strokeStyle = 'rgba(225, 237, 255, .22)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - 9, y); c.lineTo(x + 9, y);
      c.moveTo(x, y - 9); c.lineTo(x, y + 9);
      c.stroke();
    }
  }
}

function paintIceSheen(c) {
  const frost = c.createRadialGradient(256, 130, 8, 256, 130, 95);
  frost.addColorStop(0, 'rgba(255, 255, 255, .24)');
  frost.addColorStop(1, 'rgba(255, 255, 255, 0)');
  c.fillStyle = frost;
  c.fillRect(145, 95, 222, 145);
  c.save();
  c.lineCap = 'round';
  c.shadowColor = 'rgba(240, 251, 255, .7)';
  c.shadowBlur = 12;
  c.strokeStyle = 'rgba(249, 254, 255, .47)';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(246, 111); c.lineTo(181, 252);
  c.moveTo(150, 381); c.lineTo(188, 400);
  c.stroke();
  c.restore();
}

function drawFoil(c, mask) {
  c.save();
  c.shadowColor = 'rgba(47, 29, 8, .55)';
  c.shadowBlur = 2;
  c.shadowOffsetY = 1;
  c.drawImage(mask, 0, 0);
  c.restore();
}

const numberMasks = new Map();

function makeFaceTexture(label, crystal, faceIndex) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  if (crystal) paintIceSheen(c);
  else paintNightSky(c, faceIndex + 1);
  drawFoil(c, motifMask);
  if (label === '00' || label === '0') {
    drawFoil(c, oldSealMask);
  } else if (numberReady) {
    if (!numberMasks.has(label)) numberMasks.set(label, makeNumberMask(label));
    drawFoil(c, numberMasks.get(label));
  } else {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${label.length > 1 ? 82 : 110}px Georgia, 'Times New Roman', serif`;
    c.lineJoin = 'round';
    c.lineWidth = crystal ? 5 : 4;
    c.strokeStyle = '#604317';
    c.strokeText(label, 256, 334);
    c.fillStyle = '#e8bc6f';
    c.fillText(label, 256, 334);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function faceGeometry(points, lift = 0, inset = 0) {
  const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(.25);
  const normal = new THREE.Vector3().subVectors(points[1], points[0])
    .cross(new THREE.Vector3().subVectors(points[2], points[0])).normalize();
  if (normal.dot(center) < 0) normal.negate();
  const lifted = points.map(p => p.clone().lerp(center, inset).addScaledVector(normal, lift));
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(lifted.flatMap(p => [p.x, p.y, p.z]));
  // Use a single affine projection for the entire planar face. Mapping the
  // corners of a square to this asymmetric kite bends a circle at the seam.
  const sideMid = points[1].clone().add(points[3]).multiplyScalar(.5);
  // Top and bottom kites have opposite winding. Keep texture right aligned
  // with the viewer's right on both, so neither set of numbers is mirrored.
  const right = points[1].clone().sub(points[3]).normalize();
  const up = points[0].clone().sub(sideMid).normalize();
  if (right.dot(up.clone().cross(normal)) < 0) right.negate();
  const pixelsPerUnit = 170 / (points[1].distanceTo(points[3]) / 2);
  const uv = new Float32Array(lifted.flatMap(point => {
    const offset = point.clone().sub(sideMid);
    const x = 256 + offset.dot(right) * pixelsPerUnit;
    const y = 397 - offset.dot(up) * pixelsPerUnit;
    return [x / 512, 1 - y / 512];
  }));
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const outwardWinding = new THREE.Vector3().subVectors(lifted[1], lifted[0])
    .cross(new THREE.Vector3().subVectors(lifted[2], lifted[0])).dot(center) > 0;
  geometry.setIndex(outwardWinding ? [0,1,2, 0,2,3] : [0,2,1, 0,3,2]);
  geometry.computeVertexNormals();
  return {geometry, center, normal};
}

function bevelSurface(points, indices, material) {
  const geometry = new THREE.BufferGeometry();
  const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
  const a = points[indices[0]], b = points[indices[1]], c = points[indices[2]];
  const outward = new THREE.Vector3().subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a)).dot(center);
  const triangles = indices.slice();
  if (outward < 0) {
    for (let i = 0; i < triangles.length; i += 3) {
      [triangles[i + 1], triangles[i + 2]] = [triangles[i + 2], triangles[i + 1]];
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(
    points.flatMap(p => [p.x, p.y, p.z]), 3
  ));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function makeDie(crystal, tens) {
  const group = new THREE.Group();
  const faces = [];
  const bevelInset = .055;
  const edges = new Map();
  const vertices = new Map();
  const vertexKey = p => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
  const bodyMaterial = new THREE.MeshPhysicalMaterial(crystal ? {
    color:0xb7d2d9, metalness:.02, roughness:.04, clearcoat:1,
    clearcoatRoughness:.02, transparent:true, opacity:.34,
    depthWrite:false, ior:1.31, side:THREE.FrontSide
  } : {
    color:0x090b13, metalness:.5, roughness:.15, clearcoat:1,
    clearcoatRoughness:.055, emissive:0x0b1020,
    emissiveIntensity:.18, side:THREE.DoubleSide
  });
  facePoints.forEach((points, index) => {
    const base = faceGeometry(points, 0, bevelInset);
    const label = tens ? String(index * 10).padStart(2, '0') : String(index);
    group.add(new THREE.Mesh(base.geometry, bodyMaterial));
    const ink = faceGeometry(points, .008, bevelInset);
    group.add(new THREE.Mesh(ink.geometry, new THREE.MeshBasicMaterial({
      map:makeFaceTexture(label, crystal, index), transparent:true,
      depthWrite:false, side:crystal ? THREE.FrontSide : THREE.DoubleSide, color:0xffffff
    })));
    const insetPoints = points.map(p => p.clone().lerp(base.center, bevelInset));
    points.forEach((p, i) => {
      const a = vertexKey(p), next = points[(i + 1) % 4], b = vertexKey(next);
      if (!vertices.has(a)) vertices.set(a, {point:p, inset:[]});
      vertices.get(a).inset.push(insetPoints[i]);
      const key = [a, b].sort().join('|');
      if (!edges.has(key)) edges.set(key, {a:[a, b].sort()[0], b:[a, b].sort()[1], sides:[]});
      edges.get(key).sides.push(new Map([[a, insetPoints[i]], [b, insetPoints[(i + 1) % 4]]]));
    });
    faces.push({normal:base.normal, top:points[0].clone().sub(base.center).normalize()});
  });
  // Cut the ridges off the actual solid: each shared edge gets a narrow facet.
  for (const edge of edges.values()) {
    if (edge.sides.length !== 2) continue;
    const [first, second] = edge.sides;
    group.add(bevelSurface([
      first.get(edge.a), first.get(edge.b),
      second.get(edge.b), second.get(edge.a)
    ], [0, 1, 2, 0, 2, 3], bodyMaterial));
  }
  // Close the trimmed tips with small caps made from the same material.
  for (const {point, inset} of vertices.values()) {
    const capCenter = inset.reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .multiplyScalar(1 / inset.length);
    const axis = point.clone().normalize();
    const seed = Math.abs(axis.z) < .9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const u = seed.cross(axis).normalize(), v = axis.clone().cross(u).normalize();
    inset.sort((a, b) => {
      const da = a.clone().sub(capCenter), db = b.clone().sub(capCenter);
      return Math.atan2(da.dot(v), da.dot(u)) - Math.atan2(db.dot(v), db.dot(u));
    });
    const indices = [];
    for (let i = 0; i < inset.length; i++) indices.push(0, i + 1, (i + 1) % inset.length + 1);
    group.add(bevelSurface([capCenter, ...inset], indices, bodyMaterial));
  }
  // The d10 axis is local Z; tilt it so both tips and kite faces read clearly.
  group.scale.setScalar(1.04);
  return {group, faces};
}

let renderer, scene, camera, dice = [], rolling = false, startedAt = 0, animation = null;
let initialDicePose=[],animationFrame=0,fallbackTimer=0;
try {
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  stage.append(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  camera.position.set(0, 3.8, 12.5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(-4, 7, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 2.6); rim.position.set(4, 4, -3); scene.add(rim);
  const bounce = new THREE.PointLight(0xffffff, 8, 12); bounce.position.set(0, -2, 4); scene.add(bounce);

  const ten = makeDie(true, true), one = makeDie(false, false);
  ten.group.position.x = -1.42; one.group.position.x = 1.42;
  ten.group.quaternion.copy(targetQuaternion(ten, 0));
  one.group.quaternion.copy(targetQuaternion(one, 0));
  scene.add(ten.group, one.group);
  dice = [ten, one];
  initialDicePose=dice.map(({group})=>({position:group.position.clone(),quaternion:group.quaternion.clone()}));

  let sized=false;
  function resize() {
    if(!renderer)return;
    const bounds = stage.getBoundingClientRect();
    // A closed parent dialog has no layout size. Warm a real framebuffer once,
    // then retain it while hidden instead of repeatedly shrinking it to 0×0.
    if(sized&&(!bounds.width||!bounds.height))return;
    const width=bounds.width||300,height=bounds.height||222;
    renderer.setSize(width, height, false);
    sized=true;
    camera.aspect = width / height;
    camera.position.z = embedded ? 8.3 : width < 480 ? 11.8 : 11.4;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  await renderer.compileAsync(scene,camera);
  renderer.render(scene,camera);
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); hint.textContent = '3D 渲染暂时不可用，仍可继续掷骰并查看结果。';
  });
} catch (error) {
  renderer?.dispose();renderer=null;stage.replaceChildren();
  console.warn('WebGL unavailable; the numeric d100 roll remains usable.', error);
  hint.textContent = '此设备无法显示 3D 骰子，仍可掷骰并查看结果。';
}
stage.dataset.diceState=renderer?'ready':'fallback';
const idleHint=hint.textContent;

function targetQuaternion(die, faceIndex) {
  const face = die.faces[faceIndex];
  const towardCamera = camera.position.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(face.normal, towardCamera);
  const faceUp = face.top.clone().applyQuaternion(q).projectOnPlane(towardCamera).normalize();
  const screenUp = new THREE.Vector3(0, 1, 0).projectOnPlane(towardCamera).normalize();
  const angle = Math.atan2(towardCamera.dot(new THREE.Vector3().crossVectors(faceUp, screenUp)), faceUp.dot(screenUp));
  return new THREE.Quaternion().setFromAxisAngle(towardCamera, angle).multiply(q);
}

function draw() { if (renderer) renderer.render(scene, camera); }
function resetDice(){
  cancelAnimationFrame(animationFrame);clearTimeout(fallbackTimer);animationFrame=fallbackTimer=0;
  rolling=false;startedAt=0;animation=null;embeddedRollId=null;
  dice.forEach(({group},i)=>{group.position.copy(initialDicePose[i].position);group.quaternion.copy(initialDicePose[i].quaternion);});
  button.disabled=false;buttonLabel.textContent='抛掷命运';
  resultNumber.textContent='—';resultBreakdown.textContent='等待掷骰';hint.textContent=idleHint;
  draw();
}
const easeOut = t => 1 - Math.pow(1 - t, 3);
function animate(now) {
  animationFrame=0;
  if (!rolling || !renderer) return;
  const p = Math.min(1, (now - startedAt) / 1850);
  animation.forEach((a, i) => {
    const die = dice[i].group;
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (i ? -1 : 1) * Math.PI * 6 * p,
      (i ? 1 : -1) * Math.PI * 5 * p,
      Math.PI * 2 * p
    ));
    if (p < .7) die.quaternion.copy(spin.multiply(a.from));
    else die.quaternion.copy(a.settle).slerp(a.to, easeOut((p - .7) / .3));
    die.position.y = Math.sin(Math.PI * p) * (i ? 1.15 : 1.4);
    die.position.x = a.x + Math.sin(Math.PI * p) * (i ? .22 : -.22);
  });
  draw();
  if (p < 1) animationFrame=requestAnimationFrame(animate);
  else finishRoll();
}

function finishRoll() {
  animationFrame=fallbackTimer=0;
  rolling = false;
  button.disabled = false;
  buttonLabel.textContent = '再次掷骰';
  const [tens, ones] = animation.map(a => a.value);
  const total = tens === 0 && ones === 0 ? 100 : tens * 10 + ones;
  resultNumber.textContent = String(total).padStart(2, '0');
  resultBreakdown.textContent = `${String(tens * 10).padStart(2, '0')} + ${ones}`;
  hint.textContent = '命运已落定。你可以再次掷骰。';
  if (embedded && embeddedRollId !== null) {
    parent.postMessage({type:'dice-result', id:embeddedRollId, total}, messageOrigin);
    embeddedRollId = null;
    button.disabled = true;
  }
}

function roll() {
  if (rolling) return;
  rolling = true;
  button.disabled = true;
  buttonLabel.textContent = '骰子旋转中…';
  resultNumber.textContent = '···';
  resultBreakdown.textContent = '正在检定';
  const values = [randomDigit(), randomDigit()];
  if (!renderer) {
    animation = values.map(value => ({value}));
    fallbackTimer=setTimeout(finishRoll, reducedMotion ? 0 : 500);
    return;
  }
  animation = dice.map((die, i) => {
    const from = die.group.quaternion.clone();
    const to = targetQuaternion(die, values[i]);
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (i ? -1 : 1) * Math.PI * 6 * .7,
      (i ? 1 : -1) * Math.PI * 5 * .7,
      Math.PI * 2 * .7
    ));
    return {value:values[i], x:die.group.position.x, from, to, settle:spin.multiply(from)};
  });
  if (reducedMotion) {
    animation.forEach((a, i) => dice[i].group.quaternion.copy(a.to));
    draw(); finishRoll(); return;
  }
  startedAt = performance.now();
  animationFrame=requestAnimationFrame(animate);
}

button.addEventListener('click', roll);
document.addEventListener('keydown', event => {
  if (!embedded && event.code === 'Space' && event.target === document.body) {
    event.preventDefault(); roll();
  }
});
if (embedded) {
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== messageOrigin) return;
    if(event.data?.type==='study-reset'){resetDice();return;}
    if(event.data?.type!=='study-roll'||rolling)return;
    embeddedRollId = event.data.id;
    roll();
  });
  parent.postMessage({type:'dice-ready',rendererAvailable:!!renderer}, messageOrigin);
}
